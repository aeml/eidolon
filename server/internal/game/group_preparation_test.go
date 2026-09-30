package game

import (
	"testing"
	"time"
)

func TestGroupFinderPlanValidationAndDetachedSnapshots(t *testing.T) {
	w, now := groupFinderFixture()
	start := now.Add(10 * time.Minute)
	for _, plan := range []GroupPlan{{MeetingPointID: "made-up"}, {MeetingPointID: "story-wizard-dark-realm"},
		{StartsAt: timePointer(now.Add(-time.Second))}, {StartsAt: timePointer(now.Add(20 * time.Minute))}} {
		if err := w.PostGroupListing("owner", "recruit", "world", "tank", "", 1, now, plan); err == nil {
			t.Fatal("invalid public plan accepted", plan)
		}
	}
	if err := w.PostGroupListing("owner", "recruit", "world", "tank", "", 1, now, GroupPlan{StartsAt: &start, MeetingPointID: "story-wizard"}); err != nil {
		t.Fatal(err)
	}
	start = start.Add(24 * time.Hour)
	listing := w.GroupFinderListings("observer", now)[0]
	if listing.Plan.StartsAt.Sub(now) != 10*time.Minute {
		t.Fatal("caller changed stored schedule")
	}
	*listing.Plan.StartsAt = now
	listing.Roles["tank"] = 500
	if current := w.GroupFinderListings("observer", now)[0]; current.Plan.StartsAt.Sub(now) != 10*time.Minute || current.Roles["tank"] == 500 {
		t.Fatal("snapshot aliased plan or roles")
	}
	for _, point := range GroupMeetingPoints() {
		if point.InstanceID != "" {
			t.Fatal("private instance advertised as public meeting point")
		}
	}
}

func timePointer(value time.Time) *time.Time { return &value }

func TestGroupFinderReplacedListingAndApplicationCannotMutateNewConsent(t *testing.T) {
	w, now := groupFinderFixture()
	post := func() string {
		t.Helper()
		if err := w.PostGroupListing("owner", "recruit", "world", "healer", "", 1, now); err != nil {
			t.Fatal(err)
		}
		return w.GroupFinderListings("owner", now)[0].ID
	}
	first := post()
	if err := w.RequestGroupListing("applicant", "owner", first, "healer", now); err != nil {
		t.Fatal(err)
	}
	application := w.GroupFinderListings("owner", now)[0].Applicants[0].ID
	second := post()
	if first == second || len(w.GroupFinderListings("owner", now)[0].Applicants) != 0 {
		t.Fatal("new plan reused old consent")
	}
	if err := w.RequestGroupListing("applicant", "owner", first, "healer", now); err == nil {
		t.Fatal("stale listing applied")
	}
	if err := w.RemoveGroupListing("owner", first); err == nil {
		t.Fatal("stale removal deleted replacement")
	}
	if err := w.RequestGroupListing("applicant", "owner", second, "healer", now); err != nil {
		t.Fatal(err)
	}
	current := w.GroupFinderListings("owner", now)[0].Applicants[0].ID
	if err := w.CancelGroupRequest("owner", "applicant", second, application); err == nil {
		t.Fatal("stale cancellation consumed newer application")
	}
	if _, err := w.IssueGroupListingInvitation("owner", "owner", "applicant", second, application, now); err == nil {
		t.Fatal("stale application issued invitation")
	}
	invite, err := w.IssueGroupListingInvitation("owner", "owner", "applicant", second, current, now)
	if err != nil || invite.ID == "" || invite.Context == "" {
		t.Fatal("current application could not invite", err)
	}
	if w.Entities["applicant"].PartyID != "" {
		t.Fatal("invite auto-joined target")
	}
	if err := w.CancelGroupRequest("owner", "applicant", second, current); err != nil {
		t.Fatal(err)
	}
	if _, err := w.RespondPartyInvitation("applicant", "owner", invite.ID, true, now); err == nil {
		t.Fatal("withdrawn application still joined")
	}
}

func TestGroupFinderInvitationsRecheckPlansAndPartyObjects(t *testing.T) {
	for _, change := range []string{"plan", "party", "role", "expiry"} {
		t.Run(change, func(t *testing.T) {
			w, now := groupFinderFixture()
			w.CreateParty("owner")
			if err := w.PostGroupListing("owner", "recruit", "world", "healer", "", 1, now); err != nil {
				t.Fatal(err)
			}
			listingID := w.GroupFinderListings("owner", now)[0].ID
			if err := w.RequestGroupListing("applicant", "owner", listingID, "healer", now); err != nil {
				t.Fatal(err)
			}
			application := w.GroupFinderListings("owner", now)[0].Applicants[0].ID
			invite, err := w.IssueGroupListingInvitation("owner", "owner", "applicant", listingID, application, now)
			if err != nil {
				t.Fatal(err)
			}
			switch change {
			case "plan":
				_ = w.PostGroupListing("owner", "recruit", "world", "healer", "Changed plan", 1, now)
			case "party":
				_, _ = w.LeaveParty("owner")
				w.CreateParty("owner")
			case "role":
				_ = w.RequestGroupListing("applicant", "owner", listingID, "damage", now)
			case "expiry":
				now = now.Add(time.Minute)
			}
			if _, err := w.RespondPartyInvitation("applicant", "owner", invite.ID, true, now); err == nil {
				t.Fatal("invalidated group invite accepted")
			}
			if w.Entities["applicant"].PartyID != "" {
				t.Fatal("old invitation joined wrong plan/party")
			}
		})
	}
}

