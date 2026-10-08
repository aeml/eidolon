# Eidolon Linux Deployment (Mendola-style)

This deploys:

- Go API in Docker
- MongoDB in Docker with auth + persistent volume
- Nginx on host (ports 80/443) reverse-proxying to API on localhost upstream port
- TLS via Certbot Nginx flow

## Incident and maintenance playbook (prepared 1.83)

This is an operator procedure, not an automatic maintenance switch. Production
state, access, DNS, provider configuration and retention are unchanged. The
deployment operator (`aeml`) owns incident coordination and any privileged
host action; an agent may inspect bounded public health and safe aggregate
diagnostics, but must not improvise destructive recovery. Confirm a backup
operator and alternate contact before beta; neither is assigned by this document.

For each incident, retain UTC start time, affected surface, exact deployed
client/server commit, last successful readiness check, a secret-free symptom,
actions taken and the next update time. Keep the private recovery evidence
outside Git/public reports. Do not attach `.env`, account exports, recovery
links, bearer tokens, raw request bodies or unredacted production logs.

Start with bounded read-only checks from the **actual installed server
directory**, not a runner checkout or unrelated Compose project:

```bash
docker compose ps
curl --connect-timeout 2 --max-time 5 -fsS http://127.0.0.1:${APP_HOST_PORT:-18082}/healthz
curl -4 --connect-timeout 2 --max-time 5 -fsS https://server.eidolonrealms.com/healthz
curl -4 --connect-timeout 2 --max-time 5 -I https://play.eidolonrealms.com/
df -h .
df -i .
```

Stop after a failed check and classify it before making changes. `curl -I`
proves HTTP reachability, not runtime assets, login or combat. IPv4 checks do
not validate advertised IPv6: that remains a separate owner-managed issue.
Inspect only bounded, locally reviewed log excerpts when necessary. Readiness
must include the database and exact expected commit; process/container uptime
alone is not recovery. Do not run repeated login attempts or money-changing
commands to diagnose an unavailable dependency.

| Scenario | Safe investigation and containment | Stop/escalation and recovery proof |
| --- | --- | --- |
| Degraded database | Compare local/public readiness and Compose state. Preserve pending save/audit/custody journals and inspect only aggregate queue/error signals when available. Suspend further deployments and avoid new mutation tests. | Escalate to `aeml` on unavailable storage, refused admission or persistent pending work. Do not increase timeouts, erase journals or report success from a running API. Compatible dependency recovery must drain original work without duplicate rewards before normal login resumes. |
| Unavailable origin | Separate frontend, public backend and loopback API responses. Check the exact CI/deployment result and deployed identity. Request operator Nginx/TLS/DNS inspection if loopback is healthy but public access fails. | Do not recreate Mongo, reset accounts or roll back data for a proxy/DNS failure. Do not bypass TLS verification. Recovery requires public HTTPS, runtime-asset identity and ordinary WebSocket/login checks; an IPv4 pass is not an IPv6 pass. |
| Abuse burst | Inspect bounded connection/admission refusal and diagnostic-suppression counts. Retain existing limits and distinguish a household/proxy peer from an authenticated account. | Escalate sustained resource pressure to `aeml` for an explicitly approved edge action. No automatic account bans, broad IP bans, limit increases or deletion of durable audit. Verify ordinary reconnect/keepalive behavior after containment. |
| Stuck casino/market settlement | Record game family, deployed commit and aggregate pending/error counts privately. Let the existing bounded retry pass recover its original saved operation. | Stop repeated wager/buy/refund attempts. Never grant compensating Gold/EP or clear receipts as a diagnostic shortcut. Escalate persistent pending work; validate the same operation settles once, independent wallet reload and reopen/restart without another debit/payout. |
| Storage exhaustion | Inspect free bytes and inodes for the installed logs/backups and Docker storage filesystems. Preserve complete and incomplete recovery points and pending journals. | Refused durable writes/readiness are stop conditions, not reasons to disable durability. Do not prune volumes, receipts, journals or backups automatically. `aeml` approves exact disposable targets or added storage; verify writable journal, backlog recovery and independent saved state before reopening. |
| Planned maintenance / failed upgrade | Coordinate an announcement, freeze competing deploys and identify the exact source/image/schema and consistent recovery set. Use the existing deployment lock and fail-closed preflight/backup path. | On any preflight, journal, backup, host-key or health failure, stop. Do not run `up -d` to override refusal. The previous image is not a valid data rollback after a schema upgrade; use a verified compatible forward fix or separately approved matching-set data-loss recovery. |

