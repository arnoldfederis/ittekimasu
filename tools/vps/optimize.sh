#!/usr/bin/env bash
#
# Ittekimasu VPS tuning — Ubuntu 26.04 LTS, 2 vCPU / 4 GB NVMe, Euronodes Prague.
# Target workload: Dokploy (Docker Swarm + its own Traefik) running a Spring Boot
# service and a PostgreSQL container on one box.
#
# 4 GB is TIGHT for that list, and the settings below are sized for it rather than
# copied from a bigger box. Rough budget once Dokploy is up:
#
#   Dokploy's own stack (Traefik + its Postgres + Redis + UI)  ~700 MB - 1 GB
#   your PostgreSQL container                                  ~700 MB
#   your Spring Boot JVM                                       ~1.2 GB
#   kernel + page cache + headroom                             remainder
#
# That leaves almost nothing spare, which is why the swap and the dirty-page
# settings here matter more than they would on an 8 GB box — and why the JVM heap
# and Postgres MUST be capped explicitly (see "sizing" at the bottom of this file).
# Left on defaults, the JVM alone will claim a quarter of RAM and Postgres will
# plan as though it owns the page cache.
#
#   scp tools/vps/optimize.sh user@vps:/tmp/
#   ssh user@vps 'sudo bash /tmp/optimize.sh'
#
# Idempotent: safe to re-run. Every change is written to a marked drop-in file, so
# `--revert` can take them all back out again.
#
# Run this BEFORE installing Dokploy. Two of the settings here (the Docker daemon's
# log limits and the file-descriptor ceiling) only take effect when the Docker daemon
# starts, and Dokploy brings up ~6 containers the moment it installs.

set -euo pipefail

