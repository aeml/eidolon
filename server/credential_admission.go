package main

import (
	"crypto/sha256"
	"errors"
	"sync"
	"time"
)

const (
	defaultCredentialConcurrency = 4
	maxCredentialConcurrency     = 32
	maxCredentialAccounts        = 4096
)

var (
	credentialAdmission = newCredentialWorkGate(defaultCredentialConcurrency)
	errCredentialsBusy  = errors.New("Account service is busy. Please retry shortly.")
	errCredentialRate   = errors.New("Too many attempts for this account. Please wait before retrying.")
)

type credentialAccountKey struct {
	kind string
	hash [sha256.Size]byte
}

// Shared across connections, not keyed by an untrusted forwarding header or
// a proxy/shared household address. Hashing bounds retained username memory;
// these ephemeral keys are neither account records nor credential telemetry.
type credentialWorkGate struct {
	mu        sync.Mutex
	accounts  map[credentialAccountKey]*messageRateBucket
	nextPrune time.Time
	maxKeys   int
	slots     chan struct{}
}

func newCredentialWorkGate(concurrency int) *credentialWorkGate {
	return &credentialWorkGate{
		accounts: make(map[credentialAccountKey]*messageRateBucket),
		maxKeys:  maxCredentialAccounts,
		slots:    make(chan struct{}, concurrency),
	}
}

// begin bounds credential queries/hashes, without adding a global lock around
// gameplay or queuing an unbounded number of password jobs. A busy rejection
// does not consume the account's retry allowance. Admission is RAM-only and
// preserves exact-case usernames and the existing five-per-minute policies.
func (g *credentialWorkGate) begin(kind, username string, now time.Time) (func(), error) {
	if kind != MsgOwnerExportSection && kind != MsgLogin && kind != MsgRegister && kind != MsgChangePassword && kind != MsgSetRecoveryEmail && kind != MsgRequestPasswordRecovery && kind != MsgConfirmRecoveryEmail && kind != MsgCompletePasswordRecovery {
		return nil, errCredentialsBusy
	}
	select {
	case g.slots <- struct{}{}:
	default:
		return nil, errCredentialsBusy
	}
	var once sync.Once
	done := func() { once.Do(func() { <-g.slots }) }
	g.mu.Lock()
	defer g.mu.Unlock()
	if !now.Before(g.nextPrune) {
		for key, bucket := range g.accounts {
			p := inboundMessagePolicies[key.kind]
			if !now.Before(bucket.updated) &&
				bucket.tokens+now.Sub(bucket.updated).Seconds()*float64(p.burst)/p.window.Seconds() >= float64(p.burst) {
				delete(g.accounts, key)
			}
		}
		g.nextPrune = now.Add(time.Minute)
	}
	key := credentialAccountKey{kind: kind, hash: sha256.Sum256([]byte(username))}
	p := inboundMessagePolicies[kind]
	bucket := g.accounts[key]
	if bucket == nil {
		if len(g.accounts) >= g.maxKeys {
			done()
			return nil, errCredentialsBusy
		}
		bucket = &messageRateBucket{tokens: float64(p.burst), updated: now}
		g.accounts[key] = bucket
	}
	if !consumeRateBucket(bucket, p, now) {
		done()
		return nil, errCredentialRate
	}
	return done, nil
}