### Player communication and reopening

For planned work, the operator posts a short notice on an already available
player-facing surface before the window, and an update at the stated next
update time if it overruns. For an outage, state the verified affected surface
and avoid asserting a cause or saved-progress guarantee that has not been
checked. Do not invent an ETA: communicate the next update time instead.

Suggested initial notice: "Eidolon maintenance starts [UTC time]. [Affected
feature] may be unavailable. Please finish active encounters and wagers before
then. Next update: [UTC time]." Outage notice: "We are investigating [verified
symptom]. Please avoid repeated purchases or wagers. Next update: [UTC time]."
Recovery notice follows verification: "[Affected service] is available again
on [version/commit]. [Known limitations]. Please report continuing issues using
the in-game report tool when available."

The staged in-game route is **Administration → Maintenance and incident notices**.
Choose maintenance, incident update or recovery; enter plain public text (up to
220 UTF-8 bytes) and a future UTC next-update time within 24 hours. Recovery may
omit the next-update time. Review the exact copy, then explicitly send it.
Current durable administrator authority and acknowledged activity storage are
required, with authority checked again after the audit write. The exact public
copy/kind/time are recorded using existing activity retention; no account identity
is included in public server chat. No maintenance mode, restart, email or player
mutation is performed. A three-token burst budget refilling over one minute per
authenticated connection bounds the route; review does not submit a request.

Queue acknowledgement is not delivery to every player, and history's success row
explicitly records **admission only**. If acknowledgement is missing, check server
chat and Activity history before preparing another notice; the UI does not retry
automatically. The transient notice is not replayed to players logging in later.
Do not claim that a disconnected player saw an in-game notice. An always-reachable
external status/contact destination still needs owner selection; the in-game tool
cannot reach players during an origin outage. This staged route is not live or
a substitute for operator coverage, tabletop exercises and ordered acceptance.
No public email, account message or announcement is sent by these instructions.

Reopening requires the exact expected server/client identities and ready
database, private pending-work recovery, normal login/reconnect and a relevant
ordinary-input smoke check. Reuse accepted scope-matched evidence when unchanged;
exercise only the incident-invalidated path. Wallet/custody incidents additionally
require independent saved balances/items and no duplicate settlement. Data
restoration also requires review of removal requests and matching private journals,
not just a Mongo restore. Record unresolved limitations and the operator's
reopening decision. Never equate a green narrow test with complete campaign,
100-player capacity, off-machine disaster recovery or final beta signoff.

Before this milestone is accepted, perform and retain tabletop outcomes for all
six rows, targeted safe failure/recovery exercises on explicitly disposable
fixtures, the actual notice/reopening route and named operator coverage. No
live database outage, disk filling, abuse flood or destructive restore is
authorized to satisfy that gate.

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
- `EIDOLON_WS_MAX_CONNECTIONS` (prepared1.72; optional, defaults to512; whole number1–4096)

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
player/login restriction. File records stay within the same shared process
budget independently of that peer stdout sampling.
Disabling the peer cooldown does not disable that shared budget. These limits
do not rotate existing logs, impose a disk quota, bound other logger categories
or replace edge protection; retention and hosting work remain later gates.
No deployed configuration or old log file is changed by preparation. This is
not live until the ordered1.72 release and acceptance pass.

Unexpected WebSocket read errors also use this same noisy-diagnostic budget.
They record only error type, close code, timeout classification and suppression
count. Close reasons and error text are omitted, so peer-controlled text cannot
forge lines or copy secrets into that route. Useful error categories remain;
ordinary application errors and durable account/admin audit are not sampled by
this helper. It is not a disk quota or a review of every logging category.

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