MARK="ittekimasu-vps-tuning"
SWAP_GB="${SWAP_GB:-4}"
DO_REVERT="${1:-}"

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m !!\033[0m %s\n' "$*" >&2; }
skip() { printf '    (already applied) %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { warn "run with sudo"; exit 1; }

# ---------------------------------------------------------------------------
# revert
# ---------------------------------------------------------------------------
if [[ "$DO_REVERT" == "--revert" ]]; then
  log "Reverting $MARK"
  rm -f /etc/sysctl.d/99-${MARK}.conf \
        /etc/security/limits.d/99-${MARK}.conf \
        /etc/systemd/journald.conf.d/99-${MARK}.conf \
        /etc/systemd/system/docker.service.d/99-${MARK}.conf
  sysctl --system >/dev/null
  systemctl daemon-reload
  warn "Left alone on purpose: /etc/docker/daemon.json (may hold Dokploy's own keys),"
  warn "the swapfile, and the timezone. Remove those by hand if you want them gone."
  exit 0
fi

# ---------------------------------------------------------------------------
# 0. preflight
# ---------------------------------------------------------------------------
log "Preflight"
. /etc/os-release
echo "    OS      : ${PRETTY_NAME}"
echo "    Kernel  : $(uname -r)"
echo "    CPU     : $(nproc) vCPU"
echo "    Memory  : $(free -h | awk '/^Mem:/{print $2}')"
echo "    Disk    : $(df -h / | awk 'NR==2{print $2" ("$5" used)"}')"
echo "    Swap    : $(free -h | awk '/^Swap:/{print $2}')"

[[ "${ID}" == "ubuntu" ]] || warn "Written for Ubuntu; found '${ID}'. Sysctl keys are generic, paths may not be."

mem_mb=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
if (( mem_mb < 6000 )); then
  warn "${mem_mb} MB RAM. Dokploy's own stack takes ~700 MB-1 GB before your app starts."
  warn "Cap the JVM heap and Postgres explicitly — see 'sizing' at the end of this script."
fi

# ---------------------------------------------------------------------------
# 1. packages
#
# Deliberately small. Every daemon added here is memory this box does not have
# spare and an attack surface Dokploy did not ask for.
# ---------------------------------------------------------------------------
log "Updating packages"
export DEBIAN_FRONTEND=noninteractive
# needrestart drops an interactive service-restart menu into the middle of an Ubuntu
# Server upgrade, which hangs a non-interactive run forever.
#
# 'l' = list what needs restarting, restart nothing. NOT 'a' (restart everything
# automatically): 'a' restarts tailscaled, and on a box you reach over Tailscale that
# cuts your own SSH session mid-script — the shell gets SIGHUP and the run dies
# somewhere undefined. Anything still on old libraries is picked up by the reboot this
# script tells you to do at the end.
export NEEDRESTART_MODE=l
apt-get update -qq
apt-get -y -qq upgrade
apt-get install -y -qq ca-certificates curl gnupg htop ncdu jq chrony

# ---------------------------------------------------------------------------
# 2. clock
#
# UTC, not Asia/Tokyo. The app never reads the system zone — ReviewService pins
# its day boundary to Asia/Tokyo in code and reminders use each user's own zone —
# so a local system zone buys nothing and costs you mental arithmetic every time
# you read a log next to a Sentry event or a RevenueCat webhook timestamp.
#
# Accurate time is not cosmetic here: Firebase ID tokens carry a 1-hour window,
# and a box that drifts past it rejects every valid token with a 401.
# ---------------------------------------------------------------------------
log "Clock: UTC + chrony"
timedatectl set-timezone UTC
systemctl enable --now chrony >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 3. swap
#
# Sized to equal RAM, which is the convention at or below 4 GB — and on this box it
# is not a formality. Swap is not there to be used; it is there so a transient spike
# gets slow instead of getting a process killed, and the OOM killer picks the biggest
# RSS, which is your JVM. On 4 GB with Dokploy resident, that spike will happen.
#
# swappiness=10, not 0: 0 means "swap only to avoid OOM", which in practice means
# the kernel cannot page out genuinely cold pages to keep page cache for Postgres.
# On a small box that page cache is the difference between an index scan hitting
# memory and hitting the disk.
# ---------------------------------------------------------------------------
if swapon --show | grep -q '/swapfile'; then
  skip "swapfile exists"
else
  log "Creating ${SWAP_GB}G swapfile"
  fallocate -l "${SWAP_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------------------------------------------------------------------------
# 4. sysctl
# ---------------------------------------------------------------------------
log "Kernel tuning -> /etc/sysctl.d/99-${MARK}.conf"
cat > "/etc/sysctl.d/99-${MARK}.conf" <<'EOF'
# --- memory -----------------------------------------------------------------
# Prefer keeping page cache over swapping; Postgres reads through it.
vm.swappiness = 10
# Write dirty pages out earlier. The default 20%/10% is tuned for a machine with
# memory to spare; on 4 GB it lets ~800 MB of dirty data pile up and then hit NVMe
# in one burst, stalling every writer behind it.
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
# Bias reclaim towards dentry/inode cache over application pages.
vm.vfs_cache_pressure = 50

# --- file descriptors -------------------------------------------------------
# Each container, each Postgres backend and each Netty/Tomcat connection is FDs.
# The default is survivable; this removes it as a thing you have to think about.
fs.file-max = 262144
# Each inotify watch pins ~1 KB of unswappable kernel memory. 524288 is the usual
# recommendation and would be a quarter of this box's RAM if ever fully consumed;
# 131072 is far more than Docker and Dokploy will ask for.
fs.inotify.max_user_watches = 131072
fs.inotify.max_user_instances = 512

# --- network ----------------------------------------------------------------
# Accept queue. Traefik in front of Tomcat, both listening: the default 4096 is
# fine until a restart makes every client reconnect at once.
net.core.somaxconn = 8192
net.core.netdev_max_backlog = 16384
net.ipv4.tcp_max_syn_backlog = 8192

# BBR + fq. This is the single biggest network win on THIS box: your clients are
# ~190 ms away over a long fat pipe, and CUBIC reads any loss on that path as
# congestion and collapses the window. BBR paces on measured bandwidth instead.
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# Reclaim closed sockets faster and widen the ephemeral range — a reverse proxy
# opening a fresh upstream connection per request burns ports quickly.
net.ipv4.tcp_fin_timeout = 15
net.ipv4.ip_local_port_range = 10240 65535
net.ipv4.tcp_slow_start_after_idle = 0
# Detect a dead peer in ~2 min rather than the default ~2 h.
net.ipv4.tcp_keepalive_time = 120
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 4

# Do not touch net.ipv4.tcp_tw_reuse or conntrack here: Docker manages its own
# netfilter chains and conntrack table, and fighting it produces dropped packets
# that look like application bugs.
EOF
sysctl -p "/etc/sysctl.d/99-${MARK}.conf" >/dev/null
sysctl net.ipv4.tcp_congestion_control | grep -q bbr \
  && echo "    BBR active" \
  || warn "BBR did not take — check 'modprobe tcp_bbr'"

# ---------------------------------------------------------------------------
# 5. ulimits
# ---------------------------------------------------------------------------
log "File descriptor limits"
cat > "/etc/security/limits.d/99-${MARK}.conf" <<'EOF'
*  soft  nofile  65535
*  hard  nofile  65535
*  soft  nproc   65535
*  hard  nproc   65535
EOF

# limits.conf covers PAM logins only. The Docker daemon is a systemd unit and
# ignores it entirely, so its children — every container you run — inherit
# systemd's default instead. This is the drop-in that actually matters.
mkdir -p /etc/systemd/system/docker.service.d
cat > "/etc/systemd/system/docker.service.d/99-${MARK}.conf" <<'EOF'
[Service]
LimitNOFILE=1048576
LimitNPROC=infinity
LimitCORE=infinity
EOF

# ---------------------------------------------------------------------------
# 6. Docker daemon
#
# THE most important block in this file. Docker's default json-file log driver
# has NO size limit. A container that logs every SQL statement will fill / in
# days, and a full disk takes down Postgres, Traefik and the Dokploy UI at once —
# with no room left to even read the logs that caused it.
# ---------------------------------------------------------------------------
# Written whether or not Docker is installed yet. /etc/docker/daemon.json is read by
# the daemon at startup, so putting it here BEFORE Dokploy's installer pulls Docker in
# is the only way the very first containers it creates get a capped log.
log "Docker daemon config"
mkdir -p /etc/docker

# NO "live-restore". It is incompatible with Swarm mode, which Dokploy uses, and Docker
# does not warn — it refuses to start at all:
#
#   "live-restore daemon configuration is incompatible with swarm mode"
#
# The failure hides until the next reboot, because a daemon already running keeps the
# config it started with. `del` as well as the merge, so an earlier run's copy comes back
# out of an existing file.
if [[ -f /etc/docker/daemon.json ]]; then
  # Dokploy writes its own keys here. Merge rather than overwrite.
  tmp=$(mktemp)
  jq 'del(."live-restore") + {
        "log-driver": "json-file",
        "log-opts": { "max-size": "10m", "max-file": "3", "compress": "true" },
        "default-ulimits": { "nofile": { "Name": "nofile", "Hard": 65535, "Soft": 65535 } }
      }' /etc/docker/daemon.json > "$tmp" && mv "$tmp" /etc/docker/daemon.json
else
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3", "compress": "true" },
  "default-ulimits": { "nofile": { "Name": "nofile", "Hard": 65535, "Soft": 65535 } }
}
EOF
fi
echo "    30 MB ceiling per container."

