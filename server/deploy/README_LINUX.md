# Eidolon Linux Deployment (Mendola-style)

This deploys:

- Go API in Docker
- MongoDB in Docker with auth + persistent volume
- Nginx on host (ports 80/443) reverse-proxying to API on localhost upstream port
- TLS via Certbot Nginx flow

## 1) Baseline and env wiring

From server directory:

```bash
cd /path/to/eidolon/server
cp .env.example .env
```

Edit `.env` and preserve any existing non-Mongo values. Required keys:

- `MONGO_INITDB_ROOT_USERNAME`
- `MONGO_INITDB_ROOT_PASSWORD`
- `MONGO_URI` (must use `mongo:27017` and `authSource=admin`)
- `EIDOLON_QA_USERNAMES` (optional; dedicated QA usernames only)
- `EIDOLON_ADMIN_BOOTSTRAP_USERNAMES` (exact verified existing usernames temporarily allowed to persist the administrator role with `/relevel`; prepared1.71 defaults to empty and preserves existing durable roles)
- `EIDOLON_ADMIN_AUDIT_RETENTION_DAYS` (optional, defaults to90; whole days7–365)
- `EIDOLON_AUTH_MAX_CONCURRENT` (prepared1.71; optional, defaults to4; whole number1–32)

The prepared 1.71 account-security candidate adds `-auth-max-concurrent`
(default4, accepted range1–32; Compose reads `EIDOLON_AUTH_MAX_CONCURRENT`) to bound simultaneous login/registration database
queries and password hashes. Busy requests receive retry feedback immediately;
there is no unbounded authentication queue, and gameplay does not take this
credential-work lock. The slot is released before character hydration, audit
storage or session takeover. Do not raise it without measuring headroom.
Login and registration each retain five attempts/minute per exact-case account
across connections, in addition to the existing per-connection policies. Tokens
refill gradually; there is no persistent account-disable flag. The RAM-only map
holds at most4096 fixed-size hashed account keys per server process and prunes
fully refilled entries at most once/minute on incoming credential requests.
At capacity, new keys are refused with retry feedback; a busy refusal does not
spend an account retry. A restart resets these ephemeral budgets. This does not
prove a simultaneous100-player login burst, prevent targeted temporary denial
of an account, or replace edge/proxy flood protection. Forwarding headers and
household/proxy IPs are not used as authentication authority or budget keys.
This candidate is not live until its ordered release and acceptance complete.

