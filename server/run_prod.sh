#!/bin/bash
# Run Eidolon Server with Production SSL
# Make sure you have generated certificates using Certbot first!

CERT_PATH="/etc/letsencrypt/live/eserver.mendola.tech/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/eserver.mendola.tech/privkey.pem"

# Check if certificates exist
if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "Error: SSL Certificates not found at expected location."
    echo "Expected:"
    echo "  Cert: $CERT_PATH"
    echo "  Key:  $KEY_PATH"
    echo ""
    echo "Please run 'sudo certbot certonly --standalone -d eserver.mendola.tech' first."
    exit 1
fi

echo "Starting Eidolon Server on eserver.mendola.tech:8080..."
# Need sudo to read /etc/letsencrypt usually, or copy them out
sudo go run main.go --addr=":8080" --cert="$CERT_PATH" --key="$KEY_PATH"
