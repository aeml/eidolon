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

Manual equivalent commands:

```bash
docker compose build api
docker compose up -d
docker compose ps
docker compose logs --tail=100 api
curl -fsS http://127.0.0.1:${APP_HOST_PORT:-18082}/healthz
```

## 3) Restore Mongo data from existing archive

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
