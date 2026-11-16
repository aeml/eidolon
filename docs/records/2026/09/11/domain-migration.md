# Eidolon Realms domain migration

Requested September 11. New game: `https://play.eidolonrealms.com`.
New backend: `wss://server.eidolonrealms.com/ws`; health at
`https://server.eidolonrealms.com/healthz`.

## Preserve the current hosting architecture

Inspected `/etc/nginx/sites-available/eidolon.conf`: the old frontend proxies
GitHub Pages (`aeml.github.io` with the custom-domain Host), and the old backend
proxies `127.0.0.1:18082`. GitHub Pages reports its custom domain as
`eidolon.mendola.tech`. The new public website in `website/` is separately
configured for Cloudflare Pages; do not replace its apex/www configuration.

Add the two new hosts to this same Nginx machine. Keep the old host blocks and
certificates, GitHub Pages custom domain and SSH deployment address unchanged.
The new frontend proxy deliberately sends `Host: eidolon.mendola.tech` to Pages
while visitors retain `play.eidolonrealms.com` in their browser. Do not change
GitHub's custom domain without also revisiting this upstream routing.

**Do not use the old `setup_nginx_tls.sh` for this migration:** it overwrites
the shared `eidolon.conf`, which currently contains both production domains.

## Operator steps: DNS, Nginx and TLS

1. Set A records `play` and `server` in `eidolonrealms.com` to this Nginx
   server's actual public IPv4 (the origin used by the old game domains, NOT
   Cloudflare's returned edge IPs). Only publish AAAA if this origin has working
   public IPv6. Leave apex/www website records alone.
2. Use DNS-only on these two records during initial issuance. Ensure inbound
   TCP80 and443 reach Nginx. If an origin firewall permits only Cloudflare,
   use a properly configured DNS-01 challenge instead; do not weaken it blindly.
3. Install the additive HTTP config below once. These commands intentionally
   stop if either new target already exists; never overwrite a Certbot-modified
   copy with the HTTP bootstrap again. Run each stage only after the previous
   stage succeeds.

```bash
cd /tmp/eidolon-domain-migration-20260911
sudo test ! -e /etc/nginx/sites-available/eidolonrealms.conf && \
  sudo install -m 644 server/deploy/nginx/eidolonrealms-http.conf /etc/nginx/sites-available/eidolonrealms.conf
sudo ln -s /etc/nginx/sites-available/eidolonrealms.conf /etc/nginx/sites-enabled/eidolonrealms.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx --redirect -d play.eidolonrealms.com -d server.eidolonrealms.com
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --dry-run
```

Certbot is already installed on this machine. It obtains the certificate and
adds TLS configuration for the new named hosts; existing old hosts remain.
If validation fails after enabling the new file, do not reload; disable just
the new symlink and retest the unchanged old configuration before proceeding.

4. After origin HTTPS works, Cloudflare proxying is optional. If enabled, use
   **Full (strict)**, not Flexible. Keep WebSockets enabled, and bypass caching
   for the backend (including `/healthz` and `/ws`) and game HTML/release metadata.
   Recheck renewal after restoring proxying or adding redirect/firewall rules.

