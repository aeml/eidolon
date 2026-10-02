package main

import (
	"encoding/json"
	"time"

	"eidolon-server/internal/game"
)

func handleMsgGroupFinder(c *Client, message Message) {
	var payload struct {
		Action        string         `json:"action"`
		Mode          string         `json:"mode"`
		Activity      string         `json:"activity"`
		Role          string         `json:"role"`
		Note          string         `json:"note"`
		MinLevel      int            `json:"minLevel"`
		OwnerID       string         `json:"ownerId"`
		ApplicantID   string         `json:"applicantId"`
		ListingID     string         `json:"listingId"`
		ApplicationID string         `json:"applicationId"`
		Plan          game.GroupPlan `json:"plan"`
	}
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		c.sendError("invalid group finder request")
		return
	}
	var err error
	switch payload.Action {
	case "", "list":
	case "post":
		err = world.PostGroupListing(c.playerID, payload.Mode, payload.Activity, payload.Role, payload.Note, payload.MinLevel, time.Now(), payload.Plan)
	case "remove":
		err = world.RemoveGroupListing(c.playerID, payload.ListingID)
	case "decline":
		err = world.CancelGroupRequest(c.playerID, payload.ApplicantID, payload.ListingID, payload.ApplicationID)
	case "cancel":
		err = world.CancelGroupRequest(payload.OwnerID, c.playerID, payload.ListingID, payload.ApplicationID)
	case "request":
		owner := getClientByPlayerID(payload.OwnerID)
		if owner == nil || chatService.shouldFilter(owner.username, c.username) || chatService.shouldFilter(c.username, owner.username) {
			c.sendError("that recruitment listing is unavailable")
			return
		}
		err = world.RequestGroupListing(c.playerID, payload.OwnerID, payload.ListingID, payload.Role, time.Now())
		if err == nil {
			c.sendSystemChat("Request sent. The group leader can invite you from the Groups tab; you still choose whether to accept.")
			sendGroupFinder(owner)
		}
	case "invite":
		target := getClientByPlayerID(payload.ApplicantID)
		if target == nil || chatService.shouldFilter(target.username, c.username) || chatService.shouldFilter(c.username, target.username) {
			c.sendError("player is unavailable for recruitment invitations")
			sendGroupFinder(c)
			return
		}
		var invite game.PartyInvitation
		invite, err = world.IssueGroupListingInvitation(c.playerID, payload.OwnerID, target.playerID, payload.ListingID, payload.ApplicationID, time.Now())
		if err == nil {
			deliverPartyInvitation(c, target, invite, invite.Context)
			if actor := world.GetEntityCopy(c.playerID); actor != nil {
				broadcastPartyUpdate(world.GetParty(actor.PartyID))
			}
		}
	default:
		c.sendError("unknown group finder action")
		return
	}
	if err != nil {
		c.sendError(err.Error())
		sendGroupFinder(c)
		return
	}
	sendGroupFinder(c)
}

func sendGroupFinder(c *Client) {
	listings := world.GroupFinderListings(c.playerID, time.Now())
	visible := make([]game.GroupListing, 0, len(listings))
	for _, listing := range listings {
		owner := playerIDToUsername(listing.OwnerID)
		if chatService.shouldFilter(c.username, owner) || chatService.shouldFilter(owner, c.username) {
			continue
		}
		requests := listing.Applicants[:0]
		for _, request := range listing.Applicants {
			account := playerIDToUsername(request.PlayerID)
			if !chatService.shouldFilter(c.username, account) && !chatService.shouldFilter(account, c.username) {
				requests = append(requests, request)
			}
		}
		listing.Applicants = requests
		visible = append(visible, listing)
	}
	bytes, _ := json.Marshal(map[string]interface{}{"viewerId": c.playerID, "listings": visible, "activities": game.GroupActivities(), "meetingPoints": game.GroupMeetingPoints()})
	c.sendSafe(createMessage("group_finder_update", bytes))
}
