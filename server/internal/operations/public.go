package operations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// PublicMetrics distinguishes an unchecked surface from a failed one. No URLs,
// certificate/DNS errors, raw bodies, account fields or arbitrary labels.
type PublicMetrics struct {
	FrontendChecked bool `json:"frontendChecked"`
	FrontendReady   bool `json:"frontendReady"`
	BackendChecked  bool `json:"backendChecked"`
	BackendReady    bool `json:"backendReady"`
	IdentityMatch   bool `json:"identityMatch"`
}

type publicProbe struct {
	frontend, page, backend string
	client                  *http.Client
}

func publicEndpoint(endpoint, path string) (*url.URL, error) {
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil ||
		u.Path != path || u.RawPath != "" || u.RawQuery != "" || u.ForceQuery || strings.Contains(endpoint, "#") || u.Opaque != "" {
		return nil, errors.New("invalid bounded public monitor configuration")
	}
	if port := u.Port(); port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return nil, errors.New("invalid bounded public monitor configuration")
		}
	}
	return u, nil
}

// ConfigurePublicEndpoints is startup-only, opt-in configuration. Both exact
// HTTPS endpoints are required together. Empty configuration keeps the existing
// local-only monitor unchanged. Construction performs no network or mail IO.
func (p *Probe) ConfigurePublicEndpoints(frontend, backend string) error {
	if frontend == "" && backend == "" {
		p.public = nil
		return nil
	}
	front, err := publicEndpoint(frontend, "/release.json")
	if err != nil {
		return err
	}
	if _, err := publicEndpoint(backend, "/healthz"); err != nil {
		return err
	}
	page := *front
	page.Path = "/"
	p.public = &publicProbe{frontend: frontend, page: page.String(), backend: backend, client: p.client}
	return nil
}

func (p *publicProbe) body(ctx context.Context, endpoint string, limit int64) ([]byte, string) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, "public_unavailable"
	}
	request.Header.Set("Cache-Control", "no-cache")
	response, err := p.client.Do(request)
	if err != nil {
		if ctx.Err() != nil || probeFailureCause(ctx, err) == "probe_timeout" {
			return nil, "public_probe_timeout"
		}
		return nil, "public_unavailable"
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, "public_unavailable"
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		if ctx.Err() != nil {
			return nil, "public_probe_timeout"
		}
		return nil, "public_unavailable"
	}
	if int64(len(body)) > limit {
		return nil, "public_invalid_response"
	}
	return body, ""
}

func (p *publicProbe) check(parent context.Context, commit, version string) (metrics *PublicMetrics, cause string) {
	// One total deadline for all three requests, not three full timeouts.
	// Preserve ordinary TLS and DNS: no IPv4 override, insecure TLS or redirects.
	ctx, cancel := context.WithTimeout(parent, p.client.Timeout)
	defer cancel()
	defer func() {
		if parent.Err() != nil {
			cause = "cancelled"
		}
	}()
	metrics = &PublicMetrics{FrontendChecked: true}
	body, cause := p.body(ctx, p.page, 1<<20)
	if cause != "" {
		if cause == "public_unavailable" {
			cause = "public_frontend_unavailable"
		}
		return metrics, cause
	}
	// Structural HTTP availability, not execution of browser scripts. A
	// healthy release manifest alone cannot prove the login page exists.
	if !bytes.Contains(body, []byte(`id="start-screen"`)) || !bytes.Contains(body, []byte(`id="btn-login"`)) {
		return metrics, "public_invalid_response"
	}
	body, cause = p.body(ctx, p.frontend, 32<<10)
	if cause != "" {
		if cause == "public_unavailable" {
			cause = "public_frontend_unavailable"
		}
		return metrics, cause
	}
	var release struct{ Commit, Version string }
	if json.Unmarshal(body, &release) != nil || !releaseCommit.MatchString(release.Commit) || !releaseVersion.MatchString(release.Version) {
		return metrics, "public_invalid_response"
	}
	metrics.FrontendReady = true
	metrics.BackendChecked = true
	body, cause = p.body(ctx, p.backend, 32<<10)
	if cause != "" {
		if cause == "public_unavailable" {
			cause = "public_backend_unavailable"
		}
		return metrics, cause
	}
	var health struct{ Status, Database, Commit, Version string }
	if json.Unmarshal(body, &health) != nil || !releaseCommit.MatchString(health.Commit) || !releaseVersion.MatchString(health.Version) {
		return metrics, "public_invalid_response"
	}
	if health.Status != "ok" || health.Database != "ready" {
		return metrics, "public_backend_unavailable"
	}
	metrics.BackendReady = true
	metrics.IdentityMatch = release.Commit == health.Commit && release.Version == health.Version &&
		release.Commit == commit && release.Version == version
	if !metrics.IdentityMatch {
		return metrics, "public_release_mismatch"
	}
	return metrics, ""
}