Prepared1.72 also adds `-ws-max-connections` (Compose reads
`EIDOLON_WS_MAX_CONNECTIONS`) to bound simultaneous upgrades plus complete
WebSocket transport lifetimes. Failed upgrades release their slot; successful
ones hold it until the reader closes the connection and hands retirement to the
hub, including anonymous sockets. Readers waiting on retirement retain their
slot, preventing reconnect traffic accumulating unbounded queued readers.
At the limit, new upgrades receive HTTP503 with `Retry-After: 1`, not an account
ban. The default512 is a process resource ceiling, not a measured512-player
capacity or beta admission promise. No role, IP or forwarding claim bypasses it.
Closing a socket restores its slot exactly once. Do not raise the limit without
measured memory/tick/database/network headroom. It does not bound pre-header TCP
connections, handshake attempts per second, upstream bandwidth or prevent an
attacker occupying the available slots; edge protection and workload validation
remain separate.

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

The prepared1.79.1 deployment checks available space on both the server-checkout
filesystem and Docker's actual `DockerRootDir`, before source cleanup, image
tagging/builds, database preparation or service replacement. The default floor
is2048MiB. `EIDOLON_DEPLOY_MIN_FREE_MIB` accepts a positive decimal1–999999;
missing or blank uses the default. Unknown storage, failed/malformed readings,
invalid settings or insufficient space refuse deployment without replacing the
current services. Paths with spaces are supported. The guard does not delete
anything, change alert thresholds or prove peak build/backup requirements.
Check storage and obtain explicit scoped cleanup approval when needed; do not
lower the floor just to bypass a nearly full disk. Database/image backups and
other projects remain outside automatic cleanup.

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
Before an upgrade backup may stop the old API, the script requires the complete
single-line schema receipt from the requested build commit, with valid bounded
schema numbers and a target that supports the current database. Missing, noisy,
duplicate, mismatched-build or contradictory receipts abort without requesting
backup or replacing the API. This is not a global writer lock or a substitute
for the compatible binary's independent startup fence.
Database failure also aborts deployment. Normal startup repeats the compatibility
check. Starting with 1.0.57, the script holds `logs/deploy.lock` to refuse another
deployment through this script while it is active. Manual/older deployment tools
do not share that protection and must not run concurrently.

Deployment health probes have a two-second connection deadline and five-second
total request deadline, with at most 30 attempts and two-second retry pauses.
They still require the exact build commit and ready database; a stalled response
cannot hold one attempt indefinitely. CI's public client/runtime/server identity
wait uses the same request deadlines, a five-minute elapsed wait (plus at most
one bounded probe batch), and an outer six-minute Actions step limit. These are
release-check bounds, not game-session timeouts or a fix for stale DDNS/IPv6.

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

Prepared Alpha1.73 advances the currently accepted schema17 to schema22 for
durable trade/drop/reward custody. The focused disposable-Mongo
`TestSchema17UpgradePreservesAccountsAndFencesPreviousWriter` verifies unchanged
legacy documents/indexes, empty new ledgers, repeated-startup stability and
refusal by the exact previously deployed schema17 executable. See
[upgrade evidence](../../docs/plans/2026-10-04-release1-73-schema17-upgrade-checks.json).
It requires explicit disposable-database, loopback and previous-binary gates;
the ordinary unit suite skips it without that configuration. This is not a
production migration or complete valuable-operation replay certificate.
Once schema22 is recorded, a pinned schema17 image cannot safely write it.
Use a tested compatible forward fix; restoring an older recovery set is a
separate approved data-loss action with all writers stopped and matching
Mongo, private journals and image. Never delete migration markers to bypass
the fence. The release is still unassembled and unpublished.

Alpha 1.0.56 is the schema-7 compatibility bridge. Deploy and verify it before
Alpha 1.0.57, the schema-8 resource/auction-persistence release. This
bridge alone does not deliver the resource-persistence feature.

- Deploy one release at a time through the ordered CI and live-verification gate.
  Keep the exact verified source commit/image for each supported recovery target.
  Do not run two character-writing API instances against the same database.
