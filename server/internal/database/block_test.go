package database

import "testing"

func TestBlockLifecycleReplacesFriendship(t *testing.T) {
	db := newFriendshipDB(t)
	alice := uniqueID("blocker")
	bob := uniqueID("blocked")
	if err := db.SendFriendRequest(alice, bob); err != nil {
		t.Fatal(err)
	}
	if err := db.AcceptFriendRequest(alice, bob); err != nil {
		t.Fatal(err)
	}
	if err := db.BlockPlayer(alice, bob); err != nil {
		t.Fatal(err)
	}

	friends, err := db.GetFriends(alice)
	if err != nil {
		t.Fatal(err)
	}
	if len(friends) != 0 {
		t.Fatalf("blocked player remained a friend: %+v", friends)
	}
	blocked, err := db.GetBlockedPlayers(alice)
	if err != nil {
		t.Fatal(err)
	}
	if len(blocked) != 1 || blocked[0].AddresseeID != bob || blocked[0].Status != FriendshipBlocked {
		t.Fatalf("unexpected block rows: %+v", blocked)
	}
	if err := db.SendFriendRequest(bob, alice); err == nil {
		t.Fatal("friend request bypassed an existing block")
	}
	if err := db.UnblockPlayer(alice, bob); err != nil {
		t.Fatal(err)
	}
	if err := db.SendFriendRequest(bob, alice); err != nil {
		t.Fatalf("friend request did not recover after unblock: %v", err)
	}
}

func TestIgnoreLifecycleIsDirected(t *testing.T) {
	db := newFriendshipDB(t)
	alice := uniqueID("ignorer")
	bob := uniqueID("ignored")
	if err := db.IgnorePlayer(alice, bob); err != nil {
		t.Fatal(err)
	}
	ignored, err := db.GetIgnoredPlayers(alice)
	if err != nil {
		t.Fatal(err)
	}
	if len(ignored) != 1 || ignored[0].RequesterID != alice || ignored[0].AddresseeID != bob || ignored[0].Status != FriendshipIgnored {
		t.Fatalf("unexpected ignore rows: %+v", ignored)
	}
	otherIgnored, err := db.GetIgnoredPlayers(bob)
	if err != nil || len(otherIgnored) != 0 {
		t.Fatalf("ignore unexpectedly became bidirectional: rows=%+v err=%v", otherIgnored, err)
	}
	if err := db.UnignorePlayer(alice, bob); err != nil {
		t.Fatal(err)
	}
}