Prepared1.71 validates only **new public registrations** before credential work:
an exact, nonblank username of at most128 UTF-8 bytes without control characters,
and a password of at least15 Unicode code points and at most72 UTF-8 bytes.
The fifteen-character single-factor baseline follows the
[NIST password-verifier guidance](https://pages.nist.gov/800-63-4/sp800-63b.html).
The byte ceiling is the existing bcrypt encoder's limit, not a new truncation
scheme. Spaces/case are retained, paste/autofill remain available, and existing
login/hash data is not normalized, reset or given a new minimum. A small local
whole-value blocklist rejects obvious common/context passwords and the exact
username without making a network request or storing candidate passwords.
It is not a comprehensive compromised-password corpus or a claim of NIST
compliance: legacy credential migration, corpus/normalization strategy,
verified recovery delivery and protected-admin hardening remain named work.
The login hint distinguishes new-account requirements from existing passwords.

Prepared1.72 bounds **suspicious HTTP/WebSocket diagnostic logging** separately
from durable account/administrator audit. Both junk-file and optional stdout
records share a twenty-line initial burst and one-line/second refill; the next
emitted record includes the number suppressed. All untrusted fields are quoted
and byte-bounded; query strings, authorization headers and cookies are excluded.
`peer_ip` is the canonical transport peer. `reported_ip` is only a validated,
unverified forwarding-header claim; it cannot set authority or throttle keys.
The existing stdout cooldown now samples actual transport peers, with at most
4096 bounded keys and periodic expired-key reclamation. Behind a reverse proxy,
stdout may sample the proxy as one peer; this is diagnostic sampling, never a
player/login restriction. File records retain their separate global budget.
Disabling the peer cooldown does not disable that shared budget. These limits
do not rotate existing logs, impose a disk quota, bound other logger categories
or replace edge protection; retention and hosting work remain later gates.
No deployed configuration or old log file is changed by preparation. This is
not live until the ordered1.72 release and acceptance pass.

The prepared1.72 dependency patch aligns module, hosted CI, container and
isolated-QA builds on Go1.27.1. It keeps Mongo's existing1.x API, with driver1.17.7,
WebSocket1.5.3, x/crypto0.56.0, x/text0.41.0 and compress1.18.7 plus their resolved
transitives. `go mod verify` and pinned govulncheck1.8.0 run inside the existing
server CI job. The final source scan reported no called vulnerable functions;
the remaining module-only OpenPGP advisory concerns an unmaintained package not
in the server's compiled imports. Do not introduce that package; select a
maintained alternative and rescan if such a feature is ever authorized. This
does not certify that every library, container, runtime path or secret is safe.

The prepared WebSocket read-pump guard admits an initial300 data messages or
ping/pong frames combined and
refills200/second, before JSON parsing. A separate initial8 malformed frames
refills over10seconds; excess closes that transport with policy code1008.
Individual message authentication, payload and rate rules still apply. A single
malformed frame does not ban an account, consume another connection's budget
or replace the normal login/reconnect flow. Raw malformed bodies/errors are
no longer copied into the general server log. Ping/pong handlers charge that
same budget before responding or renewing a deadline; ordinary echo responses
and the existing pong deadline handler are preserved. Focused loopback socket
checks cover exhaustion after data traffic and ordinary keepalives. These are
connection-local limits, not a global-connection or network flood solution;
edge protection and realistic high-latency/capacity validation remain separate
unfinished protocol/operations checks.

Structured administration history is stored separately from server logs. Session
events are journaled under `logs/character-saves/admin-activity/` before normal
login/resume acknowledgement and synced to Mongo in batches every5seconds.
The existing consistent upgrade backup includes this private directory. Preserve
it with the matching Mongo backup; do not delete pending events to clear an error.
Journal corruption blocks startup rather than silently losing history. A local
storage failure refuses new logins/resumes; a disconnected socket's event is
retained for retry, readiness becomes unavailable, and graceful shutdown waits
until that event is durable. A sudden host loss while local storage itself is
unwritable cannot guarantee preservation of such an unjournaled event.

The administration feature batch adds schema14's private `admin_operations`
collection and full-character operation receipts. Preserve these with the
character-save journal in the same consistent backup. Operation IDs and final
results are permanent deduplication receipts, not TTL history; do not delete them
to retry a grant. Generated execution plans are removed when completed. Earlier
schema13 writers cannot safely save these characters because they omit the new
receipts; reverting across this boundary requires the existing approved matching
Mongo/journal restore workflow. Startup drains pending operations before becoming
ready; runtime retries process at most50 durable operations per5second pass and
stop on the first storage failure. Affected character commands/reconnects wait
for recovery, without adding Mongo queries to unaffected movement packets.
Role-gated grant/teleport handlers and panel controls are now enabled; use the
confirmed, audited procedures in [the administration guide](../../docs/ADMINISTRATION.md).
They do not confer password-reset or arbitrary account-ownership authority.

Retention is applied when records are created. Reads also enforce the current
retention cutoff, so reducing it immediately hides older records; physical
deletion follows each record's original expiry via MongoDB's asynchronous TTL.
Increasing retention does not recover expired records. Only administrators may
read this history; it contains bounded identity/action/outcome fields, not raw
logs, passwords, password hashes, session tokens or full character saves.

Recommended example URI:

```bash
MONGO_URI=mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@mongo:27017/eidolon?authSource=admin
```

## 2) Build and run app+mongo

```bash
chmod +x deploy/deploy_linux.sh deploy/restore_mongo_archive.sh deploy/setup_nginx_tls.sh
./deploy/deploy_linux.sh
```

Read-only checks after deployment:

```bash
docker compose ps
docker compose logs --tail=100 api
curl -fsS http://127.0.0.1:${APP_HOST_PORT:-18082}/healthz
```

Use the deployment script for fail-closed execution. When handling deployment
manually, **stop on any error**; do not run `up -d` after a rejected preflight.
The preflight starts Mongo only if necessary, does not recreate an existing
Mongo container, and leaves the API running. It reads the schema marker without
opening logs, creating a save journal, applying migrations, or admitting players.
Database failure also aborts deployment. Normal startup repeats the compatibility
check. Starting with 1.0.57, the script holds `logs/deploy.lock` to refuse another
deployment through this script while it is active. Manual/older deployment tools
do not share that protection and must not run concurrently.

Deployment validates that the API's URI points to the same `mongo:27017` service
that the backup captures. Remote database URIs fail closed; they require a
separately verified backup workflow rather than an unrelated local archive.

Before building, `pin_previous_image.sh` retains the previous container's exact
image with a digest-derived `eidolon-api:rollback-*` tag. This happens under the
deployment lock and does not stop the running API. Docker's containerd image
store can otherwise lose an old image reference when a build replaces the shared
Compose tag, even while its container still runs. A missing image or conflicting
rollback tag aborts before building; recover the exact image before retrying.
Rollback tags are retained, not automatically deleted. Private `backups/` and
`logs/` are excluded from the Docker build context as well as Git.

For a save-format increase, the script runs `backup_before_upgrade.sh` after
preflight and before target startup. This stops the old API, archives its immutable
image and the complete `eidolon` Mongo database, and includes private pending
saves through a read-only mount of `logs/`. Archives, image identity and SHA-256
checksums are stored under private, git-ignored `server/backups/save-upgrade-*`
directories. A `COMPLETE` marker is written only after compression/checksum checks
and filesystem synchronization. An incomplete backup is retained, never treated
as a restore point. If backup fails before migration, the script attempts to
restart the unchanged previous API and aborts deployment. A fresh installation
without a previous API still backs up available data but has no previous image.

These local backups are not off-machine disaster recovery and have no automatic
retention deletion. Monitor disk capacity and copy verified recovery points to
durable off-machine storage using the deployment operator's approved process.
Same-format releases do not take this upgrade snapshot automatically. A manual
upgrade must also run the backup script after a successful preflight and before
`up -d`, with no concurrent deployment or game writer.

## Save-format upgrades and recovery

Alpha 1.0.56 is the schema-7 compatibility bridge. Deploy and verify it before
Alpha 1.0.57, the schema-8 resource/auction-persistence release. This
bridge alone does not deliver the resource-persistence feature.

- Deploy one release at a time through the ordered CI and live-verification gate.
  Keep the exact verified source commit/image for each supported recovery target.
  Do not run two character-writing API instances against the same database.
- Before a save-format upgrade, stop admission and allow the old API to shut down
  fully. Take a consistent backup of Mongo **and** the private `logs/` volume
  (including `character-saves/` when present) while no writer is running. Retain
  the release identity with that backup; neither pending saves nor transaction
  receipts may be discarded independently.
- Once schema 8 is recorded, the schema-7 bridge is **not** a rollback target.
  Its preflight refuses before replacing the running API, and its startup fence
  refuses before migrations or character writes. Releases before 1.0.56 do not
  contain these safeguards and are **unsupported** against upgraded saves.
- Recover by rolling forward to the verified schema-8 release or a tested fix
  that understands the same character resources, journals and auction receipts.
  A passing schema check is necessary, not proof that an arbitrary custom binary
  understands those contracts. Before publication, identify the exact supported
  schema-8 commit and validate its crash/replay behavior on an isolated copy.
- Never edit/delete migration markers to force an older writer to start. Do not
  delete journals, receipts, auction-operation records or Docker volumes to clear
  a startup error. Preserve the failing data and logs, keep the service unavailable
  if necessary, and repair with a compatible writer.
- Restoring an older backup is a separate, explicitly approved data-loss recovery:
  stop all writers and restore the matching Mongo/journal/release set together.
  It discards progress after that snapshot and is not a normal release rollback.
- Verify the recovered API's exact commit, database readiness, character resources
  (including zero mana), inventory, gold and pending market operations before
  reopening admission. Complete public client/server release-identity checks and
  real-input smoke tests; retain the recovery evidence in the release ledger.

## 3) Restore Mongo data from existing archive

**Destructive, Mongo-only legacy helper:** this runs `mongorestore --drop` and can
partially replace data even if it fails. Stop all game writers first and explicitly
approve the restore target and loss of subsequent progress. For schema-8 recovery,
do not use this helper alone: restore the corresponding private journal and use
the matching compatible server as described above. A local `COMPLETE` marker
checks archive integrity; it does not authorize a restore or prove that an
arbitrary image can read the saved format.

After explicit recovery approval, specify the exact archive and confirm the
loss of subsequent progress. There is no automatic archive selection:

```bash
./deploy/restore_mongo_archive.sh ./your_dump.archive.gz --confirm-data-loss
```

The helper checks gzip integrity, one running Compose Mongo container and that
the Compose API is stopped; it refuses running, paused, restarting or ambiguous
API state without stopping it. Operators must also stop any writers outside this
Compose project and prevent concurrent deployment/restart throughout recovery.
The guard is not a global database lock. It streams the selected archive on stdin,
limits restoration to `eidolon.*` and stops on restore errors. It does not copy
the archive to a container filename or execute the host `.env` as shell code.
Mongo credentials are expanded only inside the existing container. A successful
Mongo check does not restore journals, authorize admission or prove save-format
compatibility; keep writers stopped until the full recovery set is verified.

If restore fails due to auth mismatch on existing `mongo_data` volume, **do not run `docker compose down -v` unless explicitly confirmed**.

## 4) Nginx reverse proxy + TLS

Install prerequisites (Ubuntu/Debian example):

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Apply Nginx config and TLS:

```bash
sudo ./deploy/setup_nginx_tls.sh <your-domain> ${APP_HOST_PORT:-18082}
```

This runs:

- `nginx -t`
- `systemctl reload nginx`
- `certbot --nginx -d <your-domain>`
- `certbot renew --dry-run`

## 5) Final verification checklist

```bash
docker compose ps
docker compose logs --tail=200 api
ss -ltnp | grep -E ':(80|443|18082)\s'
curl -fsS https://<your-domain>/healthz
```

The deploy script injects `EIDOLON_BUILD_COMMIT` into the binary and fails unless `/healthz` reports that exact commit with `database: ready`. A root-path 404 is not a readiness signal.

Optional reboot resilience check:

```bash
sudo systemctl enable docker
sudo systemctl is-enabled docker
```
