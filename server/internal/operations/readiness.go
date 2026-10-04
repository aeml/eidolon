// Package operations provides secret-free inputs for an independently running
// operator monitor. It does not install a service or enable notification delivery.
package operations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"time"
)

var releaseCommit = regexp.MustCompile(`^[0-9a-f]{7,64}$`)
var releaseVersion = regexp.MustCompile(`^Alpha [0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$`)

type Sample struct {
	Ready     bool   `json:"ready"`
	Cause     string `json:"cause"`
	Commit    string `json:"commit,omitempty"`
	Version   string `json:"version,omitempty"`
	LatencyMS int64  `json:"latencyMs"`
}

type Probe struct {
	endpoint, expectedCommit string
	client                   *http.Client
}

// Permit ordinary loopback HTTP and authenticated HTTPS, never URL credentials,
// forwarding redirects, arbitrary paths or unbounded response/timeout settings.
// expectedCommit is optional; when set, a healthy older release still refuses.
func NewProbe(endpoint, expectedCommit string, timeout time.Duration) (*Probe, error) {
	u, err := url.Parse(endpoint)
	if err != nil || u.Host == "" || u.User != nil || u.Path != "/healthz" || u.RawQuery != "" || u.Fragment != "" ||
		(timeout <= 0 || timeout > 10*time.Second) || (expectedCommit != "" && !releaseCommit.MatchString(expectedCommit)) {
		return nil, errors.New("invalid bounded readiness probe configuration")
	}
	ip := net.ParseIP(u.Hostname())
	loopback := u.Hostname() == "localhost" || ip != nil && ip.IsLoopback()
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback) {
		return nil, errors.New("readiness probes require HTTPS or loopback HTTP")
	}
	return &Probe{endpoint: endpoint, expectedCommit: expectedCommit, client: &http.Client{Timeout: timeout,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

func (p *Probe) Check(ctx context.Context) (sample Sample) {
	start := time.Now()
	defer func() { sample.LatencyMS = time.Since(start).Milliseconds() }()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, p.endpoint, nil)
	if err != nil {
		sample.Cause = "probe_failed"
		return
	}
	request.Header.Set("Cache-Control", "no-cache")
	response, err := p.client.Do(request)
	if err != nil {
		sample.Cause = "probe_failed" // Never copy URLs, peer text or TLS diagnostics.
		if ctx.Err() != nil {
			sample.Cause = "cancelled"
		}
		return
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		sample.Cause = "http_unavailable"
		return
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, (32<<10)+1))
	var health struct{ Status, Database, Commit, Version string }
	if err != nil || len(body) > 32<<10 || json.Unmarshal(body, &health) != nil {
		sample.Cause = "invalid_response"
		return
	}
	if releaseCommit.MatchString(health.Commit) {
		sample.Commit = health.Commit
	}
	if releaseVersion.MatchString(health.Version) {
		sample.Version = health.Version
	}
	if health.Status != "ok" || health.Database != "ready" {
		sample.Cause = "not_ready"
	} else if sample.Commit == "" || sample.Version == "" {
		sample.Cause = "invalid_identity"
	} else if p.expectedCommit != "" && sample.Commit != p.expectedCommit {
		sample.Cause = "release_mismatch"
	} else {
		sample.Ready, sample.Cause = true, "ready"
	}
	return
}

type Notice struct {
	Kind  string `json:"kind"` // outage, reminder, recovered
	Cause string `json:"cause"`
}

type Detector struct {
	failureThreshold, recoveryThreshold int
	cooldown                            time.Duration
	failures, successes                 int
	incident                            bool
	lastNotice                          time.Time
}

// Thresholds/cooldown must be explicitly supplied by the monitor owner. State
// is fixed-size RAM, not player telemetry, a durable ledger or an approved SLA.
func NewDetector(failures, recoveries int, cooldown time.Duration) (*Detector, error) {
	if failures < 1 || failures > 60 || recoveries < 1 || recoveries > 60 || cooldown < time.Minute || cooldown > 24*time.Hour {
		return nil, errors.New("invalid bounded readiness notification settings")
	}
	return &Detector{failureThreshold: failures, recoveryThreshold: recoveries, cooldown: cooldown}, nil
}

func (d *Detector) Observe(sample Sample, now time.Time) *Notice {
	if sample.Cause == "cancelled" {
		return nil // Monitor shutdown is not evidence of an outage.
	}
	if sample.Ready {
		d.failures = 0
		if d.successes < d.recoveryThreshold {
			d.successes++
		}
		if d.incident && d.successes >= d.recoveryThreshold {
			d.incident, d.lastNotice = false, now
			return &Notice{Kind: "recovered", Cause: "ready"}
		}
		return nil
	}
	d.successes = 0
	if d.failures < d.failureThreshold {
		d.failures++
	}
	if d.failures < d.failureThreshold || d.incident && now.Sub(d.lastNotice) < d.cooldown {
		return nil
	}
	kind := "outage"
	if d.incident {
		kind = "reminder"
	}
	d.incident, d.lastNotice = true, now
	cause := "probe_failed"
	switch sample.Cause {
	case "probe_failed", "http_unavailable", "invalid_response", "not_ready", "invalid_identity", "release_mismatch":
		cause = sample.Cause
	}
	return &Notice{Kind: kind, Cause: cause}
}