Reference: [Certbot Nginx instructions](https://certbot.eff.org/instructions?os=pip&ws=nginx),
[Nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html),
[Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

## Application and QA changes

- WebSocket Origin allowlist accepts both new exact hostnames and retains the
  old production/local hosts. No wildcard origins or authentication bypass.
  Existing login, registration and gameplay use WebSockets; adding HTTP
  `Access-Control-Allow-Origin: *` in Nginx is not the appropriate fix.
- Shipped login defaults to the new secure backend. On the old frontend domain
  only, boot resolves that default to the old backend so staged deployment does
  not require new DNS to be ready for existing players. Explicit local QA
  endpoint overrides remain untouched. Both endpoints use the same server/DB.
- Live QA endpoint selection uses repository variables, with legacy defaults
  until infrastructure is ready. Set all three together **after the migration
  code is deployed and the new endpoints work**, then validate the next release:

```bash
gh variable set EIDOLON_LIVE_BASE_URL --repo aeml/eidolon --body https://play.eidolonrealms.com
gh variable set EIDOLON_LIVE_WS_URL --repo aeml/eidolon --body wss://server.eidolonrealms.com/ws
gh variable set EIDOLON_LIVE_HEALTH_URL --repo aeml/eidolon --body https://server.eidolonrealms.com/healthz
```

- QA's private-origin DNS mapping includes both backend domains. No blanket
  certificate-error bypass; normal public browsers keep their security settings.
- A new browser origin has separate localStorage/service-worker caches: players
  may need to log in again and reset local preferences; characters stay in the
  same existing database. This migration does not move or reset player data.

## Acceptance still required after operator setup and deployment

Check HTTPS without `-k`, client `/release.json` and backend `/healthz` agree on
the expected commit, login at the new frontend actually uses the new WSS host,
rejected unrelated Origins remain rejected, and a saved character reconnects.
Run native live release QA on the new URLs. Keep old domains available until
this passes; do not redirect the old WebSocket endpoint or delete old certs.
No live DNS/Nginx/Certbot/Pages setting mutation has been performed by the agent.

## Operator cutover follow-up — September 11, 04:34 UTC

The initial Certbot request failed through Cloudflare520. Operator has since
installed certificates: new backend HTTPS/health is200, database ready, still
running df91bb66/Alpha1.0.60 (not the new Origin code). Do not reinstall the
HTTP bootstrap over the Certbot-managed TLS configuration.

GitHub Pages custom-domain state has also changed to `play.eidolonrealms.com`.
This supersedes the old-Host routing instructions above. Upstream tests show
`Host: eidolon.mendola.tech` now404 and `Host: play.eidolonrealms.com`200.
The new frontend public404 therefore needs the installed proxy Host changed to
the new Pages custom domain. The checked-in bootstrap now uses the new Host.
The old public frontend currently redirects to the apex website; that external
operator change is not undone by this patch. Keeping the legacy connection
resolver is backward compatibility, not a claim that this redirect serves a game.

Run only this targeted update, preserving Certbot's HTTPS additions:

```bash
sudo sed -i.before-pages-host 's/proxy_set_header Host eidolon.mendola.tech;/proxy_set_header Host play.eidolonrealms.com;/' /etc/nginx/sites-available/eidolonrealms.conf
sudo nginx -t && sudo systemctl reload nginx
```

The backup is `/etc/nginx/sites-available/eidolonrealms.conf.before-pages-host`.
After migration code is deployed, live QA must use the three new endpoint
variables above: the old frontend is no longer a valid game QA destination.

## Queued release checkout repair

Canonical62dc CI34434837759 completed predeploy QA but failed SSH deployment:
the step reset to newer origin/master3671 while expecting tested62dc. This was
before API replacement; backend remainsdf91. The pending3671 run is not proof
that this pipeline bug is fixed.

Updated checkout validates the SHA/production branch, fetches, verifies the
tested commit belongs to fetched branch history, rejects tracked local changes,
and checks out the exact tested commit detached. It no longer resets to a
moving branch tip or deletes untracked files at this step. Existing later
deployment behavior is unchanged. Six disposable real-Git cases execute the
actual workflow segment: later push, next release, staged/unstaged preservation,
unrelated history and invalid inputs. Five focused suites/32 tests pass2.621s;
focused ESLint passes. Initial test-only environment error (HTMLCanvasElement)
was fixed by using the repository's normal configured test environment.

Unreleased patch-note addition: Queued deployments now use the exact tested
commit even when newer changes arrive while a release is waiting for QA.

## Local verification — September 11, 04:28 UTC

- Three focused client suites /21 tests pass, including default endpoint,
  legacy fallback, local overrides, main boot and QA resolver mapping.
- Real local WebSocket upgrade and Origin allowlist tests pass with Go race
  checking (`eidolon-server`,1.043s). This is not a public TLS/login test.
- Focused ESLint and `git diff --check` pass. CI YAML parses and all live QA
  steps inherit the three configurable endpoints without step-level overrides.
- Unprivileged Nginx check reports syntax OK, then fails to bind privileged
  port80. The operator's `sudo nginx -t` against the full installed configuration
  is still required; this is not an installed-config acceptance claim.
- Application changes remain local pending operator DNS/TLS setup and normal
  release integration. No new release number or deployed patch-note claim.

Unreleased patch-note draft: Added support for play.eidolonrealms.com and
server.eidolonrealms.com, with old-domain compatibility during migration and
updated secure connection/origin validation and deployment QA routing.
