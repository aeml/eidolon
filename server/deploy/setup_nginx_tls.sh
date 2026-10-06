#!/usr/bin/env bash
set -euo pipefail

# Pure argument validation is also sourced by tests; no installer runs on source.
validate_tls_setup_arguments() {
  if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    echo "Usage: setup_nginx_tls.sh <domain> [upstream_port]" >&2
    return 1
  fi
  local tls_domain="${1,,}" tls_port="${2:-18082}"
  tls_domain="${tls_domain%.}"
  if [ "${#tls_domain}" -gt 253 ] ||
    [[ ! "$tls_domain" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
    echo "Invalid DNS hostname; supply a domain without a URL, path or options." >&2
    return 1
  fi
  if [ "$tls_domain" = play.eidolonrealms.com ] || [ "$tls_domain" = server.eidolonrealms.com ]; then
    echo "These hosts require the additive dual-host setup in deploy/README_LINUX.md, section 4. Do not replace them with a single API proxy." >&2
    return 1
  fi
  if [[ ! "$tls_port" =~ ^[0-9]{1,5}$ ]] || (( 10#$tls_port < 1 || 10#$tls_port > 65535 )); then
    echo "Invalid upstream port; expected an integer from 1 to 65535." >&2
    return 1
  fi
  printf '%s %s\n' "$tls_domain" "$((10#$tls_port))"
}

if [ "${BASH_SOURCE[0]}" != "$0" ]; then
  return 0
fi

tls_arguments="$(validate_tls_setup_arguments "$@")" || exit 1
read -r DOMAIN UPSTREAM_PORT <<< "$tls_arguments"

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

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
