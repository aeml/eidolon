# Pages upstream certificate verification

The game frontend at `play.eidolonrealms.com` proxies GitHub Pages through
`aeml.github.io`. Its outgoing TLS connection must validate that peer with the
host's normal CA bundle. SNI and the HTTP Host header are separate existing
routing settings; keep both unchanged.

The repository template now specifies:

```nginx
proxy_ssl_server_name on;
proxy_ssl_name aeml.github.io;
proxy_ssl_verify on;
proxy_ssl_verify_depth 3;
proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
proxy_set_header Host play.eidolonrealms.com;
```

[Nginx documents](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify)
upstream verification as disabled by default. The normal CA bundle authenticates
the fixed upstream name; it does not change the browser's public certificate or
add a private CA. This change does not resolve the earlier HTTP408/shard-abort
findings, and does not alter DNS, timeout, cache or backend WebSocket policy.

## Qualify the template locally

Run as an ordinary user from the repository root with Go and Nginx installed:

```bash
GOTOOLCHAIN=go1.27.2 go run scripts/verify-pages-upstream-tls.go
```

The checker starts a separate temporary Nginx on private loopback ports, using
synthetic certificates and a fixture CA. It verifies valid, untrusted, expired
and wrong-name peers, plus an explicit insecure control. It also checks that SNI,
Host, asset path and escaped release query survive the proxy. It does not reload
the host service, use a real account or send public traffic. Its certificate
files and processes retire on exit. This is a bounded correctness check, not a
capacity or soak test.

## Existing host activation

The additive HTTP template is for fresh domain setup. **Do not replace the
installed HTTPS/Certbot configuration with that template.** Change only the
existing game frontend's HTTPS proxy location.

On October16, read-only inspection found no upstream verification/CA override in
the game site or readable inherited settings. The live CA preflight validates
`aeml.github.io` successfully with depth3 and the system bundle. The active site
points to `/etc/nginx/sites-available/eidolonrealms.conf`, owned by`root:root`
with mode0644. Noninteractive SSH `sudo -n true` requires a password, so the agent
has not activated the host setting. A host administrator must perform this step.

In an administrator's SSH session, record a unique backup before editing:

```bash
tls_backup_path=$(sudo mktemp /var/backups/eidolon-pages-tls.XXXXXX)
sudo cp /etc/nginx/sites-available/eidolonrealms.conf "$tls_backup_path"
printf 'Backup: %s\n' "$tls_backup_path"
sudoedit /etc/nginx/sites-available/eidolonrealms.conf
```

Immediately after the existing `proxy_ssl_name aeml.github.io;` in the frontend
proxy location, add only these three lines:

```nginx
proxy_ssl_verify on;
proxy_ssl_verify_depth 3;
proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
```

Validate before reloading, then check both game endpoints with normal TLS:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl --fail --silent --show-error https://play.eidolonrealms.com/release.json
curl --fail --silent --show-error https://server.eidolonrealms.com/healthz
```

Both identities must retain the accepted app source/version and the database
must remain ready. The agent can recheck the installed directives and public
assets afterward. Root activation is an outstanding operational requirement;
merging the template alone does not enable it or complete the security gate.

If validation fails, do not reload. Restore the recorded game-site backup and
validate again:

```bash
sudo cp "$tls_backup_path" /etc/nginx/sites-available/eidolonrealms.conf
sudo nginx -t
```

If a reload or post-check fails, restore the same backup, validate it and reload
that restored configuration. Retain the failure and backup path for diagnosis.
No database, application binary, other virtual host or certificate-key change is
part of this operation.
