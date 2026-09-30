package game

import (
	"fmt"
	"time"
)

// Listing, application, party creation and invite issuance share World.Mu.
// A posted plan never joins anyone; acceptance remains the ordinary consent path.
func (w *World) IssueGroupListingInvitation(inviterID, ownerID, targetID, listingID, applicationID string, now time.Time) (PartyInvitation, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.pruneGroupListingsLocked(now)
	listing := w.groupListings[ownerID]
	if listing == nil || listing.ID != listingID {
		return PartyInvitation{}, fmt.Errorf("listing changed or expired; refresh Groups")
	}
	if listing.Mode == "recruit" {
		request := listing.requests[targetID]
		if inviterID != ownerID || applicationID == "" || request.ID != applicationID {
			return PartyInvitation{}, fmt.Errorf("application changed or expired; refresh Groups")
		}
	} else if targetID != ownerID || inviterID == ownerID {
		return PartyInvitation{}, fmt.Errorf("invite the player from the current looking-for-group listing")
	}
	inviter, target := w.groupActorLocked(inviterID), w.groupActorLocked(targetID)
	if !inviter.available || !target.available || target.partyID != "" || inviter.level < listing.MinLevel || target.level < listing.MinLevel || w.HasPvPMatch(inviterID) || w.HasPvPMatch(targetID) {
		return PartyInvitation{}, fmt.Errorf("both players must be available and meet the listing's level")
	}
	created := false
	if inviter.partyID == "" {
		if w.createPartyLocked(inviterID) == nil {
			return PartyInvitation{}, fmt.Errorf("party could not be created")
		}
		created = true
	}
	invite, err := w.issuePartyInvitationLocked(inviterID, targetID, now)
	if err != nil {
		if created {
			player := w.Entities[inviterID]
			delete(w.Parties, player.PartyID)
			setPartyMembershipLocked(player, "")
		}
		return invite, err
	}
	invite.listingOwnerID, invite.listingID, invite.applicationID = ownerID, listingID, applicationID
	if listing.Mode == "recruit" {
		listing.party = invite.party
	}
	point := worldLocations[listing.Plan.MeetingPointID]
	activity := listing.Activity
	for _, choice := range GroupActivities() {
		if choice.ID == listing.Activity {
			activity = choice.Name
		}
	}
	invite.Context = fmt.Sprintf("%s · meet at %s in Lanternhold. Normal entry rules apply; accepting joins the party, not an instance.", activity, point.Name)
	if listing.Plan.StartsAt != nil {
		invite.Context += " Planned start: " + listing.Plan.StartsAt.Format(time.RFC3339) + "."
	}
	w.partyInvitations[targetID] = invite
	return invite, nil
}
