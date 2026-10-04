package main

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// A loopback CONNECT sink intercepts only the fixed Postmark endpoint. It never
// dials upstream. Only the disposable child process trusts this ephemeral CA;
// production has no provider URL override or test-only recovery command.
func recoveryConnectedMailSink(t *testing.T) <-chan postmarkRecoveryMessage {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	certificate := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "synthetic recovery fixture"},
		DNSNames: []string{"api.postmarkapp.com"}, NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour),
		IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	der, err := x509.CreateCertificate(rand.Reader, certificate, certificate, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	caPath := filepath.Join(t.TempDir(), "synthetic-ca.pem")
	if err := os.WriteFile(caPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600); err != nil {
		t.Fatal(err)
	}
	messages := make(chan postmarkRecoveryMessage, 8)
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodConnect || r.Host != "api.postmarkapp.com:443" {
			http.Error(w, "fixture refuses upstream traffic", http.StatusForbidden)
			return
		}
		connection, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			t.Error("fixture proxy could not accept tunnel")
			return
		}
		defer connection.Close()
		_ = connection.SetDeadline(time.Now().Add(8 * time.Second))
		_, _ = io.WriteString(connection, "HTTP/1.1 200 Connection Established\r\n\r\n")
		secured := tls.Server(connection, &tls.Config{MinVersion: tls.VersionTLS12, Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}})
		request, err := http.ReadRequest(bufio.NewReader(secured))
		if err != nil {
			t.Error("fixture TLS request failed")
			return
		}
		defer request.Body.Close()
		var message postmarkRecoveryMessage
		if request.Method != http.MethodPost || request.Host != "api.postmarkapp.com" || request.URL.Path != "/email" ||
			request.Header.Get("X-Postmark-Server-Token") != "synthetic-connected-token" ||
			json.NewDecoder(io.LimitReader(request.Body, 16<<10)).Decode(&message) != nil ||
			message.From != "sender@example.invalid" || message.To != "owner@example.invalid" ||
			message.MessageStream != "fixture-stream" || message.TrackOpens || message.TrackLinks != "None" {
			t.Error("connected provider contract or recipient failed")
			return
		}
		messages <- message
		const body = `{"ErrorCode":0,"MessageID":"synthetic-connected"}`
		_, _ = fmt.Fprintf(secured, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\nConnection: close\r\n\r\n%s", len(body), body)
	}))
	t.Cleanup(proxy.Close)
	for name, value := range map[string]string{"HTTPS_PROXY": proxy.URL, "NO_PROXY": "127.0.0.1,localhost", "SSL_CERT_FILE": caPath,
		"POSTMARK_SERVER_TOKEN": "synthetic-connected-token", "POSTMARK_FROM_EMAIL": "sender@example.invalid",
		"POSTMARK_MESSAGE_STREAM": "fixture-stream", "ADMIN_NOTIFICATION_EMAILS": "not-a-recipient@example.invalid"} {
		t.Setenv(name, value)
	}
	return messages
}