# Docker was already installed when bootstrap.sh ran, so its `systemctl enable --now`
# branch was skipped and a manually-installed daemon may not be enabled at boot.
systemctl enable docker >/dev/null 2>&1 || true

if command -v docker >/dev/null 2>&1; then
  warn "log-opts apply to NEWLY CREATED containers only. Anything already running keeps"
  warn "its unbounded log until it is recreated."
  systemctl is-active --quiet docker && warn "Restart the daemon to pick this up: systemctl restart docker"
else
  echo "    Docker not installed yet. The daemon will read this file on first start —"
  echo "    which is the point of running this script before Dokploy's installer."
fi

# ---------------------------------------------------------------------------
# 7. journald
#
# Same failure as Docker logs, different directory. Uncapped, /var/log/journal
# grows to 10% of the filesystem.
# ---------------------------------------------------------------------------
log "Capping journald at 500M"
mkdir -p /etc/systemd/journald.conf.d
cat > "/etc/systemd/journald.conf.d/99-${MARK}.conf" <<'EOF'
[Journal]
SystemMaxUse=500M
SystemMaxFileSize=50M
MaxRetentionSec=1month
EOF
systemctl restart systemd-journald

# ---------------------------------------------------------------------------
# 8. NVMe housekeeping
# ---------------------------------------------------------------------------
log "fstrim timer"
systemctl enable --now fstrim.timer >/dev/null 2>&1 || true
systemctl is-enabled fstrim.timer >/dev/null 2>&1 \
  && echo "    weekly TRIM enabled" \
  || warn "fstrim.timer unavailable (normal on some virtualised storage)"

# ---------------------------------------------------------------------------
# 9. transparent hugepages
#
# Reported, not changed. Postgres guidance says disable; the JVM benefits from
# them. Ubuntu's default of 'madvise' gives each its way and is the right answer
# for a box running both — so this only warns when something else has changed it.
# ---------------------------------------------------------------------------
if [[ -f /sys/kernel/mm/transparent_hugepage/enabled ]]; then
  thp=$(sed 's/.*\[\(.*\)\].*/\1/' /sys/kernel/mm/transparent_hugepage/enabled)
  log "Transparent hugepages: ${thp}"
  [[ "$thp" == "madvise" ]] || warn "'madvise' is what you want with Postgres and a JVM co-resident."
