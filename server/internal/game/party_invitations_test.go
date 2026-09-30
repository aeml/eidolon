package game

import (
	"sync"
	"testing"
	"time"
)

func invitationFixture() (*World, *Party, time.Time) {
	w := newPvPTestWorld(&Entity{ID: "leader", Type: TypePlayer}, &Entity{ID: "target", Type: TypePlayer}, &Entity{ID: "other", Type: TypePlayer})
	return w, w.CreateParty("leader"), time.Now()
}

func TestPartyInvitationRequiresConsentAndCanOnlyBeUsedOnce(t *testing.T) {
	w, party, now := invitationFixture()
	if _, err := w.RespondPartyInvitation("target", "leader", "forged", true, now); err == nil {
		t.Fatal("forged response joined without an invitation")
	}
	invite, err := w.IssuePartyInvitation("leader", "target", now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.RespondPartyInvitation("target", "other", invite.ID, true, now); err == nil {
		t.Fatal("wrong inviter consumed consent")
	}
	joined, err := w.RespondPartyInvitation("target", "leader", invite.ID, true, now)
	if err != nil || joined != party || w.Entities["target"].PartyID != party.ID {
		t.Fatal("valid acceptance failed", err)
	}
	if _, err := w.RespondPartyInvitation("target", "leader", invite.ID, true, now); err == nil {
		t.Fatal("replayed invitation was accepted")
	}
}

func TestPartyInvitationRechecksExpiryPartyIdentityLeadershipAndAvailability(t *testing.T) {
	for _, change := range []string{"expired", "declined", "replaced-party", "leader", "busy", "offline", "full", "already-grouped"} {
		t.Run(change, func(t *testing.T) {
			w, party, now := invitationFixture()
			invite, err := w.IssuePartyInvitation("leader", "target", now)
			if err != nil {
				t.Fatal(err)
			}
			switch change {
			case "expired":
				now = now.Add(time.Minute)
			case "declined":
				if _, err := w.RespondPartyInvitation("target", "leader", invite.ID, false, now); err != nil {
					t.Fatal(err)
				}
			case "replaced-party":
				w.Parties[party.ID] = &Party{ID: party.ID, LeaderID: "leader", Members: []string{"leader"}, MaxSize: 5}
			case "leader":
				party.LeaderID = "other"
			case "busy":
				w.Entities["target"].SocialStatus = "busy"
			case "offline":
				w.Entities["leader"].Disconnected = true
			case "full":
				party.MaxSize = 1
			case "already-grouped":
				w.CreateParty("target")
			}
			if _, err := w.RespondPartyInvitation("target", "leader", invite.ID, true, now); err == nil {
				t.Fatal("invalidated invitation was accepted")
			}
			if w.Entities["target"].PartyID == party.ID {
				t.Fatal("rejected invitation changed membership")
			}
		})
	}
}

func TestConcurrentPartyInvitationAcceptancesCannotOverfill(t *testing.T) {
	w, party, now := invitationFixture()
	party.MaxSize = 2
	invitations := map[string]string{}
	for _, target := range []string{"target", "other"} {
		invite, err := w.IssuePartyInvitation("leader", target, now)
		if err != nil {
			t.Fatal(err)
		}
		invitations[target] = invite.ID
	}
	var group sync.WaitGroup
	for _, target := range []string{"target", "other"} {
		group.Add(1)
		go func(target string) {
			defer group.Done()
			_, _ = w.RespondPartyInvitation(target, "leader", invitations[target], true, now)
		}(target)
	}
	group.Wait()
	_, _, members := party.GetSnapshot()
	if len(members) != 2 {
		t.Fatal("concurrent invitations overfilled the party", members)
	}
}

func TestPartyInvitationsCannotChangeAlliancesDuringAnArenaMatch(t *testing.T) {
	w, _, now := invitationFixture()
	invite, err := w.IssuePartyInvitation("leader", "target", now)
	if err != nil {
		t.Fatal(err)
	}
	startTestPvPMatch(w, PvPModeDuel, []string{"leader"}, []string{"target"})
	if _, err := w.RespondPartyInvitation("target", "leader", invite.ID, true, now); err == nil {
		t.Fatal("pending invite changed arena opponents into allies")
	}
	if _, err := w.IssuePartyInvitation("leader", "target", now); err == nil {
		t.Fatal("arena opponent received a new party invite")
	}
}
