// Run from the repository root with Go and nginx installed. This starts only
// an unprivileged, temporary loopback nginx; it never reloads the host service.
package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if os.Geteuid() == 0 {
		return fmt.Errorf("run this disposable loopback check without root")
	}
	binary := flag.String("nginx", "/usr/sbin/nginx", "local nginx executable")
	template := flag.String("template", "server/deploy/nginx/eidolonrealms-http.conf", "repository Pages template")
	flag.Parse()
	source, err := os.ReadFile(*template)
	if err != nil {
		return err
	}
	deliveryFormat, err := os.ReadFile("server/deploy/nginx/eidolon-delivery-http.conf")
	if err != nil {
		return err
	}
	start := strings.Index(string(source), "server {")
	if start < 0 {
		return fmt.Errorf("missing frontend server")
	}
	depth, end := 0, 0
	for i := start; i < len(source); i++ {
		if source[i] == '{' {
			depth++
		}
		if source[i] == '}' {
			depth--
			if depth == 0 {
				end = i + 1
				break
			}
		}
	}
	if end == 0 {
		return fmt.Errorf("unclosed frontend server")
	}
	frontend := string(source[start:end])
	if len(regexp.MustCompile(`(?m)^\s*proxy_pass\s+`).FindAllString(frontend, -1)) != 1 {
		return fmt.Errorf("fixture requires one fixed Pages proxy")
	}
	for _, marker := range []string{"server_name play.eidolonrealms.com;", "listen 80;", "listen [::]:80;", "set $eidolon_pages_host aeml.github.io;", "proxy_ssl_name aeml.github.io;", "proxy_pass https://$eidolon_pages_host$request_uri;"} {
		if !strings.Contains(frontend, marker) {
			return fmt.Errorf("missing fixture binding: %s", marker)
		}
	}
	dir, err := os.MkdirTemp("", "eidolon-pages-upstream-tls-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	now := time.Now().UTC()
	ca := func(name string) (*x509.Certificate, *ecdsa.PrivateKey, []byte, error) {
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return nil, nil, nil, err
		}
		cert := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: name}, NotBefore: now.Add(-48 * time.Hour), NotAfter: now.Add(48 * time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
		der, err := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
		if err != nil {
			return nil, nil, nil, err
		}
		parsed, err := x509.ParseCertificate(der)
		return parsed, key, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), err
	}
	trusted, trustedKey, trustedPEM, err := ca("Eidolon disposable trusted CA")
	if err != nil {
		return err
	}
	other, otherKey, _, err := ca("Eidolon disposable untrusted CA")
	if err != nil {
		return err
	}
	trustFile := filepath.Join(dir, "ca.pem")
	if err = os.WriteFile(trustFile, trustedPEM, 0600); err != nil {
		return err
	}
	type scenario struct {
		name, dns string
		issuer    *x509.Certificate
		key       *ecdsa.PrivateKey
		expired   bool
		port      int
	}
	cases := []scenario{{"valid", "aeml.github.io", trusted, trustedKey, false, 0}, {"untrusted", "aeml.github.io", other, otherKey, false, 0}, {"expired", "aeml.github.io", trusted, trustedKey, true, 0}, {"wrong-name", "wrong.example.invalid", trusted, trustedKey, false, 0}}
	var reservations []net.Listener
	defer func() {
		for _, listener := range reservations {
			listener.Close()
		}
	}()
	port := func() (int, error) {
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return 0, err
		}
		reservations = append(reservations, listener)
		return listener.Addr().(*net.TCPAddr).Port, nil
	}
	var peers strings.Builder
	for i := range cases {
		c := &cases[i]
		c.port, err = port()
		if err != nil {
			return err
		}
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return err
		}
		until := now.Add(24 * time.Hour)
		if c.expired {
			until = now.Add(-time.Hour)
		}
		cert := &x509.Certificate{SerialNumber: big.NewInt(int64(i + 10)), DNSNames: []string{c.dns}, NotBefore: now.Add(-24 * time.Hour), NotAfter: until, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
		der, err := x509.CreateCertificate(rand.Reader, cert, c.issuer, &key.PublicKey, c.key)
		if err != nil {
			return err
		}
		private, err := x509.MarshalECPrivateKey(key)
		if err != nil {
			return err
		}
		certFile, keyFile := filepath.Join(dir, c.name+".pem"), filepath.Join(dir, c.name+".key")
		if err = os.WriteFile(certFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600); err != nil {
			return err
		}
		if err = os.WriteFile(keyFile, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: private}), 0600); err != nil {
			return err
		}
		fmt.Fprintf(&peers, "server { listen 127.0.0.1:%d ssl; server_name aeml.github.io; access_log off; add_header X-GitHub-Request-ID $request_id always; ssl_certificate %q; ssl_certificate_key %q; location = /assets/upstream-408.js { return 408 \"fixture-upstream-408\"; } location / { return 200 \"$ssl_server_name|$http_host|$request_uri\"; } }\n", c.port, certFile, keyFile)
	}
	type target struct {
		mode, name string
		port, want int
	}
	var targets []target
	var fronts strings.Builder
	deliveryLog := filepath.Join(dir, "delivery.jsonl")
	inheritedLog := filepath.Join(dir, "inherited-combined.log")
	for _, mode := range []string{"configured", "insecure-control"} {
		for _, c := range cases {
			listen, err := port()
			if err != nil {
				return err
			}
			block := strings.ReplaceAll(frontend, "listen 80;", fmt.Sprintf("listen 127.0.0.1:%d;", listen))
			block = strings.ReplaceAll(block, "listen [::]:80;", "")
			block = strings.ReplaceAll(block, "set $eidolon_pages_host aeml.github.io;", fmt.Sprintf("set $eidolon_pages_host 127.0.0.1:%d;", c.port))
			block = strings.ReplaceAll(block, "/etc/ssl/certs/ca-certificates.crt", trustFile)
			block = strings.ReplaceAll(block, "/var/log/nginx/eidolon-delivery.log", deliveryLog)
			if mode == "insecure-control" {
				block = strings.ReplaceAll(block, "proxy_ssl_verify on;", "proxy_ssl_verify off;")
			}
			want := 502
			if c.name == "valid" || mode == "insecure-control" {
				want = 200
			}
			targets = append(targets, target{mode, c.name, listen, want})
			fronts.WriteString(block + "\n")
		}
	}
	log := filepath.Join(dir, "error.log")
	config := fmt.Sprintf("worker_processes 1; pid %q; error_log %q error; events { worker_connections 64; } http { add_header X-Eidolon-Fixture-Security inherited always; access_log %q combined; client_body_temp_path %q; proxy_temp_path %q; %s %s %s }", filepath.Join(dir, "nginx.pid"), log, inheritedLog, filepath.Join(dir, "body"), filepath.Join(dir, "proxy"), deliveryFormat, peers.String(), fronts.String())
	configuration := filepath.Join(dir, "nginx.conf")
	if err = os.WriteFile(configuration, []byte(config), 0600); err != nil {
		return err
	}
	args := []string{"-p", dir + "/", "-c", configuration, "-e", log}
	if output, err := exec.Command(*binary, append(args, "-t")...).CombinedOutput(); err != nil {
		return fmt.Errorf("private nginx config failed: %w: %s", err, output)
	}
	for _, listener := range reservations {
		listener.Close()
	}
	command := exec.Command(*binary, append(args, "-g", "daemon off;")...)
	if err = command.Start(); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() { done <- command.Wait(); close(done) }()
	stopped := false
	stop := func() error {
		if stopped {
			return nil
		}
		stopped = true
		command.Process.Signal(syscall.SIGQUIT)
		select {
		case err := <-done:
			return err
		case <-time.After(3 * time.Second):
			command.Process.Kill()
			<-done
			return fmt.Errorf("private nginx required forced cleanup")
		}
	}
	defer stop()
	client := &http.Client{Timeout: 2 * time.Second, Transport: &http.Transport{Proxy: nil},
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	defer client.CloseIdleConnections()
	uri := "/src/analytics/game.bundle.js?release=0123456789abcdef&qa=%2Fheld%20look"
	get := func(port int) (int, string, error) {
		request, err := http.NewRequest("GET", fmt.Sprintf("http://127.0.0.1:%d%s", port, uri), nil)
		if err != nil {
			return 0, "", err
		}
		request.Host = "play.eidolonrealms.com"
		response, err := client.Do(request)
		if err != nil {
			return 0, "", err
		}
		defer response.Body.Close()
		body, err := io.ReadAll(io.LimitReader(response.Body, 1024))
		return response.StatusCode, string(body), err
	}
	ready := false
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); {
		select {
		case err := <-done:
			return fmt.Errorf("private nginx exited before readiness: %v", err)
		default:
		}
		if status, _, err := get(targets[0].port); err == nil && status == 200 {
			ready = true
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if !ready {
		return fmt.Errorf("private nginx readiness failed")
	}
	type result struct {
		Mode           string `json:"mode"`
		Case           string `json:"case"`
		Status         int    `json:"status"`
		Expected       int    `json:"expected"`
		RoutingMatches bool   `json:"routingMatches"`
		Pass           bool   `json:"pass"`
	}
	var results []result
	passed := true
	for _, target := range targets {
		status, body, err := get(target.port)
		if err != nil {
			return err
		}
		routing := body == "aeml.github.io|play.eidolonrealms.com|"+uri
		pass := status == target.want && (target.want != 200 || routing)
		passed = passed && pass
		results = append(results, result{target.mode, target.name, status, target.want, routing, pass})
	}
	// Additional bounded public-static/root requests prove privacy, JSON escaping,
	// request-ID correlation and upstream-versus-downstream status attribution.
	type deliveryResult struct {
		Case string `json:"case"`
		Pass bool   `json:"pass"`
	}
	var deliveryResults []deliveryResult
	release := strings.Repeat("a", 40)
	privateMarker := "synthetic-private-query-only"
	privacyPaths := []struct {
		name, uri string
		want      int
	}{
		{"public-release-only", "/assets/delivery-check.js?release=" + release + "&invite=" + privateMarker, 200},
		{"private-root-query", "/?invite=" + privateMarker + "&email=qa%40example.invalid&password=" + privateMarker, 200},
		{"json-escaped-path-invalid-release", "/assets/quote%22name%5Cfile.js?release=not-a-commit&token=" + privateMarker, 200},
		{"manifest-query", "/release.json?release=" + release + "&token=" + privateMarker, 200},
		{"upstream-408", "/assets/upstream-408.js?release=" + release, 408},
	}
	ids := make(map[string]string)
	inheritedHeaders := true
	for _, test := range privacyPaths {
		request, err := http.NewRequest("GET", fmt.Sprintf("http://127.0.0.1:%d%s", targets[0].port, test.uri), nil)
		if err != nil {
			return err
		}
		request.Host = "play.eidolonrealms.com"
		request.Header.Set("Referer", "https://private.invalid/?token="+privateMarker)
		request.Header.Set("User-Agent", privateMarker)
		request.Header.Set("Authorization", "Bearer "+privateMarker)
		response, err := client.Do(request)
		if err != nil {
			return err
		}
		body, readErr := io.ReadAll(io.LimitReader(response.Body, 2048))
		response.Body.Close()
		if readErr != nil {
			return readErr
		}
		id := response.Header.Get("X-GitHub-Request-ID")
		inherited := response.Header.Get("X-Eidolon-Fixture-Security") == "inherited"
		inheritedHeaders = inheritedHeaders && inherited
		_, duplicate := ids[id]
		ids[id] = test.name
		pass := response.StatusCode == test.want && regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(id) && !duplicate && inherited
		if test.want == 200 {
			pass = pass && string(body) == "aeml.github.io|play.eidolonrealms.com|"+test.uri
		}
		if test.want == 408 {
			pass = pass && string(body) == "fixture-upstream-408"
		}
		deliveryResults = append(deliveryResults, deliveryResult{test.name, pass})
		passed = passed && pass
	}
	if err = stop(); err != nil {
		return err
	}
	data, readErr := os.ReadFile(deliveryLog)
	rowsValid := readErr == nil && !strings.Contains(string(data), privateMarker) && !strings.Contains(string(data), "qa@example.invalid")
	var rows []string
	if trimmed := strings.TrimSpace(string(data)); trimmed != "" {
		rows = strings.Split(trimmed, "\n")
	}
	rowsValid = rowsValid && len(rows) == 14
	seen := make(map[string]bool)
	seenUpstream := make(map[string]bool)
	allowed := map[string]bool{"time": true, "requestId": true, "method": true, "path": true, "release": true, "status": true, "bytes": true, "requestSeconds": true, "upstreamStatus": true, "upstreamRequestId": true, "connectSeconds": true, "headerSeconds": true, "upstreamSeconds": true, "cache": true}
	for _, line := range rows {
		var row map[string]any
		if json.Unmarshal([]byte(line), &row) != nil {
			rowsValid = false
			continue
		}
		if len(row) != len(allowed) {
			rowsValid = false
		}
		for key := range row {
			if !allowed[key] {
				rowsValid = false
			}
		}
		id, _ := row["requestId"].(string)
		if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(id) || seen[id] {
			rowsValid = false
		}
		seen[id] = true
		upstreamID, _ := row["upstreamRequestId"].(string)
		if name, ok := ids[upstreamID]; ok {
			if seenUpstream[upstreamID] {
				rowsValid = false
			}
			seenUpstream[upstreamID] = true
			var expectedURI string
			expectedStatus := 0
			for _, test := range privacyPaths {
				if test.name == name {
					expectedURI, expectedStatus = test.uri, test.want
				}
			}
			parsed, _ := url.Parse(expectedURI)
			expectedRelease := "-"
			if parsed.Query().Get("release") == release {
				expectedRelease = release
			}
			rowsValid = rowsValid && row["path"] == parsed.Path && row["release"] == expectedRelease &&
				row["status"] == float64(expectedStatus) && row["upstreamStatus"] == fmt.Sprint(expectedStatus) && row["method"] == "GET"
			for _, field := range []string{"requestSeconds", "connectSeconds", "headerSeconds", "upstreamSeconds"} {
				value, ok := row[field].(string)
				rowsValid = rowsValid && ok && regexp.MustCompile(`^[0-9]+\.[0-9]{3}$`).MatchString(value)
			}
		}
	}
	for id := range ids {
		if !seenUpstream[id] {
			rowsValid = false
		}
	}
	legacy, legacyErr := os.ReadFile(inheritedLog)
	noInherited := legacyErr == nil && len(legacy) == 0
	passed = passed && rowsValid && noInherited
	version, _ := exec.Command(*binary, "-v").CombinedOutput()
	digest := sha256.Sum256(source)
	formatDigest := sha256.Sum256(deliveryFormat)
	json.NewEncoder(os.Stdout).Encode(map[string]any{"scope": "Private unprivileged loopback nginx, synthetic certificates/queries only; no host reload, public traffic or production TLS/log policy change.", "nginx": strings.TrimSpace(string(version)), "templateSha256": hex.EncodeToString(digest[:]), "deliveryFormatSha256": hex.EncodeToString(formatDigest[:]), "cases": results, "deliveryCases": deliveryResults, "deliveryRows": len(rows), "deliveryRowsValid": rowsValid, "inheritedSecurityHeaders": inheritedHeaders, "noInheritedCombinedLog": noInherited, "allPass": passed})
	if !passed {
		return fmt.Errorf("Pages upstream verification or routing failed")
	}
	return nil
}
