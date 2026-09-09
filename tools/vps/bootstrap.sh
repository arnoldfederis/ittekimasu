#!/usr/bin/env bash
#
# Ittekimasu VPS bootstrap — Ubuntu 26.04, 2 vCPU / 4 GB, Euronodes Prague.
#
# Runs ON THE VPS, as root, ONCE. Does everything host-side in the order that matters:
# host tuning, Docker, firewall, then Dokploy. Idempotent — safe to re-run.
#
#   # from your Mac:
#   scp -r tools/vps root@YOUR_VPS_IP:/tmp/
#   ssh root@YOUR_VPS_IP 'setsid bash /tmp/vps/bootstrap.sh > /var/log/ittekimasu-bootstrap.log 2>&1 < /dev/null &'
#   ssh root@YOUR_VPS_IP 'tail -f /var/log/ittekimasu-bootstrap.log'
#
# Detached on purpose. This script restarts networking-adjacent things (Docker creates
# interfaces, Dokploy initialises a Swarm), and if you reach the box over Tailscale a
# blip drops your SSH session — which SIGHUPs an attached script and leaves it dead
# halfway through. `setsid` outlives the session; the log is there when you reconnect.
# Re-running after an interrupted run is safe.
#
# Everything AFTER this is Dokploy's UI and the app's own secrets — see the summary it
# prints at the end, and tools/vps/README.md.
#
# SSH is assumed to be reachable over Tailscale only, so this script does NOT touch
# sshd_config and does NOT disable root login. Locking root out of a box you only reach
# as root is the one mistake with no way back.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOKPLOY_PORT=3000

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33m !! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m !! %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root"

# Set once, at the top, for the WHOLE script. These used to be set inside the Docker
# install branch, which is skipped when Docker is already present — and then
# iptables-persistent further down hit its debconf prompt with no frontend configured,
# failed, and took the firewall's reboot-persistence with it.
#
# NEEDRESTART_MODE=l lists services on stale libraries instead of restarting them. NOT
# 'a': that restarts tailscaled, which on a box reached over Tailscale cuts the SSH
# session running this script. The reboot at the end picks them up.
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=l

# ---------------------------------------------------------------------------
# 1. host tuning
#
# FIRST, before Docker exists. optimize.sh writes /etc/docker/daemon.json, which the
# daemon reads at startup — so doing it now is what gives Dokploy's own containers a
# capped log from their very first run. Afterwards it would need a daemon restart and
# a recreate of every container.
# ---------------------------------------------------------------------------
log "Host tuning"
if [[ -f "${SCRIPT_DIR}/optimize.sh" ]]; then
  bash "${SCRIPT_DIR}/optimize.sh"
else
  warn "optimize.sh not found beside this script — skipping tuning."
  warn "scp the whole tools/vps directory, not just this file."
fi

# ---------------------------------------------------------------------------
# 2. Docker
#
# Dokploy's installer tries to install Docker itself and gives up quietly when it
# cannot, then dies later with "docker: not found" at line 247 of its own script. Two
# reasons it fails on this box, both handled here.
# ---------------------------------------------------------------------------
log "Docker"
if command -v docker >/dev/null 2>&1 && docker --version >/dev/null 2>&1; then
  info "already installed: $(docker --version)"
else
  # (a) A previous failed Dokploy run leaves docker-ce on apt hold — held BEFORE the
  #     install step died — and apt then refuses: "Held packages were changed and -y was
  #     used without --allow-change-held-packages". Clearing the hold is better than
  #     forcing past it; a hold left in place makes apt silently skip Docker security
  #     updates forever.
  if apt-mark showhold | grep -q '^docker-ce'; then
    info "clearing apt hold on docker-ce / docker-ce-cli"
    apt-mark unhold docker-ce docker-ce-cli >/dev/null 2>&1 || true
  fi

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # (b) Docker's apt repo lags new Ubuntu releases by months, so 26.04's codename may
  #     have no dists/ entry at all. Falling back to noble (24.04 LTS) is safe — same
  #     binaries, and Docker has no per-release code here.
  . /etc/os-release
  if curl -fsS --head "https://download.docker.com/linux/ubuntu/dists/${VERSION_CODENAME}/Release" >/dev/null 2>&1; then
    CODENAME="${VERSION_CODENAME}"
  else
    CODENAME="noble"
    warn "no Docker repo for '${VERSION_CODENAME}' — using '${CODENAME}' packages."
  fi
  info "apt repo codename: ${CODENAME}"

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  # DEBIAN_FRONTEND and NEEDRESTART_MODE are already exported at the top of this script.
  # Do not re-export NEEDRESTART_MODE=a here: it restarts tailscaled and cuts the SSH
  # session this is running in.
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  info "installed: $(docker --version)"
fi

