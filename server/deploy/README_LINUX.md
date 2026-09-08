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

If archive is in `server/` root:

```bash
./deploy/restore_mongo_archive.sh
```

Or specify exact path:

```bash
./deploy/restore_mongo_archive.sh ./your_dump.archive.gz
```

Restore command used in container:

```bash
mongorestore --drop --gzip --archive=/tmp/<archive_name> --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin
```

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
