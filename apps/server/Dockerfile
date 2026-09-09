# syntax=docker/dockerfile:1
#
# Build context is the REPO ROOT, not apps/server — the CI workflow passes
# `context: .` so the Maven wrapper and the module can be copied together.
#
#   docker build -f apps/server/Dockerfile -t ittekimasu-server .

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM eclipse-temurin:25-jdk AS build

WORKDIR /build

# Wrapper and POM first, on their own layer. Dependencies change far less often than
# source does, so this layer survives most commits and the resolve below is skipped.
COPY apps/server/.mvn .mvn
COPY apps/server/mvnw apps/server/pom.xml ./
RUN chmod +x mvnw

# BuildKit cache mount rather than a baked ~/.m2 layer: the jars stay on the builder
# between runs without ending up in the image or in the pushed layers.
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -q dependency:go-offline

COPY apps/server/src src

# Tests do NOT run here. ServerApplicationTests is a @SpringBootTest and needs a live
# Postgres; CI runs the suite against a service container before this image is built,
# which is the right place for it — a docker build has no database.
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -DskipTests clean package && \
    mv target/*.jar /build/app.jar

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM eclipse-temurin:25-jre AS runtime

# curl is for the HEALTHCHECK below and nothing else. The JRE image ships neither curl
# nor wget, so without this the healthcheck has no way to make an HTTP request and the
# container reports unhealthy forever.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root. A JVM has no reason to be root, and Dokploy will happily run whatever the
# image declares.
RUN useradd --system --create-home --uid 10001 app
USER app
WORKDIR /app

COPY --from=build --chown=app:app /build/app.jar app.jar

EXPOSE 4000

# MaxRAMPercentage, not -Xmx: it reads the cgroup limit, so the heap follows the
# container's memory limit instead of being pinned to a number that goes stale the
# moment the limit is resized. 70% leaves room for metaspace, thread stacks, and the
# direct buffers Netty and the Postgres driver allocate outside the heap.
#
# SerialGC because this box has 2 vCPU. G1's concurrent marking threads and region
# bookkeeping cost more than they return on a heap this small, and Boot only picks
# Serial automatically below 2 CPUs — 2 is exactly the boundary where it does not.
#
# ExitOnOutOfMemoryError so heap exhaustion kills the container and Docker restarts it,
# rather than leaving a wedged JVM that still answers the TCP healthcheck.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Xss512k -Djava.security.egd=file:/dev/./urandom"

# Compose declares its own healthcheck too; this one is here so the image is correct
# when run outside Compose. start-period covers JVM boot plus Flyway migrations, which
# on a cold database is the slowest thing that happens.
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS http://127.0.0.1:4000/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
