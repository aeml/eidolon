package operations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Opt-in public publication check. Existing constructors and disabled callers
// retain API-only behavior; construction never makes a network request.
func NewProbeWithFrontendRelease(endpoint, frontendEndpoint, expectedCommit string, timeout time.Duration, limits PressureLimits, storage StorageConfig) (*Probe, error) {
	p, err := NewProbeWithStorage(endpoint, expectedCommit, timeout, limits, storage)
	if err != nil || frontendEndpoint == "" {
		return p, err
	}
	u, err := url.Parse(frontendEndpoint)
	if err != nil || u.Host == "" || u.Hostname() == "" || u.Opaque != "" || u.User != nil || u.Path != "/release.json" ||
		u.RawPath != "" || u.RawQuery != "" || u.ForceQuery || strings.Contains(frontendEndpoint, "#") || strings.HasSuffix(u.Host, ":") {
		return nil, errors.New("invalid bounded frontend release probe configuration")
	}
	ip := net.ParseIP(u.Hostname())
	if strings.Contains(u.Hostname(), ":") && !strings.HasPrefix(u.Host, "[") {
		return nil, errors.New("invalid bounded frontend release probe configuration")
	}
	if strings.HasPrefix(u.Host, "[") && (ip == nil || !strings.Contains(u.Hostname(), ":")) {
		return nil, errors.New("invalid bounded frontend release probe configuration")
	}
	if u.Port() != "" {
		port, err := strconv.Atoi(u.Port())
		if err != nil || port < 1 || port > 65535 {
			return nil, errors.New("invalid bounded frontend release probe configuration")
		}
	}
	loopback := u.Hostname() == "localhost" || ip != nil && ip.IsLoopback()
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback) {
		return nil, errors.New("frontend release probes require HTTPS or loopback HTTP")
	}
	p.frontendEndpoint = frontendEndpoint
	return p, nil
}

func (p *Probe) checkFrontendRelease(requestContext, callerContext context.Context, commit, version string) string {
	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, p.frontendEndpoint, nil)
	if err != nil {
		return "frontend_probe_failed"
	}
	request.Header.Set("Cache-Control", "no-cache")
	response, err := p.client.Do(request)
	if err != nil {
		return frontendFailureCause(callerContext, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "frontend_unavailable"
	}
	const maxBytes = 4 << 10
	body, err := io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
	if err != nil {
		return frontendFailureCause(callerContext, err)
	}
	var release struct{ Commit, Version string }
	if len(body) > maxBytes || json.Unmarshal(body, &release) != nil ||
		!releaseCommit.MatchString(release.Commit) || !releaseVersion.MatchString(release.Version) {
		return "frontend_invalid_response"
	}
	if release.Commit != commit || release.Version != version {
		return "frontend_release_mismatch"
	}
	return "ready"
}

func frontendFailureCause(ctx context.Context, err error) string {
	switch probeFailureCause(ctx, err) {
	case "cancelled":
		return "cancelled"
	case "probe_timeout":
		return "frontend_probe_timeout"
	default:
		return "frontend_probe_failed"
	}
}
