# Eidolon Multiplayer Server

This is the multiplayer server for Eidolon, written in Go.

## Prerequisites

- Go 1.21 or later
- MongoDB (Local or Atlas)

## Running Locally with SSL (Recommended)

To run the server locally with SSL (Secure WebSockets `wss://`), you need to generate a self-signed certificate.

1.  **Generate Certificates** (using OpenSSL):
    ```bash
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
    ```
    This will create `cert.pem` and `key.pem` in your current directory.

2.  **Run the Server**:
    ```bash
    go run main.go --cert=cert.pem --key=key.pem
    ```

3.  **Trust the Certificate**:
    Since it is self-signed, your browser will reject the connection initially.
    *   Open `https://localhost:8080/ws` in your browser.
    *   You will see a "Not Secure" warning.
    *   Click "Advanced" -> "Proceed to localhost (unsafe)".
    *   Now your game client can connect via `wss://localhost:8080/ws`.

## Running Locally without SSL

```bash
go run main.go
```
The server will start on port 8080 (HTTP). Use `ws://localhost:8080/ws` in the client.

## Deployment Options

### Option 1: Google Cloud "Always Free" (Recommended Alternative)

To build a binary for Linux ARM64 (which is what Oracle Cloud Ampere instances use):

```bash
set GOOS=linux
set GOARCH=arm64
go build -o eidolon-server-arm64 main.go
```

(On PowerShell):
```powershell
$env:GOOS = "linux"
$env:GOARCH = "arm64"
go build -o eidolon-server-arm64 main.go
```

### Option 2: Local Hosting with Dynamic DNS (eserver.mendola.tech)

Since you are using `eserver.mendola.tech`, you can set up a valid SSL certificate using Let's Encrypt so players don't get security warnings.

#### 1. Port Forwarding
Ensure ports **80** (HTTP) and **8080** (Game Server) are forwarded on your router to your computer's local IP address.
- Port 80 is required for Let's Encrypt validation.
- Port 8080 is required for the game connection.

#### 2. Install Certbot (Windows)
1. Download the Certbot installer from [https://dl.eff.org/certbot-beta-installer-win32.exe](https://dl.eff.org/certbot-beta-installer-win32.exe).
2. Run the installer.

#### 3. Generate Certificate
Open PowerShell as Administrator and run:
```powershell
certbot certonly --standalone -d eserver.mendola.tech
```
*   This spins up a temporary web server on port 80 to prove you own the domain.
*   If successful, your certificates will be saved in `C:\Certbot\live\eserver.mendola.tech\`.

#### 4. Run the Server
You can now run the server pointing to these certificates. Note that you might need to copy them to your project folder if permission issues arise, or run the server as Administrator.

```powershell
# Example (Adjust paths if necessary)
go run main.go --cert="C:\Certbot\live\eserver.mendola.tech\fullchain.pem" --key="C:\Certbot\live\eserver.mendola.tech\privkey.pem"
```

**Note:** Let's Encrypt certificates expire every 90 days. You can renew them by running `certbot renew`.

## Deployment

1. Upload `eidolon-server-arm64` to your server.
2. Make it executable: `chmod +x eidolon-server-arm64`
3. Run it: `./eidolon-server-arm64 --mongo-uri="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/"`

You may want to run it in the background using `nohup` or a systemd service.

## Database

The server uses MongoDB. It will automatically create a database named `eidolon` and a collection `users` with a unique index on `username`.
