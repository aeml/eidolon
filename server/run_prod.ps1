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

Write-Host "Starting Eidolon Server on eserver.mendola.tech:8080..." -ForegroundColor Green
go run . --addr=":8080" --cert=$CertPath --key=$KeyPath --log-file="logs/server.log" --log-stdout=false --log-http-errors=false --suspicious-stdout=true
