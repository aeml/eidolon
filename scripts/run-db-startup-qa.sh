#!/usr/bin/env bash
set -euo pipefail

# The fault-enabled Mongo belongs only to this bounded startup fixture. Never
# enable testing commands on the ordinary CI service or an operator database.
qa_port=${EIDOLON_DB_STARTUP_QA_PORT:-18312}
if ! [[ "$qa_port" =~ ^[0-9]+$ ]] || ((10#$qa_port < 1024 || 10#$qa_port > 65535)); then
    echo 'Startup QA requires an unprivileged TCP port.' >&2
    exit 1
fi
if ss -ltnH | awk '{print $4}' | grep -Eq ":${qa_port}$"; then
    echo 'Startup QA port is occupied; refusing to reuse another database.' >&2
    exit 1
fi
qa_name="eidolon-db-startup-$(date +%s)-$$"
if docker container inspect "$qa_name" >/dev/null 2>&1; then
    echo 'Startup QA container already exists; refusing to replace it.' >&2
    exit 1
fi
qa_created=false
cleanup() {
    local status=$?
    if [[ "$qa_created" == true ]]; then
        if ((status != 0)); then docker logs --tail 80 "$qa_name" >&2 || true; fi
        docker container rm --force --volumes "$qa_name" >/dev/null
    fi
    return "$status"
}
trap cleanup EXIT
docker run -d --name "$qa_name" --network host --cpus 1 --memory 512m \
    mongo:7.0.14 --bind_ip 127.0.0.1 --port "$qa_port" \
    --setParameter enableTestCommands=1 >/dev/null
qa_created=true
qa_ready=false
for attempt in $(seq 1 40); do
    if docker exec "$qa_name" mongosh --quiet --port "$qa_port" \
        --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
        qa_ready=true
        break
    fi
    sleep .5
done
if [[ "$qa_ready" != true ]]; then
    echo 'Owned startup QA Mongo did not become ready.' >&2
    exit 1
fi

# Run the delayed constructor first on the fresh schema. The second case keeps
# the original connection deadline. This does not repeat a gameplay or load test.
EIDOLON_DB_STARTUP_DISPOSABLE=1 \
EIDOLON_DB_STARTUP_TEST_MONGO_URI="mongodb://127.0.0.1:${qa_port}" \
GOMAXPROCS=2 GOMEMLIMIT=384MiB \
    go -C server test -race -p 1 -count=1 -timeout=90s -v \
    -run '^TestDBStartup.*$' ./internal/database
