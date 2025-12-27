# Run Caddy reverse proxy for Eidolon
#
# Requires ports 80/443 forwarded to this machine.
# For first-time HTTPS issuance, port 80 is strongly recommended.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
$caddyfile = Join-Path $repoRoot "Caddyfile"

if (!(Test-Path $caddyfile)) {
    throw "Caddyfile not found at: $caddyfile"
}

Write-Host "Starting Caddy using $caddyfile" -ForegroundColor Green
Write-Host "If this is your first run, ensure TCP 80 and 443 are reachable." -ForegroundColor Yellow

Push-Location $repoRoot
try {
    caddy run --config "$caddyfile" --adapter caddyfile
} finally {
    Pop-Location
}