docker run --rm hello-world >/dev/null 2>&1 \
  && info "docker run works" \
  || die "docker is installed but cannot run a container — check 'systemctl status docker'"

# ---------------------------------------------------------------------------
# 3. firewall
#
# Public: 80 and 443 only, for Traefik. SSH and the Dokploy UI are reachable over the
# tailnet and nowhere else.
# ---------------------------------------------------------------------------
log "Firewall"
# iptables-persistent asks, via debconf, whether to save the CURRENT rules on install.
# Answering it up front is required: unanswered it blocks, the install fails, and the
# DOCKER-USER rule below then survives only until the next reboot — silently, which is
# the worst way for a rule guarding an admin UI to disappear.
echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections
apt-get install -y -qq ufw iptables-persistent \
  || { warn "iptables-persistent failed to install — firewall rules will NOT survive a reboot."; apt-get install -y -qq ufw; }

ufw --force default deny incoming >/dev/null
ufw --force default allow outgoing >/dev/null
ufw allow 80/tcp   >/dev/null
ufw allow 443/tcp  >/dev/null

if ip link show tailscale0 >/dev/null 2>&1; then
  # SSH only over the tailnet. Public 22 stays closed.
  ufw allow in on tailscale0 to any port 22 proto tcp >/dev/null
  info "SSH allowed on tailscale0 only; public 22 closed"
else
  warn "tailscale0 not found — allowing public SSH so you are not locked out."
  warn "Install Tailscale, then: ufw delete allow OpenSSH && ufw allow in on tailscale0 to any port 22 proto tcp"
  ufw allow OpenSSH >/dev/null
fi

ufw --force enable >/dev/null
info "ufw enabled"

# --- the part ufw cannot do -------------------------------------------------
# Dokploy publishes its UI on 3000 through Docker, which binds 0.0.0.0 and inserts a
# DNAT rule AHEAD of ufw's chain. `ufw deny 3000` therefore does nothing at all: the
# port is on the public internet while ufw reports it closed. The only place that
# reaches Docker-published ports is the DOCKER-USER chain.
#
# Final rule order (last -I ends up on top):
#   1. lo          RETURN   — keep loopback working
#   2. tailscale0  RETURN   — your tailnet reaches the UI
#   3. dport 3000  DROP     — everyone else does not
ensure_rule() {
  iptables -C DOCKER-USER "$@" 2>/dev/null || iptables -I DOCKER-USER "$@"
}
if iptables -L DOCKER-USER -n >/dev/null 2>&1; then
  ensure_rule -p tcp --dport "${DOKPLOY_PORT}" -j DROP
  ip link show tailscale0 >/dev/null 2>&1 && ensure_rule -i tailscale0 -j RETURN
  ensure_rule -i lo -j RETURN
  info "DOCKER-USER: port ${DOKPLOY_PORT} dropped except over tailscale0"
  command -v netfilter-persistent >/dev/null 2>&1 \
    && netfilter-persistent save >/dev/null 2>&1 \
    && info "iptables rules persisted across reboot" \
    || warn "iptables-persistent missing — these rules are lost on reboot. Re-run this script after one."
else
  warn "DOCKER-USER chain absent (Docker not fully started?). Port ${DOKPLOY_PORT} is PUBLIC until this is re-run."
fi

