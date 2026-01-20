# Run Eidolon Server behind Caddy (recommended)
#
# Caddy terminates TLS on 443 and reverse-proxies to this server on 127.0.0.1:8080.
# See the repo-root Caddyfile.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
$logDir = Join-Path $repoRoot "server\logs"

if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

Write-Host "Starting Eidolon Server (HTTP) on 127.0.0.1:8080..." -ForegroundColor Green
Push-Location (Join-Path $repoRoot "server")
try {
    go run . --addr="127.0.0.1:8080" --log-file="logs/server.log" --log-stdout=true --log-http-errors=false --suspicious-log-file="logs/junk.log" --suspicious-stdout=false
} finally {
    Pop-Location
}