- Unpublished1.75 introduces schema23's marker-only account-bound character
  journals. Normal producers require the loaded account ObjectID and write
  version2. Startup refuses legacy pending records **before** Mongo initialization
  or migration; it never guesses ownership, rewrites or deletes them. Reconcile
  pending work using its original matching server/Mongo recovery point, complete
  graceful shutdown, and preserve the coordinated Mongo/journal/image backup.
  Stop an upgrade if legacy refusal persists; do not erase files to get online.
  Once schema23 is recorded, a schema22 image cannot safely roll back this writer.
  During an upgrade to schema23 or newer, deployment additionally runs the
  target's `--check-save-journal` against a read-only mounted log directory after
  the old API's graceful stop and consistent backup, but before migration or
  target startup. A missing journal is valid for a fresh installation; legacy,
  corrupt or linked records are refused without replay, rebinding or deletion.
  Only the exact target's bounded success receipt permits replacement. On
  refusal, a previously running old container is restarted unchanged; an
  already-stopped old service is not started. Backups and pending files remain.
  No account erasure or retention change is enabled. Prepared later storage
  migrations must be renumbered after23 before integration.
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

**Destructive, Mongo-only recovery helper:** stop all game writers first and
explicitly approve the exact target, selected recovery set and loss of subsequent
progress. After any save-format change, do not use this helper alone: restore the
corresponding private journals and use a matching compatible server as described
above. This includes pending market decisions and the newer ground/casino
checkpoints. A `COMPLETE` marker records backup completion, not current integrity;
verify its `SHA256SUMS` before recovery. Neither marker nor checksums authorize a
restore or prove that an arbitrary image can read the saved format.

After explicit recovery approval, specify the exact archive and confirm the
loss of subsequent progress. The default requires an empty `eidolon` database,
such as an isolated restoration target. There is no automatic archive selection:

`--confirm-privacy-and-journal-plan` separately acknowledges that the operator
has reviewed removal decisions retained outside the selected old archive, any
shared custody/replay obligations, provider/archive copies and the matching
private journals/server. This is an operator attestation, not a tested automated
anti-resurrection mechanism. Case resolution is not proof of erasure. No account
removal command is enabled; before any individually authorized removal is ever
implemented, durable writer/journal/restore fences must also be implemented and
verified. Do not reopen recovered data containing accounts that were separately
removed, blindly replay a pre-removal journal, or use an old backup as the only
source of removal decisions. A successful restore does not fulfill a privacy
request or change retention.

```bash
./deploy/restore_mongo_archive.sh ./your_dump.archive.gz --confirm-data-loss --confirm-privacy-and-journal-plan
```

