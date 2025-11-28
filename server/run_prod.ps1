# Run Eidolon Server with Production SSL
# Make sure you have generated certificates using Certbot first!
# See README.md for instructions.

$CertPath = "C:\Certbot\live\eserver.mendola.tech\fullchain.pem"
$KeyPath = "C:\Certbot\live\eserver.mendola.tech\privkey.pem"

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

Write-Host "Starting Eidolon Server on eserver.mendola.tech:8080..." -ForegroundColor Green
go run main.go --addr=":8080" --cert=$CertPath --key=$KeyPath