fi

# ---------------------------------------------------------------------------
# 10. unattended upgrades
# ---------------------------------------------------------------------------
log "Unattended security upgrades"
systemctl is-enabled unattended-upgrades >/dev/null 2>&1 \
  && echo "    enabled" \
  || { apt-get install -y -qq unattended-upgrades; systemctl enable --now unattended-upgrades; }

# ---------------------------------------------------------------------------
# 11. snapd
#
# Opt-in. Ubuntu Server ships snapd; Dokploy and Docker need none of it, and it
# costs ~100 MB RSS plus a mount unit per snap. Left alone by default because
# removing it is not reversible in one command.
# ---------------------------------------------------------------------------
if [[ "${REMOVE_SNAPD:-0}" == "1" ]] && command -v snap >/dev/null 2>&1; then
  log "Removing snapd (REMOVE_SNAPD=1)"
  systemctl disable --now snapd.service snapd.socket snapd.seeded.service 2>/dev/null || true
  apt-get purge -y -qq snapd
  rm -rf /var/cache/snapd /root/snap
elif command -v snap >/dev/null 2>&1; then
  echo "    snapd present, left alone. Re-run with REMOVE_SNAPD=1 to purge (~100 MB RSS)."
fi

# ---------------------------------------------------------------------------
# done
# ---------------------------------------------------------------------------
log "Applied. Reboot to pick up the Docker daemon limits and the swap settings:"
echo "      sudo reboot"
echo
echo "    Verify afterwards:"
echo "      sysctl net.ipv4.tcp_congestion_control   # bbr"
echo "      free -h                                  # swap present"
echo "      docker info | grep -A2 'Logging Driver'  # json-file, capped"
echo "      cat /proc/\$(pgrep -f dockerd)/limits | grep files"
echo
echo "    Undo everything this script wrote:"
echo "      sudo bash $0 --revert"

# ---------------------------------------------------------------------------
# sizing — NOT applied by this script
#
# These belong in the Dokploy service config, not on the host, but on 4 GB they
# are the difference between a box that stays up and one that OOM-kills the JVM
# under the first real load. Left on defaults:
#
#   - The JVM claims 25% of *container* RAM for heap, and if the container has no
#     memory limit that means 25% of the HOST — it will happily size itself as
#     though Postgres and Dokploy are not there.
#   - Postgres plans queries as though it owns the page cache, and its default
#     shared_buffers of 128 MB is simultaneously too small to help and no
#     protection against the planner's optimism.
#
# Spring Boot service — set a container memory limit AND let the JVM see it:
#
#   memory limit : 1536m
#   JAVA_TOOL_OPTIONS: -XX:MaxRAMPercentage=70 -XX:+UseSerialGC
#                      -XX:+ExitOnOutOfMemoryError -Xss512k
#
#   MaxRAMPercentage, not -Xmx: it reads the cgroup limit, so the heap follows the
#   container if you resize it. SerialGC rather than G1 because G1's concurrent
#   threads and region bookkeeping are overhead you cannot afford on 2 vCPU with a
#   heap this small — Boot would pick SerialGC itself here, but only if it detects
#   fewer than 2 CPUs, and 2 is exactly the boundary. ExitOnOutOfMemoryError so a
#   heap exhaustion restarts the container instead of leaving a wedged JVM that
#   still passes a TCP health check.
#
#   Hikari pool: max 8. The rule of thumb is (2 x cores) + spindles; anything more
#   on 2 vCPU just queues inside Postgres instead of inside the app, where you can
#   see it.
#
# PostgreSQL container — memory limit 768m, and pass:
#
#   shared_buffers = 256MB          # 25% of what Postgres is ALLOWED, not of host
#   effective_cache_size = 768MB    # honest about the page cache it will actually get
#   work_mem = 8MB                  # x max_connections x sorts — the classic OOM
#   maintenance_work_mem = 128MB
#   max_connections = 30            # you have one app; 100 is 100 backend processes
#   random_page_cost = 1.1          # NVMe, not a spinning disk
#   effective_io_concurrency = 200  # NVMe
#   checkpoint_completion_target = 0.9
#   wal_compression = on            # cheap on CPU, real saving on a small disk
#   synchronous_commit = on         # keep it. This is purchase and progress data.
#
# And in the app config, before this goes anywhere public:
#   spring.jpa.show-sql = false     # otherwise every query is a log line, and the
#                                   # Docker log cap above exists precisely because
#                                   # of that.
# ---------------------------------------------------------------------------
