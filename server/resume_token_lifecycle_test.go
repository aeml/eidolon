package main

import (
	"eidolon-server/internal/game"
	"eidolon-server/internal/lifecycle"
	"encoding/hex"
	"sync"
	"testing"
	"time"
)

func isolatedResumeTokens(t *testing.T) {
	t.Helper()
	resumeTokensMu.Lock()
	oldTokens, oldUsers := resumeTokens, resumeByUser
	resumeTokens, resumeByUser = map[string]*resumeTokenEntry{}, map[string]string{}
	resumeTokensMu.Unlock()
	t.Cleanup(func() {
		resumeTokensMu.Lock()
		resumeTokens, resumeByUser = oldTokens, oldUsers
		resumeTokensMu.Unlock()
	})
}

func ownedResumeToken(t *testing.T, username string) (*Client, string) {
	t.Helper()
	owner := &Client{username: username}
	token, err := issueResumeToken(username, owner)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := hex.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		t.Fatal("not a 32-byte hex resume token")
	}
	return owner, token
}

func TestResumeTokenLongActivePlayThenFirstClosure(t *testing.T) {
	isolatedResumeTokens(t)
	owner, token := ownedResumeToken(t, "long-play")
	// Trusted clock probes, no long sleep or real account. Even after a hundred
	// hours, an open owner cannot be displaced and its token is not consumed.
	disconnect := time.Now().Add(100 * time.Hour)
	if _, ok := validateAndConsumeResumeTokenAt(token, disconnect); ok {
		t.Fatal("live owner displaced")
	}
	pruneResumeTokens(disconnect)
	owner.markTransportClosedAt(disconnect)
	owner.markTransportClosedAt(disconnect.Add(4 * time.Minute))
	if !owner.transportClosedAt.Load().Equal(disconnect) {
		t.Fatal("repeated closure extended grace")
	}
	if user, ok := validateAndConsumeResumeTokenAt(token, disconnect.Add(resumeWindow-time.Nanosecond)); !ok || user != "long-play" {
		t.Fatal("long play spent the reconnect window")
	}
	if _, ok := validateAndConsumeResumeTokenAt(token, disconnect.Add(time.Second)); ok {
		t.Fatal("consumed token replayed")
	}
}

func TestResumeTokenExactExpiryCannotBeExtendedByLaterCleanup(t *testing.T) {
	isolatedResumeTokens(t)
	owner, token := ownedResumeToken(t, "expires")
	closed := time.Now()
	owner.markTransportClosedAt(closed)
	owner.closeSendQueues()
	if _, ok := validateAndConsumeResumeTokenAt(token, closed.Add(resumeWindow)); ok {
		t.Fatal("expiry boundary accepted")
	}
	if len(resumeTokens) != 0 || len(resumeByUser) != 0 {
		t.Fatal("expired token retained")
	}
}

func TestResumeTokenReplacementIsBoundToItsNewOwner(t *testing.T) {
	isolatedResumeTokens(t)
	oldOwner, oldToken := ownedResumeToken(t, "same-account")
	newOwner, newToken := ownedResumeToken(t, "same-account")
	if oldToken == newToken {
		t.Fatal("rotation reused token")
	}
	closed := time.Now()
	oldOwner.markTransportClosedAt(closed)
	if _, ok := validateAndConsumeResumeTokenAt(oldToken, closed); ok {
		t.Fatal("revoked token accepted")
	}
	if _, ok := validateAndConsumeResumeTokenAt(newToken, closed); ok {
		t.Fatal("old closure authorized new token")
	}
	newOwner.markTransportClosedAt(closed.Add(time.Minute))
	if user, ok := validateAndConsumeResumeTokenAt(newToken, closed.Add(2*time.Minute)); !ok || user != "same-account" {
		t.Fatal("new owner's token was consumed by old transport")
	}
}

func TestResumeTokenConcurrentConsumeHasOneWinner(t *testing.T) {
	isolatedResumeTokens(t)
	owner, token := ownedResumeToken(t, "concurrent")
	closed := time.Now()
	owner.markTransportClosedAt(closed)
	var group sync.WaitGroup
	winners := make(chan string, 32)
	for i := 0; i < cap(winners); i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			if user, ok := validateAndConsumeResumeTokenAt(token, closed.Add(time.Second)); ok {
				winners <- user
			}
		}()
	}
	group.Wait()
	close(winners)
	if len(winners) != 1 {
		t.Fatal("not exactly one token consumer", len(winners))
	}
}