# ---------------------------------------------------------------------------
# 4. the Firebase service account's home
#
# Contents are NOT created here: the file lives on your Mac and must not pass through
# this script or the repo. The directory is made now so the bind mount in
# docker-compose.yml has somewhere to land — Docker creates a DIRECTORY at a missing
# bind-mount source, and the resulting error points nowhere near the real cause.
# ---------------------------------------------------------------------------
log "Secret mount point"
install -d -m 0755 /etc/ittekimasu
if [[ -f /etc/ittekimasu/firebase-config.json ]]; then
  info "firebase-config.json present: $(stat -c '%A %u:%g' /etc/ittekimasu/firebase-config.json)"
  [[ "$(stat -c '%u' /etc/ittekimasu/firebase-config.json)" == "10001" ]] \
    || warn "owner is not uid 10001 — the container runs as that user and cannot read it."
elif [[ -d /etc/ittekimasu/firebase-config.json ]]; then
  warn "firebase-config.json is a DIRECTORY (Docker made it). Removing."
  rmdir /etc/ittekimasu/firebase-config.json
else
  info "not uploaded yet — see the checklist below"
fi

# ---------------------------------------------------------------------------
# 5. Dokploy
# ---------------------------------------------------------------------------
log "Dokploy"
if docker ps --format '{{.Names}}' | grep -q '^dokploy'; then
  info "already running"
else
  curl -sSL https://dokploy.com/install.sh | sh
fi

# ---------------------------------------------------------------------------
# done
# ---------------------------------------------------------------------------
TS_IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"

cat <<EOF

============================================================
Host is ready. Everything below is done from your Mac or in
the Dokploy UI — none of it belongs in this script.
============================================================

1. Upload the Firebase service account (from your Mac):

     scp apps/server/src/main/resources/firebase-config.json root@${TS_IP:-YOUR_VPS}:/tmp/fb.json

   then back here:

     install -m 0400 /tmp/fb.json /etc/ittekimasu/firebase-config.json
     chown 10001:10001 /etc/ittekimasu/firebase-config.json
     rm -f /tmp/fb.json

   chown, not 'install -o 10001': install resolves -o through the passwd
   database and no such user exists on the host.

2. Open Dokploy:  http://${TS_IP:-<tailscale-ip>}:${DOKPLOY_PORT}
   Reachable over your tailnet only. Create the admin account NOW —
   the first visitor gets it.

3. New project -> Compose -> point it at this repo, docker-compose.yml.

4. Dokploy -> Environment. These have no defaults and the app fails
   closed without them:

     POSTGRES_PASSWORD=<generate one>
     POSTGRES_USER=ittekimasu
     POSTGRES_DB=ittekimasu
     REVENUECAT_WEBHOOK_AUTHORIZATION=<the string in the RevenueCat dashboard>
     ONESIGNAL_REST_API_KEY=<from OneSignal>
     TAILSCALE_IP=${TS_IP:-<tailscale ip -4>}
     SPRING_JPA_SHOW_SQL=false
     SPRINGDOC_API_DOCS_ENABLED=false
     SCALAR_ENABLED=false

5. Dokploy -> Domains. api.ittekimasu.app -> service 'server', port 4000.
   Cloudflare is proxying your DNS, which breaks Traefik's HTTP-01 ACME
   challenge — grey-cloud the record until the certificate issues, then
   turn the proxy back on. Set SSL mode to Full (strict), not Flexible.

6. GitHub -> repo secrets, for .github/workflows/deploy-production.yml:

     DOKPLOY_URL, DOKPLOY_API_TOKEN, DOKPLOY_COMPOSE_ID,
     PRODUCTION_HEALTH_URL=https://api.ittekimasu.app/actuator/health

7. Backups. Nothing does this yet and Dokploy does not back up a
   database it did not create:

     0 4 * * * docker exec \$(docker ps -qf name=postgres-db) \\
       pg_dump -U ittekimasu ittekimasu | gzip > /var/backups/ittekimasu-\$(date +\\%F).sql.gz

   Ship it off the box. A snapshot on the same disk is not a backup.

EOF
