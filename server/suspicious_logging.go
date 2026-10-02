package main

import (
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"
)

const maxSuspiciousPeers = 4096

type ipThrottle struct {
	mu        sync.Mutex
	last      map[string]time.Time
	nextPrune time.Time
	maxPeers  int
}

func newIPThrottle() *ipThrottle {
	return &ipThrottle{last: make(map[string]time.Time), maxPeers: maxSuspiciousPeers}
}

func (t *ipThrottle) allow(ip string, cooldown time.Duration) bool {
	return t.allowAt(ip, cooldown, time.Now())
}

func (t *ipThrottle) allowAt(ip string, cooldown time.Duration, now time.Time) bool {
	if cooldown <= 0 {
		return true // No key retained when per-peer stdout sampling is disabled.
	}
	ip = boundedLogField(ip, 64)
	t.mu.Lock()
	defer t.mu.Unlock()
	if !now.Before(t.nextPrune) {
		for peer, last := range t.last {
			if !now.Before(last) && now.Sub(last) >= cooldown {
				delete(t.last, peer)
			}
		}
		t.nextPrune = now.Add(30 * time.Second)
	}
	if last, ok := t.last[ip]; ok {
		if now.Before(last) || now.Sub(last) < cooldown {
			return false
		}
	} else if len(t.last) >= t.maxPeers {
		return false // Diagnostic sampling, never account/gameplay admission.
	}
	t.last[ip] = now
	return true
}

func canonicalDiagnosticIP(raw string) string {
	address, err := netip.ParseAddr(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	return address.WithZone("").Unmap().String()
}

func transportPeerIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if ip := canonicalDiagnosticIP(host); ip != "" {
		return ip
	}
	return "unknown"
}

// Forwarded IP is explicitly reported/unverified diagnostic data. It is not
// authority and cannot create keys in a credential or diagnostic admission map.
func requestIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		first, _, _ := strings.Cut(xff, ",")
		if ip := canonicalDiagnosticIP(first); ip != "" {
			return ip
		}
	}
	if ip := canonicalDiagnosticIP(r.Header.Get("X-Real-IP")); ip != "" {
		return ip
	}
	return transportPeerIP(r)
}

type suspiciousTrafficBudget struct {
	mu         sync.Mutex
	bucket     messageRateBucket
	suppressed uint64
}

func newSuspiciousTrafficBudget() *suspiciousTrafficBudget {
	return &suspiciousTrafficBudget{bucket: messageRateBucket{tokens: 20}}
}

// One shared diagnostic budget: twenty initial lines, then one per second.
// Fixed memory and a count on the next emitted line, not a new log per drop.
// This does not sample the separate durable administrator/session audit.
func (g *suspiciousTrafficBudget) allowAt(now time.Time) (uint64, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if !consumeRateBucket(&g.bucket, messagePolicy{burst: 20, window: 20 * time.Second}, now) {
		if g.suppressed < ^uint64(0) {
			g.suppressed++
		}
		return 0, false
	}
	dropped := g.suppressed
	g.suppressed = 0
	return dropped, true
}

func boundedLogField(value string, maxBytes int) string {
	if len(value) <= maxBytes {
		return value
	}
	return value[:maxBytes] + "...[truncated]"
}

func logSuspicious(r *http.Request, reason string, err error) {
	logSuspiciousAt(r, reason, err, time.Now())
}

func logSuspiciousAt(r *http.Request, reason string, err error, now time.Time) {
	file := suspiciousFileLogger != nil
	stdout := suspiciousStdoutLogger != nil && *suspiciousStdout && suspiciousLogThrottle.allowAt(transportPeerIP(r), *suspiciousCooldown, now)
	if !file && !stdout {
		return
	}
	suppressed, allowed := suspiciousLogBudget.allowAt(now)
	if !allowed {
		return
	}
	path, failure := "", ""
	if r.URL != nil {
		path = r.URL.Path // Never include query strings, cookies, or authorization.
	}
	if err != nil {
		failure = err.Error()
	}
	line := fmt.Sprintf("peer_ip=%q reported_ip=%q method=%q path=%q reason=%q ua=%q err=%q suppressed=%d",
		transportPeerIP(r), requestIP(r), boundedLogField(r.Method, 16), boundedLogField(path, 256),
		boundedLogField(reason, 128), boundedLogField(r.UserAgent(), 128), boundedLogField(failure, 256), suppressed)
	if file {
		suspiciousFileLogger.Print(line)
	}
	if stdout {
		suspiciousStdoutLogger.Print(line)
	}
}
