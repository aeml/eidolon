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

sed -e "s/__DOMAIN__/${DOMAIN}/g" -e "s/127.0.0.1:18082/127.0.0.1:${UPSTREAM_PORT}/g" "${TEMPLATE}" > "${NGINX_CONF}"
ln -sf "${NGINX_CONF}" "${ENABLED_LINK}"

nginx -t
systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1; then
  echo "certbot is not installed. Install it then rerun this script." >&2
  exit 1
fi

echo "Requesting/renewing TLS certificate via certbot nginx plugin..."
certbot --nginx -d "${DOMAIN}"

echo "Validating certificate auto-renewal..."
certbot renew --dry-run

echo "Nginx + TLS setup complete."