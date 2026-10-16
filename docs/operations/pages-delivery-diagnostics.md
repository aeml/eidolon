# Pages delivery diagnostics

This is repository preparation. Publishing these files does not alter an
existing host. The installed game site is root-owned and the available SSH
account's noninteractive sudo requires a password. Host activation needs an
administrator, after reviewing the tested configuration below.

The retained Alpha59 observer-script408 is independently present in the proxy
access log: October16 03:58:46UTC, source`d1a04f16be07ac53e622e24aac9137a16d68a170`,
11624response bytes. The same exact source/path has12successful200records. No
matching error-log record was found in the current/previous files. Default
combined logs do not contain upstream status/timing or a response correlation
ID, so this does not establish the cause or declare it repaired. The inspection
retained only allowlisted public-asset aggregates; no raw log lines, client
addresses, agents, referrers or private query values were copied.

The new frontend format records time, a random per-request ID, method, normalized
path, a strictly40lowercase-hex public release identity, downstream status/bytes,
upstream status/connect/header/response time, request time and cache outcome.
It omits raw request/query data, client addresses, agents, referrers, cookies,
authorization and bodies. JSON escaping preserves quoted/backslashed paths.
The response's `X-Eidolon-Delivery-ID` matches the log even for errors.

The frontend's server-level access log overrides inherited combined logging for
that site. Other sites and the backend WebSocket configuration are unchanged.
This is access-log minimization, not a claim that Nginx error logs, upstream
providers, mail or all operational data have been redacted. The existing
invitation/recovery producers already use fragments, which browsers do not send
as HTTP query strings; their early scrub/analytics handling remains unchanged.
Malformed query links still fail closed in the existing client.

Sources: [Nginx access/log format](https://nginx.org/en/docs/http/ngx_http_log_module.html),
[request ID](https://nginx.org/en/docs/http/ngx_http_core_module.html#var_request_id),
[upstream variables](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#variables).

## Private validation

From the repository root, with Go1.27.2 and local Nginx installed, run as an
ordinary user:

```bash
GOTOOLCHAIN=go1.27.2 go run scripts/verify-pages-upstream-tls.go
```

This starts one temporary unprivileged loopback Nginx with synthetic certificates
and queries. It checks eight configured/insecure-control certificate cases plus
five delivery cases, with14requests including readiness. It verifies query
omission, public release filtering, JSON escaping, unique response/log IDs,
upstream408 attribution and absence of inherited combined frontend records.
It stops its own process and removes temporary files. It never reloads a host
service or contacts production. The original secure Alpha62 template intentionally
fails the five new delivery cases while its eight certificate cases still pass.

## Existing-host activation

Do not reinstall the HTTP template over the installed HTTPS/Certbot site. From
the reviewed repository root, the administrator first backs up the current site:

```bash
delivery_backup_dir=$(sudo mktemp -d /var/backups/eidolon-delivery.XXXXXX)
sudo cp -a /etc/nginx/sites-available/eidolonrealms.conf "$delivery_backup_dir/site.conf"
printf 'Backup: %s\n' "$delivery_backup_dir"
```

If `/etc/nginx/conf.d/eidolon-delivery.conf` already exists or is a symlink,
inspect it and save its current contents/ownership in the backup directory
before proceeding. Do not overwrite another operator's configuration unseen.
The new file contains only the two uniquely named map/log-format definitions:

```bash
sudo install -m 644 server/deploy/nginx/eidolon-delivery-http.conf /etc/nginx/conf.d/eidolon-delivery.conf
sudoedit /etc/nginx/sites-available/eidolonrealms.conf
```

Add these two directives at the **server level of the existing HTTPS frontend**
for `play.eidolonrealms.com`, outside `location` blocks:

```nginx
access_log /var/log/nginx/eidolon-delivery.log eidolon_delivery;
add_header X-Eidolon-Delivery-ID $request_id always;
```

Inspect that frontend's existing `access_log`/`add_header` directives and any
location overrides first; preserve unrelated security headers, Certbot settings,
cache, routing and the backend. Do not leave a second frontend access-log
directive that still writes raw combined requests. If a child location has its
own headers/logging, reconcile that inheritance explicitly before validation.
Apply [upstream certificate verification](pages-upstream-tls.md) separately if
it is still pending; this logging change does not enable that setting.

```bash
sudo nginx -t && sudo systemctl reload nginx
curl --fail --silent --show-error --dump-header /tmp/eidolon-delivery-headers https://play.eidolonrealms.com/release.json
curl --fail --silent --show-error https://server.eidolonrealms.com/healthz
```

Check the current accepted frontend/backend identities, ready database, one
32hex response ID and its matching new JSON log row. The agent can perform
read-only verification after actual activation. An unchanged healthy response
without the new header does not prove activation.

The inspected host's existing `/var/log/nginx/*.log` rotation covers the new
filename: daily,14rotations, compression/delayed compression and0640www-data:adm
creation. Confirm this remains true before activating; no retention promise or
policy change is inferred. Do not delete, export or rewrite historical combined
logs or unrelated services' logs as part of this change.

If validation fails, do not reload. Restore the backed-up site and original
format file; if this procedure created the format file, remove only that new
file. Revalidate. If reload or postchecks fail, restore/revalidate/reload the
previous configuration and retain the failure/new diagnostic log. No DNS,
certificates/keys, account policy, game database or other service changes.