func TestEmailRecoveryActualConnectedSessions(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	messages := recoveryConnectedMailSink(t)
	fixture, current := resourceJournalFixture(t, repo)
	const next = "  New connected recovery passphrase  "
	address, stop := compatStartServer(t, binary, uri, 1711, "-save-journal-dir", t.TempDir())
	defer stop()
	request := func(conn *websocket.Conn, action string, payload map[string]string) string {
		t.Helper()
		payload["requestId"] = "connected-recovery"
		resourceSend(t, conn, action, payload)
		var receipt struct {
			RequestID, Action, Message string
			Success                    bool
		}
		resourceReadMessage(t, conn, "email_recovery_result", &receipt)
		if receipt.RequestID != payload["requestId"] || receipt.Action != action || !receipt.Success {
			t.Fatal("connected recovery receipt failed (proof omitted)")
		}
		return receipt.Message
	}
	mailToken := func(kind string) string {
		t.Helper()
		select {
		case message := <-messages:
			for _, line := range strings.Split(message.TextBody, "\n") {
				if !strings.HasPrefix(line, "https://play.eidolonrealms.com/#") {
					continue
				}
				link, err := url.Parse(line)
				if err != nil {
					t.Fatal("fixture link parse failed")
				}
				values, _ := url.ParseQuery(link.EscapedFragment())
				if values.Get("eidolon-recovery") != kind || values.Get("account") != fixture.Name || len(values.Get("token")) != 64 {
					t.Fatal("fixture link binding failed")
				}
				return values.Get("token")
			}
			t.Fatal("fixture received no explicit-action link")
		case <-time.After(5 * time.Second):
			t.Fatal("connected recovery mail not received by local sink")
		}
		return ""
	}
	guest := credentialSocket(t, address)
	unknown := request(guest, MsgRequestPasswordRecovery, map[string]string{"username": fixture.Name + "-unknown"})
	unverified := request(guest, MsgRequestPasswordRecovery, map[string]string{"username": fixture.Name})
	if unknown != unverified {
		t.Fatal("request enumerated account eligibility")
	}
	owner := credentialSocket(t, address)
	resourceSend(t, owner, MsgLogin, AuthPayload{Username: fixture.Name, Password: current})
	_ = credentialExpectLogin(t, owner)
	request(owner, MsgSetRecoveryEmail, map[string]string{"email": "owner@example.invalid", "currentPassword": current, "username": fixture.Name + "-forged"})
	verification := mailToken("verify")
	request(guest, MsgConfirmRecoveryEmail, map[string]string{"username": fixture.Name, "token": verification})
	if verified := request(guest, MsgRequestPasswordRecovery, map[string]string{"username": fixture.Name}); verified != unknown {
		t.Fatal("verified recovery request exposed eligibility")
	}
	reset := mailToken("reset")
	guest.Close()
	owner.Close()
	stop()

	// The pending emailed challenge survives a real process restart. A new live
	// owner and token are then invalidated by the proved reset, not its request.
	address, stop = compatStartServer(t, binary, uri, 1712, "-save-journal-dir", t.TempDir())
	defer stop()
	owner = credentialSocket(t, address)
	resourceSend(t, owner, MsgLogin, AuthPayload{Username: fixture.Name, Password: current})
	oldToken := credentialExpectLogin(t, owner)
	guest = credentialSocket(t, address)
	request(guest, MsgCompletePasswordRecovery, map[string]string{"username": fixture.Name, "token": reset, "newPassword": next})
	guest.Close()
	_ = owner.SetReadDeadline(time.Now().Add(5 * time.Second))
	// Frames already queued before revocation may precede the close frame.
	for {
		if _, _, err := owner.ReadMessage(); err != nil {
			if deadline, ok := err.(net.Error); ok && deadline.Timeout() {
				t.Fatal("reset did not close old account connection before deadline")
			}
			break
		}
	}
	probe := credentialSocket(t, address)
	resourceSend(t, probe, MsgResumeSession, map[string]string{"token": oldToken})
	credentialExpectError(t, probe, "invalid or expired")
	probe.Close()
	old := credentialSocket(t, address)
	resourceSend(t, old, MsgLogin, AuthPayload{Username: fixture.Name, Password: current})
	credentialExpectError(t, old, "Invalid credentials")
	old.Close()
	fresh := credentialSocket(t, address)
	resourceSend(t, fresh, MsgLogin, AuthPayload{Username: fixture.Name, Password: next})
	_ = credentialExpectLogin(t, fresh)
	fresh.Close()
	select {
	case notice := <-messages:
		if strings.Contains(notice.TextBody, "#") || strings.Contains(notice.TextBody, current) || strings.Contains(notice.TextBody, next) {
			t.Fatal("reset notification exposed credential/link")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("local reset notification not received")
	}
	stop()
	after, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || after == nil || after.Gold != fixture.Gold || after.Equipment["chest"].ID != fixture.Equipment["chest"].ID {
		t.Fatal("recovery changed stored character value", err)
	}
	t.Log("real sockets/Mongo/bcrypt: verification, generic requests, durable link across restart, reset/session revocation, new login and local-only mail passed")
}
