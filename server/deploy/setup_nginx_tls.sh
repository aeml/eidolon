#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 <domain> [upstream_port]" >&2
  exit 1
fi

DOMAIN="$1"
UPSTREAM_PORT="${2:-18082}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE="${SERVER_DIR}/deploy/nginx/eidolon.conf.template"
NGINX_CONF="/etc/nginx/sites-available/eidolon.conf"
ENABLED_LINK="/etc/nginx/sites-enabled/eidolon.conf"
CERT_FULLCHAIN="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
CERT_PRIVKEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

if [ ! -f "${TEMPLATE}" ]; then
  echo "Template missing: ${TEMPLATE}" >&2
  exit 1
fi

echo "Checking listeners on ports 80 and 443..."
ss -ltnp | grep -E ":(80|443)\\s" || true

for port in 80 443; do
  current_owner="$(ss -ltnp | awk -v p=":${port}" '$4 ~ p {print $0}')"
  if [ -n "${current_owner}" ] && ! echo "${current_owner}" | grep -q "nginx"; then
    echo "Port ${port} is occupied by a non-nginx process:" >&2
    echo "${current_owner}" >&2
    echo "Perform safe handoff manually before continuing." >&2
    exit 1
  fi
done

mkdir -p /var/www/certbot

if [ ! -f "${CERT_FULLCHAIN}" ] || [ ! -f "${CERT_PRIVKEY}" ]; then
  echo "No existing cert found for ${DOMAIN}. Bootstrapping HTTP-only nginx config..."
  cat > "${NGINX_CONF}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:${UPSTREAM_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
    }
}
EOF
  ln -sf "${NGINX_CONF}" "${ENABLED_LINK}"
  nginx -t
  systemctl reload nginx
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "certbot is not installed. Install it then rerun this script." >&2
  exit 1
fi

echo "Requesting/renewing TLS certificate via certbot nginx plugin..."
certbot --nginx -d "${DOMAIN}"

sed -e "s/__DOMAIN__/${DOMAIN}/g" -e "s/127.0.0.1:18082/127.0.0.1:${UPSTREAM_PORT}/g" "${TEMPLATE}" > "${NGINX_CONF}"
ln -sf "${NGINX_CONF}" "${ENABLED_LINK}"
nginx -t
systemctl reload nginx

echo "Validating certificate auto-renewal..."
certbot renew --dry-run

echo "Nginx + TLS setup complete."