func TestResumeTokenDifferentAuthenticatedAccountCannotBurnItsOwnerToken(t *testing.T) {
	isolatedResumeTokens(t)
	owner, token := ownedResumeToken(t, "token-owner")
	closed := time.Now()
	owner.markTransportClosedAt(closed)
	if _, ok := validateAndConsumeResumeTokenFor(token, "other-account", closed); ok {
		t.Fatal("authenticated account switched with another owner's token")
	}
	if user, ok := validateAndConsumeResumeTokenFor(token, "token-owner", closed.Add(time.Second)); !ok || user != "token-owner" {
		t.Fatal("wrong-account request consumed the owner's token")
	}
}

func TestResumeTokenSweepRetainsLiveOwnersAndRemovesExpiredClosures(t *testing.T) {
	isolatedResumeTokens(t)
	_, liveToken := ownedResumeToken(t, "live")
	closedOwner, closedToken := ownedResumeToken(t, "closed")
	closed := time.Now()
	closedOwner.markTransportClosedAt(closed)
	pruneResumeTokens(closed.Add(resumeWindow))
	if len(resumeTokens) != 1 || resumeTokens[liveToken] == nil || resumeTokens[closedToken] != nil || resumeByUser["closed"] != "" {
		t.Fatal("sweep removed live owner or retained expired token")
	}
}

func TestResumeTokenRequiresAuthenticatedOwnerAndKnownClosure(t *testing.T) {
	isolatedResumeTokens(t)
	for _, owner := range []*Client{nil, {username: "other"}} {
		if token, err := issueResumeToken("wanted", owner); err == nil || token != "" {
			t.Fatal("unbound owner issued token")
		}
	}
	owner, token := ownedResumeToken(t, "missing-clock")
	owner.transportClosed.Store(true) // Deliberately broken legacy/internal state.
	if _, ok := validateAndConsumeResumeTokenAt(token, time.Now()); ok {
		t.Fatal("unknown closure granted an unbounded window")
	}
}

func TestResumeTokenAndEntityCleanupShareFirstClosure(t *testing.T) {
	isolatedResumeTokens(t)
	sessionActivityFixture(t)
	oldWorld, oldDB, oldSessions, oldWork := world, db, activeSessions, backgroundCharacterWork
	world, db, activeSessions = game.NewWorld(nil), nil, map[string]*Client{}
	backgroundCharacterWork = &lifecycle.Group{}
	// This is a cleanup/timing fixture, not delivery to real friends or guilds.
	backgroundCharacterWork.CloseAndWait()
	t.Cleanup(func() { world, db, activeSessions, backgroundCharacterWork = oldWorld, oldDB, oldSessions, oldWork })
	owner, token := ownedResumeToken(t, "delayed-cleanup")
	owner.playerID = "player-delayed-cleanup"
	activeSessions[owner.username] = owner
	entity := &game.Entity{ID: owner.playerID, Type: game.TypePlayer, State: "IDLE", Health: 17, MaxHealth: 100}
	world.AddEntity(entity)
	closed := time.Now().Add(-2 * time.Minute)
	owner.markTransportClosedAt(closed)
	cleanupClient(owner)
	cleanupClient(owner)
	if !entity.Disconnected || !entity.DisconnectedAt.Equal(closed) || activeSessions[owner.username] != nil {
		t.Fatal("queued/repeated cleanup changed the first closure or retained the session")
	}
	if _, ok := validateAndConsumeResumeTokenAt(token, closed.Add(resumeWindow)); ok {
		t.Fatal("cleanup granted extra token grace")
	}
}

func TestTransportClosureClockIsFirstWriteEvenWithConcurrentObservers(t *testing.T) {
	owner := &Client{}
	first := time.Now()
	owner.markTransportClosedAt(first)
	var group sync.WaitGroup
	for i := 0; i < 32; i++ {
		group.Add(1)
		go func(i int) {
			defer group.Done()
			owner.markTransportClosedAt(first.Add(time.Duration(i+1) * time.Minute))
		}(i)
	}
	group.Wait()
	if !owner.transportClosed.Load() || !owner.transportClosedAt.Load().Equal(first) {
		t.Fatal("another closure observer extended the window")
	}
}