func TestPartyInvitationOldTokenCannotConsumeReplacement(t *testing.T) {
	w, _, now := invitationFixture()
	first, err := w.IssuePartyInvitation("leader", "target", now)
	if err != nil {
		t.Fatal(err)
	}
	second, err := w.IssuePartyInvitation("leader", "target", now)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"", first.ID} {
		if _, err := w.RespondPartyInvitation("target", "leader", id, true, now); err == nil {
			t.Fatal("old or missing invite token accepted")
		}
	}
	if _, err := w.RespondPartyInvitation("target", "leader", second.ID, true, now); err != nil {
		t.Fatal("old token consumed new invitation", err)
	}
}

func TestGroupFinderInviteDenialsDoNotCreatePartiesOrLeakApplications(t *testing.T) {
	for _, reason := range []string{"wrong-owner", "wrong-listing", "wrong-application", "busy", "underlevel", "expired-application"} {
		t.Run(reason, func(t *testing.T) {
			w, now := groupFinderFixture()
			if err := w.PostGroupListing("owner", "recruit", "molten_core", "healer", "", 70, now); err != nil {
				t.Fatal(err)
			}
			id := w.GroupFinderListings("owner", now)[0].ID
			if err := w.RequestGroupListing("applicant", "owner", id, "healer", now); err != nil {
				t.Fatal(err)
			}
			app := w.GroupFinderListings("owner", now)[0].Applicants[0].ID
			inviter := "owner"
			switch reason {
			case "wrong-owner":
				inviter = "observer"
			case "wrong-listing":
				id = "superseded"
			case "wrong-application":
				app = "superseded"
			case "busy":
				w.Entities["applicant"].SocialStatus = "busy"
			case "underlevel":
				w.Entities["applicant"].Level = 1
			case "expired-application":
				now = now.Add(5 * time.Minute)
			}
			if _, err := w.IssueGroupListingInvitation(inviter, "owner", "applicant", id, app, now); err == nil {
				t.Fatal("invalid recruitment invite accepted")
			}
			if len(w.Parties) != 0 || w.Entities["applicant"].PartyID != "" {
				t.Fatal("denied invitation mutated membership")
			}
			for _, listing := range w.GroupFinderListings("observer", now) {
				if len(listing.Applicants) != 0 || listing.RequestID != "" {
					t.Fatal("private application leaked")
				}
			}
		})
	}
}

func TestGroupFinderLeavingAdvertisedPartyRetiresItsListing(t *testing.T) {
	w, now := groupFinderFixture()
	w.CreateParty("owner")
	if err := w.PostGroupListing("owner", "recruit", "world", "healer", "", 1, now); err != nil {
		t.Fatal(err)
	}
	id := w.GroupFinderListings("owner", now)[0].ID
	if err := w.RequestGroupListing("applicant", "owner", id, "healer", now); err != nil {
		t.Fatal(err)
	}
	app := w.GroupFinderListings("owner", now)[0].Applicants[0].ID
	if _, err := w.KickPartyMember("owner", "owner"); err == nil {
		t.Fatal("self-kick orphaned leadership")
	}
	if _, err := w.LeaveParty("owner"); err != nil {
		t.Fatal(err)
	}
	if _, err := w.IssueGroupListingInvitation("owner", "owner", "applicant", id, app, now); err == nil {
		t.Fatal("departed party plan silently recreated a party")
	}
	if len(w.Parties) != 0 || len(w.GroupFinderListings("owner", now)) != 0 {
		t.Fatal("old party plan survived departure")
	}
}

func TestPartyRosterChangesRequireFreshReadiness(t *testing.T) {
	for _, change := range []string{"join", "leave", "kick", "promote", "expired", "rejoin"} {
		t.Run(change, func(t *testing.T) {
			w, party, _ := invitationFixture()
			if err := w.JoinParty(party.ID, "target"); err != nil {
				t.Fatal(err)
			}
			_, _ = w.StartPartyReadyCheck("leader")
			_, _ = w.SetPartyReady("leader", true)
			_, _ = w.SetPartyReady("target", true)
			switch change {
			case "join":
				_ = w.JoinParty(party.ID, "other")
			case "leave":
				_, _ = w.LeaveParty("target")
			case "kick":
				_, _ = w.KickPartyMember("leader", "target")
			case "promote":
				_, _ = w.PromotePartyMember("leader", "target")
			case "expired":
				w.RemoveExpiredMemberFromParty("target", party.ID)
			case "rejoin":
				_ = w.RejoinParty("other", party.ID)
			}
			for _, ready := range party.Ready {
				if ready {
					t.Fatal("old roster retained ready consent")
				}
			}
			if party.ReadyCheckActive {
				t.Fatal("old check remained active")
			}
			if _, err := w.SetPartyReady("leader", true); err == nil {
				t.Fatal("answer accepted without fresh check")
			}
		})
	}
}