Mongo's `--drop` only replaces collections contained in the archive, leaving
later-created collections behind. An older recovery set must not silently inherit
newer operation ledgers. [MongoDB restore documentation](https://www.mongodb.com/docs/database-tools/mongorestore/)

For an approved in-place replacement of a **non-empty** target, additionally
confirm replacement of the entire fixed `eidolon` database:

```bash
./deploy/restore_mongo_archive.sh ./your_dump.archive.gz --confirm-data-loss --confirm-privacy-and-journal-plan --replace-eidolon-database
```

That explicit mode removes every prior `eidolon` collection before importing the
archive; other databases are not replacement targets. It can lose all prior game
data even if the later restore fails. Preserve the original recovery set, keep
writers stopped and follow the recovery plan; do not delete Docker volumes or
migration markers as a workaround. A successful Mongo restore is not an image
rollback or a journal restore.

The helper checks gzip integrity, one running Compose Mongo container and that
the Compose API is stopped; it refuses running, paused, restarting or ambiguous
API state without stopping it. Operators must also stop any writers outside this
Compose project and prevent concurrent deployment/restart throughout recovery.
The guard is not a global database lock. A read-only collection probe and archive
dry-run precede destructive commands; a failed probe/dry-run refuses writes.
Dry-run does not guarantee that later BSON, index or IO processing cannot fail.
The helper streams the selected archive on stdin,
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

For a **new, custom single-host API installation only**, apply Nginx config
and TLS. This generic installer writes `sites-available/eidolon.conf`; do not
use it to replace an existing shared/multi-host configuration.
It refuses any existing configuration or enabled-link target, including a
dangling symlink, before filesystem, certificate or reload actions. Install
Certbot first; a missing executable is refused before the HTTP bootstrap writes.
Certificate requests and renewal dry-runs are scoped to the supplied custom
hostname's certificate, not unrelated certificates on the shared machine.
If a fresh installation stops after writing its bootstrap configuration,
preserve those files and inspect the failure before an operator completes the
setup manually. Do not bypass the existing-target guard or delete working
configuration merely to make the installer run again.

```bash
sudo ./deploy/setup_nginx_tls.sh <your-domain> ${APP_HOST_PORT:-18082}
```

This runs:

- `nginx -t`
- `systemctl reload nginx`
- `certbot --nginx --cert-name <your-domain> -d <your-domain>`
- `certbot renew --dry-run --cert-name <your-domain>`

### Canonical two-host installation

`play.eidolonrealms.com` serves the browser client through GitHub Pages;
`server.eidolonrealms.com` proxies the API/WebSocket server on loopback18082.
The generic installer rejects both names (including case/trailing-dot variants)
before any privileged or filesystem work: pointing the frontend at the API
would return a404 rather than load the game. Use the additive dual-host file,
not the single-host template. Never overwrite an installed
`eidolonrealms.conf` or remove the older `eidolon.conf` as a migration shortcut.

On a **fresh canonical installation only**, from `server/`:

```bash
sudo test ! -e /etc/nginx/sites-available/eidolonrealms.conf && \
sudo test ! -L /etc/nginx/sites-available/eidolonrealms.conf && \
sudo test ! -e /etc/nginx/sites-enabled/eidolonrealms.conf && \
sudo test ! -L /etc/nginx/sites-enabled/eidolonrealms.conf && \
sudo install -m 644 deploy/nginx/eidolonrealms-http.conf /etc/nginx/sites-available/eidolonrealms.conf && \
sudo ln -s /etc/nginx/sites-available/eidolonrealms.conf /etc/nginx/sites-enabled/eidolonrealms.conf && \
sudo nginx -t && \
sudo systemctl reload nginx && \
sudo certbot --nginx --redirect --cert-name play.eidolonrealms.com -d play.eidolonrealms.com -d server.eidolonrealms.com && \
sudo nginx -t && \
sudo systemctl reload nginx && \
sudo certbot renew --dry-run --cert-name play.eidolonrealms.com
```

These commands deliberately stop if either target already exists. For the
current installed service, **do not reinstall or run that chain**. Inspect its
existing configuration and use `sudo nginx -t`, `systemctl status certbot.timer`
and an operator-approved
`sudo certbot renew --dry-run --cert-name play.eidolonrealms.com` instead. Verify
the installed certificate name first; do not rename an existing lineage merely
to match this example. A waiting
enabled timer, or a successful no-op renewal service, does not prove a future
ACME challenge will succeed. HTTP challenge reachability and DNS/proxy behavior
still need validation; stop on authentication failure rather than repeatedly
replacing working Nginx configuration.

Keep the frontend upstream TLS name `aeml.github.io` and HTTP Host
`play.eidolonrealms.com`, matching the Pages custom domain. Preserve complete
paths/release queries, backend HTTP1.1 Upgrade/Connection headers and its idle
WebSocket timeout. The supplied frontend resolver is specific to a host using
systemd-resolved on127.0.0.53; adapt it deliberately for another server. Its
`ipv6=off` affects only that outbound Pages lookup, **not** browsers or public
AAAA records. Both public address families must reach this Nginx server before
claiming dual-stack support. The owner's deferred IPv6/DDNS work is not fixed
by these instructions or a successful IPv4 smoke.

### Environment separation and restart boundaries

The committed Compose file names its default stack `eidolon`. A separate Git
worktree alone does **not** isolate that stack. A staging installation must have
an explicit different Compose project name, a different loopback host port,
its own private `.env`, Mongo volume and `server/logs/` directory (including
character-save/activity outboxes). Never point staging at production Mongo or
copy production journals, mail tokens, accounts or admin bootstrap values into
a load fixture. Compose project naming can be overridden with
`COMPOSE_PROJECT_NAME`, which must remain consistent for every command and
deployment helper. An example name is `eidolon-staging`, not a production alias.
Confirm the effective project, volume names, bind mounts and loopback port with
an operator before starting it; do not paste `docker compose config` output into
chat or public logs because expanded credentials can appear there.

No permanent staging stack is installed by these instructions. Existing native
QA instead uses explicitly labelled disposable Mongo, unique loopback ports,
synthetic accounts and separate temporary journals. Do not use a new project
name as permission to restore player data or delete volumes. Custom staging
browser origins also require a deliberate server allowlist change; the current
canonical hosts and localhost are not a wildcard-origin policy.

Docker services use `restart: unless-stopped`; API shutdown has a60-second grace
period. This is process restart configuration, not guaranteed recovery during a
host outage. A manually stopped container remains stopped after a host reboot.
Docker and nginx must be enabled, Mongo must become healthy, schema preflight
and journal recovery must succeed, and the exact public release/ready checks
must pass. Keep the current private `logs/` and Mongo volume across updates;
never repair startup by clearing receipts/outboxes or running `down -v`.
Disruptive reboot/recovery rehearsals require their own maintenance approval.

### Isolated proxy regression check

From `server/`, with the `nginx` executable available:

```bash
GOTOOLCHAIN=go1.27.1 GOMAXPROCS=2 go test -p 2 -race . \
  -run '^Test(TLSSetup|CanonicalNginxProxy|MigrationOrigins)' -count=1 -timeout=35s
```

The native proxy check starts only its own foreground, single-process Nginx on
a temporary loopback port. It loads the committed canonical backend block with
only listen/upstream addresses substituted, not `/etc/nginx/nginx.conf`. It
verifies complete HTTP paths/release queries, forwarding headers, actual
production WebSocket Origin admission/refusal, exact binary frames and normal
close handshakes. It terminates and joins its own process afterward. No root,
installed configuration, system service, public listener or Certbot is involved.
If Nginx is absent the test explicitly skips; that is not proxy evidence.
This short HTTP fixture does not prove HTTPS renewal, the frontend Pages
upstream, hour-long idle connections, public IPv6 or production capacity.

## 5) Final verification checklist

```bash
docker compose ps
docker compose logs --tail=200 api
ss -ltnp | grep -E ':(80|443|18082)\s'
curl -fsS https://<your-domain>/healthz
```

The deploy script injects `EIDOLON_BUILD_COMMIT` into the binary and fails unless `/healthz` reports that exact commit with `database: ready`. A root-path 404 is not a readiness signal.

Alpha1.78 adds an explicitly opt-in independent monitor. The owner approved
existing self-hosting/admin Postmark recipients and 30s polling, three failures,
two recoveries and 30m outage reminders. Set `EIDOLON_MONITOR_ENABLED=true` only
after approving those settings. The deployment script builds and locally validates
its exact command before API replacement, then starts/updates it after readiness.
It uses Linux host-loopback networking and the host's existing persistent journal;
it does not observe whole-host/public-network failure or alter shared log policy.
To disable an already running monitor, set the flag false **and** explicitly stop
only `monitor`; a flag change alone is not a stop command. See the
[monitor operator guide](../cmd/monitor/README.md) for scope, inspection and
reversible pause commands. Never print private Compose/environment configuration.

Prepared optional public observations use paired
`EIDOLON_MONITOR_PUBLIC_FRONTEND_URL=https://play.eidolonrealms.com/release.json`
and `EIDOLON_MONITOR_PUBLIC_BACKEND_URL=https://server.eidolonrealms.com/healthz`.
Both blank preserves local-only behavior. These exact HTTPS paths cannot include
credentials, query strings or fragments. The existing local-only configuration
preflight validates the exact mapped monitor command before API replacement;
it makes no probe or email request. No public settings are enabled by this
preparation. Match the accepted binary/Compose artifact, qualify deployment
identity transitions, and obtain operator approval before enabling. Clearing
both settings and recreating only the monitor reverses public observation; no
API/Mongo stop or player/log retention change is required. This same-host probe
is not browser execution or off-machine/whole-host coverage.

Optional reboot resilience check:

```bash
sudo systemctl enable docker
sudo systemctl is-enabled docker
```
