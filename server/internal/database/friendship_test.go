package database

// Integration tests for Friendship DB methods (0.38.0).
// All tests are skipped when MONGO_URI is not set.

import (
	"fmt"
	"os"
	"testing"
	"time"
)

func newFriendshipDB(t *testing.T) *DB {
	t.Helper()
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("Skipping friendship DB integration test: MONGO_URI not set")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	t.Cleanup(func() { _ = db.client.Disconnect(nil) })
	return db
}

// uniqueID returns a player-ID-style string that is unique per test run.
func uniqueID(prefix string) string {
	return fmt.Sprintf("player-%s-%d", prefix, time.Now().UnixNano())
}

// ---------------------------------------------------------------------------
// SendFriendRequest
// ---------------------------------------------------------------------------

func TestSendFriendRequest_InsertsDocument(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("a"), uniqueID("b")

	if err := db.SendFriendRequest(a, b); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	f, err := db.GetFriendship(a, b)
	if err != nil {
		t.Fatalf("GetFriendship error: %v", err)
	}
	if f == nil {
		t.Fatal("expected friendship document, got nil")
	}
	if f.Status != FriendshipPending {
		t.Errorf("expected status %q, got %q", FriendshipPending, f.Status)
	}
	if f.RequesterID != a || f.AddresseeID != b {
		t.Errorf("unexpected ids: requester=%q addressee=%q", f.RequesterID, f.AddresseeID)
	}
}

func TestSendFriendRequest_SelfReturnsError(t *testing.T) {
	db := newFriendshipDB(t)
	a := uniqueID("self")

	err := db.SendFriendRequest(a, a)
	if err == nil {
		t.Fatal("expected error for self-request, got nil")
	}
}

func TestSendFriendRequest_DuplicateRejected(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("dup-a"), uniqueID("dup-b")

	if err := db.SendFriendRequest(a, b); err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	err := db.SendFriendRequest(a, b)
	if err == nil {
		t.Fatal("expected error for duplicate request, got nil")
	}
}

func TestSendFriendRequest_ReverseDirectionRejected(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("rev-a"), uniqueID("rev-b")

	if err := db.SendFriendRequest(a, b); err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	// B tries to add A while A's request is still pending.
	err := db.SendFriendRequest(b, a)
	if err == nil {
		t.Fatal("expected error when reverse relationship already exists, got nil")
	}
}

// ---------------------------------------------------------------------------
// AcceptFriendRequest
// ---------------------------------------------------------------------------

func TestAcceptFriendRequest_SetsAccepted(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("acc-a"), uniqueID("acc-b")

	if err := db.SendFriendRequest(a, b); err != nil {
		t.Fatalf("SendFriendRequest: %v", err)
	}
	if err := db.AcceptFriendRequest(a, b); err != nil {
		t.Fatalf("AcceptFriendRequest: %v", err)
	}

	f, err := db.GetFriendship(a, b)
	if err != nil || f == nil {
		t.Fatalf("GetFriendship: %v, %v", f, err)
	}
	if f.Status != FriendshipAccepted {
		t.Errorf("expected status %q, got %q", FriendshipAccepted, f.Status)
	}
}

func TestAcceptFriendRequest_NotFoundReturnsError(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("nf-a"), uniqueID("nf-b")

	err := db.AcceptFriendRequest(a, b)
	if err == nil {
		t.Fatal("expected error accepting non-existent request, got nil")
	}
}

// ---------------------------------------------------------------------------
// DeclineFriendRequest
// ---------------------------------------------------------------------------

func TestDeclineFriendRequest_RemovesDocument(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("dec-a"), uniqueID("dec-b")

	if err := db.SendFriendRequest(a, b); err != nil {
		t.Fatalf("SendFriendRequest: %v", err)
	}
	if err := db.DeclineFriendRequest(a, b); err != nil {
		t.Fatalf("DeclineFriendRequest: %v", err)
	}

	f, err := db.GetFriendship(a, b)
	if err != nil {
		t.Fatalf("GetFriendship: %v", err)
	}
	if f != nil {
		t.Fatal("expected nil after decline, got a document")
	}
}

func TestDeclineFriendRequest_NotFoundReturnsError(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("dnf-a"), uniqueID("dnf-b")

	err := db.DeclineFriendRequest(a, b)
	if err == nil {
		t.Fatal("expected error declining non-existent request, got nil")
	}
}

// ---------------------------------------------------------------------------
// RemoveFriend
// ---------------------------------------------------------------------------

func TestRemoveFriend_DeletesAcceptedFriendship(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("rm-a"), uniqueID("rm-b")

	if err := db.SendFriendRequest(a, b); err != nil {
		t.Fatalf("SendFriendRequest: %v", err)
	}
	if err := db.AcceptFriendRequest(a, b); err != nil {
		t.Fatalf("AcceptFriendRequest: %v", err)
	}
	if err := db.RemoveFriend(a, b); err != nil {
		t.Fatalf("RemoveFriend: %v", err)
	}

	f, err := db.GetFriendship(a, b)
	if err != nil {
		t.Fatalf("GetFriendship: %v", err)
	}
	if f != nil {
		t.Fatal("expected nil after remove, got document")
	}
}

