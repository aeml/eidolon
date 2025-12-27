# Run Eidolon Server with Production SSL
# Make sure you have generated certificates using Certbot first!
# See README.md for instructions.

$CertPath = ".\certs\fullchain.pem"
$KeyPath = ".\certs\privkey.pem"

# Check if certificates exist
if (!(Test-Path $CertPath) -or !(Test-Path $KeyPath)) {
    Write-Host "Error: SSL Certificates not found at expected location." -ForegroundColor Red
    Write-Host "Expected:"
    Write-Host "  Cert: $CertPath"
    Write-Host "  Key:  $KeyPath"
    Write-Host ""
    Write-Host "Please run 'certbot certonly --standalone -d eserver.mendola.tech' first."
    exit 1
}

Write-Host "Starting Eidolon Server on eserver.mendola.tech:443..." -ForegroundColor Green
Write-Host "Note: Binding to 443 may require an elevated PowerShell (Run as Administrator)." -ForegroundColor Yellow
go run . --addr=":443" --cert=$CertPath --key=$KeyPath
