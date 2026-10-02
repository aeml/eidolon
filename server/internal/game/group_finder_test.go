package game

import (
	"testing"
	"time"
)

func groupFinderFixture() (*World, time.Time) {
	w := newPvPTestWorld(&Entity{ID: "owner", Name: "Owner", Type: TypePlayer, Level: 100},
		&Entity{ID: "applicant", Name: "Applicant", Type: TypePlayer, Level: 70}, &Entity{ID: "observer", Name: "Observer", Type: TypePlayer, Level: 100})
	return w, time.Now()
}

func TestGroupFinderValidatesLevelsAndListingOwnership(t *testing.T) {
	w, now := groupFinderFixture()
	for _, input := range []struct {
		mode, activity, role string
		level                int
	}{
		{"bad", "world", "tank", 1}, {"looking", "invented", "tank", 1}, {"looking", "world", "admin", 1}, {"looking", "molten_core", "tank", 30},
	} {
		if err := w.PostGroupListing("owner", input.mode, input.activity, input.role, "", input.level, now); err == nil {
			t.Fatal("invalid listing accepted", input)
		}
	}
	if err := w.PostGroupListing("owner", "recruit", "molten_core", "healer", "A careful first clear", 70, now); err != nil {
		t.Fatal(err)
	}
	w.CreateParty("observer")
	if err := w.JoinParty(w.Entities["observer"].PartyID, "owner"); err != nil {
		t.Fatal(err)
	}
	if listings := w.GroupFinderListings("observer", now); len(listings) != 0 {
		t.Fatal("former solo poster advertised a party they do not lead")
	}
	if err := w.PostGroupListing("owner", "recruit", "world", "tank", "", 1, now); err == nil {
		t.Fatal("nonleader recruited")
	}
}

func TestGroupFinderPublicLabelsRefreshWithoutChangingRequestIdentity(t *testing.T) {
	w, now := groupFinderFixture()
	if err := w.PostGroupListing("owner", "recruit", "world", "healer", "", 1, now); err != nil {
		t.Fatal(err)
	}
	listingID := w.GroupFinderListings("applicant", now)[0].ID
	if err := w.RequestGroupListing("applicant", "owner", listingID, "healer", now); err != nil {
		t.Fatal(err)
	}
	requestID := w.GroupFinderListings("owner", now)[0].Applicants[0].ID
	w.SetPlayerPublicName("owner", "Arcanis Dawn")
	w.SetPlayerPublicName("applicant", "Moon Keeper")
	listing := w.GroupFinderListings("owner", now)[0]
	if listing.Name != "Arcanis Dawn" || listing.OwnerID != "owner" || listing.ID != listingID || listing.Applicants[0].Name != "Moon Keeper" || listing.Applicants[0].PlayerID != "applicant" || listing.Applicants[0].ID != requestID {
		t.Fatal("public labels failed to refresh or changed request authority", listing)
	}
	if err := w.CancelGroupRequest("owner", "applicant", listingID, requestID); err != nil {
		t.Fatal("corrected label invalidated existing request", err)
	}
}

func TestGroupFinderRequestsArePrivateDetachedAndNeverJoinAutomatically(t *testing.T) {
	w, now := groupFinderFixture()
	if err := w.PostGroupListing("owner", "recruit", "world", "healer", "", 1, now); err != nil {
		t.Fatal(err)
	}
	listingID := w.GroupFinderListings("applicant", now)[0].ID
	if err := w.RequestGroupListing("applicant", "owner", listingID, "healer", now); err != nil {
		t.Fatal(err)
	}
	if w.Entities["applicant"].PartyID != "" || w.Entities["owner"].PartyID != "" {
		t.Fatal("request forged a party invitation or membership")
	}
	if listing := w.GroupFinderListings("observer", now)[0]; len(listing.Applicants) != 0 || listing.Requested {
		t.Fatal("private applicants leaked to another viewer")
	}
	if listing := w.GroupFinderListings("applicant", now)[0]; !listing.Requested || len(listing.Applicants) != 0 {
		t.Fatal("requester did not get only their own pending state")
	}
	owned := w.GroupFinderListings("owner", now)
	if len(owned[0].Applicants) != 1 {
		t.Fatal("leader cannot see request")
	}
	owned[0].Applicants[0].Name = "mutated"
	if w.GroupFinderListings("owner", now)[0].Applicants[0].Name != "Applicant" {
		t.Fatal("snapshot aliased authority")
	}
	if err := w.CancelGroupRequest("owner", "applicant", listingID, owned[0].Applicants[0].ID); err != nil {
		t.Fatal(err)
	}
	if w.GroupFinderListings("applicant", now)[0].Requested {
		t.Fatal("request cancellation did not clear pending state")
	}
}

func TestGroupFinderPrunesExpiredUnavailableFullAndGroupedListings(t *testing.T) {
	for _, reason := range []string{"expiry", "offline", "busy", "full", "joined"} {
		t.Run(reason, func(t *testing.T) {
			w, now := groupFinderFixture()
			mode := "recruit"
			if reason == "joined" {
				mode = "looking"
			}
			if err := w.PostGroupListing("owner", mode, "world", "flexible", "", 1, now); err != nil {
				t.Fatal(err)
			}
			switch reason {
			case "expiry":
				now = now.Add(20 * time.Minute)
			case "offline":
				w.Entities["owner"].Disconnected = true
			case "busy":
				w.Entities["owner"].SocialStatus = "busy"
			case "joined":
				w.CreateParty("owner")
			case "full":
				p := w.CreateParty("owner")
				p.MaxSize = 1
			}
			if len(w.GroupFinderListings("observer", now)) != 0 {
				t.Fatal("stale listing survived", reason)
			}
		})
	}
}

func TestGroupFinderRequestsExpireAndCannotBypassMinLevel(t *testing.T) {
	w, now := groupFinderFixture()
	if err := w.PostGroupListing("owner", "recruit", "umbral_nexus", "damage", "", 100, now); err != nil {
		t.Fatal(err)
	}
	listingID := w.GroupFinderListings("applicant", now)[0].ID
	if err := w.RequestGroupListing("applicant", "owner", listingID, "damage", now); err == nil {
		t.Fatal("underlevel application accepted")
	}
	if err := w.RequestGroupListing("observer", "owner", listingID, "damage", now); err != nil {
		t.Fatal(err)
	}
	if len(w.GroupFinderListings("owner", now.Add(5*time.Minute))[0].Applicants) != 0 {
		t.Fatal("expired application survived")
	}
}