func TestRemoveFriend_OrderIndependent(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("oi-a"), uniqueID("oi-b")

	if err := db.SendFriendRequest(a, b); err != nil {
		t.Fatalf("SendFriendRequest: %v", err)
	}
	if err := db.AcceptFriendRequest(a, b); err != nil {
		t.Fatalf("AcceptFriendRequest: %v", err)
	}
	// Remove using reversed order.
	if err := db.RemoveFriend(b, a); err != nil {
		t.Fatalf("RemoveFriend (reversed): %v", err)
	}

	f, _ := db.GetFriendship(a, b)
	if f != nil {
		t.Fatal("expected nil after reversed remove, got document")
	}
}

// ---------------------------------------------------------------------------
// GetFriends
// ---------------------------------------------------------------------------

func TestGetFriends_ReturnsOnlyAccepted(t *testing.T) {
	db := newFriendshipDB(t)
	a := uniqueID("gf-a")
	b := uniqueID("gf-b")
	c := uniqueID("gf-c") // pending — should NOT appear in accepted list

	// a–b accepted
	_ = db.SendFriendRequest(a, b)
	_ = db.AcceptFriendRequest(a, b)

	// a–c pending only
	_ = db.SendFriendRequest(a, c)

	friends, err := db.GetFriends(a)
	if err != nil {
		t.Fatalf("GetFriends: %v", err)
	}
	if len(friends) != 1 {
		t.Fatalf("expected 1 accepted friend, got %d", len(friends))
	}
	if friends[0].RequesterID != a || friends[0].AddresseeID != b {
		t.Errorf("unexpected friendship: %+v", friends[0])
	}
}

func TestGetFriends_BothSides(t *testing.T) {
	db := newFriendshipDB(t)
	a := uniqueID("bs-a")
	b := uniqueID("bs-b")
	c := uniqueID("bs-c")

	// a sends to b, b sends to c — accept both
	_ = db.SendFriendRequest(a, b)
	_ = db.AcceptFriendRequest(a, b)
	_ = db.SendFriendRequest(b, c)
	_ = db.AcceptFriendRequest(b, c)

	// b is involved in both friendships
	friends, err := db.GetFriends(b)
	if err != nil {
		t.Fatalf("GetFriends: %v", err)
	}
	if len(friends) != 2 {
		t.Fatalf("expected 2 friends for b, got %d", len(friends))
	}
}

// ---------------------------------------------------------------------------
// GetPendingRequests
// ---------------------------------------------------------------------------

func TestGetPendingRequests_ReturnsIncoming(t *testing.T) {
	db := newFriendshipDB(t)
	a := uniqueID("pr-a")
	b := uniqueID("pr-b")
	c := uniqueID("pr-c")

	// Both a and c send requests to b.
	_ = db.SendFriendRequest(a, b)
	_ = db.SendFriendRequest(c, b)

	pending, err := db.GetPendingRequests(b)
	if err != nil {
		t.Fatalf("GetPendingRequests: %v", err)
	}
	if len(pending) != 2 {
		t.Fatalf("expected 2 pending requests, got %d", len(pending))
	}
}

func TestGetPendingRequests_EmptyAfterAccept(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("pa-a"), uniqueID("pa-b")

	_ = db.SendFriendRequest(a, b)
	_ = db.AcceptFriendRequest(a, b)

	pending, err := db.GetPendingRequests(b)
	if err != nil {
		t.Fatalf("GetPendingRequests: %v", err)
	}
	if len(pending) != 0 {
		t.Fatalf("expected 0 pending after accept, got %d", len(pending))
	}
}

// ---------------------------------------------------------------------------
// GetFriendship
// ---------------------------------------------------------------------------

func TestGetFriendship_BothDirections(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("gfs-a"), uniqueID("gfs-b")

	_ = db.SendFriendRequest(a, b)

	// Query both orderings — both should return the same document.
	f1, err := db.GetFriendship(a, b)
	if err != nil || f1 == nil {
		t.Fatalf("GetFriendship(a,b): %v, %v", f1, err)
	}
	f2, err := db.GetFriendship(b, a)
	if err != nil || f2 == nil {
		t.Fatalf("GetFriendship(b,a): %v, %v", f2, err)
	}
	if f1.RequesterID != f2.RequesterID {
		t.Errorf("expected same document regardless of query order")
	}
}

func TestGetFriendship_NilWhenNoRelationship(t *testing.T) {
	db := newFriendshipDB(t)
	a, b := uniqueID("gfn-a"), uniqueID("gfn-b")

	f, err := db.GetFriendship(a, b)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f != nil {
		t.Fatal("expected nil for unknown pair, got document")
	}
}
