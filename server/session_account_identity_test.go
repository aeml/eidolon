package main

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type fakeSessionIdentity struct {
	matches bool
	err     error
	calls   int
	after   func()
}

func (s *fakeSessionIdentity) MatchAccountIdentity(string, primitive.ObjectID) (bool, error) {
	s.calls++
	if s.after != nil {
		s.after()
	}
	return s.matches, s.err
}

func sessionIdentityFixture(t *testing.T) *fakeSessionIdentity {
	t.Helper()
	strictCharacterIdentityFixture(t)
	isolatedResumeTokens(t)
	old := sessionAccountIdentities
	store := &fakeSessionIdentity{matches: true}
	sessionAccountIdentities = store
	t.Cleanup(func() { sessionAccountIdentities = old })
	return store
}

func TestSessionIdentityPinAndTokenCannotRebind(t *testing.T) {
	sessionIdentityFixture(t)
	owner := &Client{username: "owner"}
	id, replacement := primitive.NewObjectID(), primitive.NewObjectID()
	if pinClientAccountID(owner, primitive.NilObjectID) {
		t.Fatal("zero generation accepted")
	}
	if _, err := issueResumeToken("owner", owner); err == nil {
		t.Fatal("unbound production token issued")
	}
	if !pinClientAccountID(owner, id) || !pinClientAccountID(owner, id) || pinClientAccountID(owner, replacement) {
		t.Fatal("immutable generation rebound")
	}
	token, err := issueResumeToken("owner", owner)
	if err != nil {
		t.Fatal(err)
	}
	if actual, ok := resumeTokenIdentity(token, "owner"); !ok || actual != id {
		t.Fatal("token lost captured identity")
	}
	if _, ok := resumeTokenIdentity(token, "other"); ok {
		t.Fatal("wrong token owner admitted")
	}
	if !currentCharacterConnection(owner) {
		t.Fatal("pinned owner rejected")
	}
	if currentCharacterConnection(&Client{username: "owner"}) {
		t.Fatal("unbound production connection admitted")
	}
}

func TestSessionIdentityLateFailureAndLiveReplacementRefuse(t *testing.T) {
	for _, scenario := range []string{"success", "missing", "storage", "closed-late", "live-replacement-late"} {
		t.Run(scenario, func(t *testing.T) {
			store := sessionIdentityFixture(t)
			id := primitive.NewObjectID()
			c := &Client{username: "owner"}
			pinClientAccountID(c, id)
			world = &game.World{Entities: map[string]*game.Entity{"player-owner": {ID: "player-owner", Type: game.TypePlayer, PersistenceAccountID: id}}}
			switch scenario {
			case "missing":
				store.matches = false
			case "storage":
				store.err = errors.New("private storage failure")
			case "closed-late":
				store.after = func() { c.markTransportClosed() }
			case "live-replacement-late":
				store.after = func() { world.Entities["player-owner"].PersistenceAccountID = primitive.NewObjectID() }
			}
			if got := sessionAccountIdentityCurrent(c, "owner", id); got != (scenario == "success") {
				t.Fatal("late/current identity gate", scenario, got)
			}
			if clientAccountID(c) != id {
				t.Fatal("failed check rebound client")
			}
		})
	}
}

func TestSessionIdentityResumeRefusalDoesNotConsumeTokenOrAdmitRecipient(t *testing.T) {
	store := sessionIdentityFixture(t)
	store.matches = false
	id := primitive.NewObjectID()
	owner := &Client{username: "owner"}
	pinClientAccountID(owner, id)
	token, err := issueResumeToken("owner", owner)
	if err != nil {
		t.Fatal(err)
	}
	owner.markTransportClosedAt(time.Now())
	recipient := &Client{send: make(chan []byte, 4)}
	payload, _ := json.Marshal(map[string]string{"token": token})
	recipient.dispatchMessage(Message{Type: MsgResumeSession, Payload: payload})
	if recipient.username != "" || !clientAccountID(recipient).IsZero() || recipient.playerID != "" {
		t.Fatal("rejected recipient partially admitted")
	}
	frames := drainSentMessages(recipient.send)
	if len(frames) != 1 || frames[0].Type != MsgError {
		t.Fatal("no generic refusal", frames)
	}
	if actual, ok := resumeTokenIdentity(token, "owner"); !ok || actual != id {
		t.Fatal("failed identity check burned/changed token")
	}
}
