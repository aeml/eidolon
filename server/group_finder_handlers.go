package main

import (
	"encoding/json"
	"time"

	"eidolon-server/internal/game"
)

func handleMsgGroupFinder(c *Client, message Message) {
	var payload struct {
		Action      string `json:"action"`
		Mode        string `json:"mode"`
		Activity    string `json:"activity"`
		Role        string `json:"role"`
		Note        string `json:"note"`
		MinLevel    int    `json:"minLevel"`
		OwnerID     string `json:"ownerId"`
		ApplicantID string `json:"applicantId"`
	}
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		c.sendError("invalid group finder request")
		return
	}
	var err error
	switch payload.Action {
	case "", "list":
	case "post":
		err = world.PostGroupListing(c.playerID, payload.Mode, payload.Activity, payload.Role, payload.Note, payload.MinLevel, time.Now())
	case "remove":
		world.RemoveGroupListing(c.playerID)
	case "decline":
		world.CancelGroupRequest(c.playerID, payload.ApplicantID)
	case "cancel":
		world.CancelGroupRequest(payload.OwnerID, c.playerID)
	case "request":
		owner := getClientByPlayerID(payload.OwnerID)
		if owner == nil || chatService.shouldFilter(owner.username, c.username) || chatService.shouldFilter(c.username, owner.username) {
			c.sendError("that recruitment listing is unavailable")
			return
		}
		err = world.RequestGroupListing(c.playerID, payload.OwnerID, payload.Role, time.Now())
		if err == nil {
			c.sendSystemChat("Request sent. The group leader can invite you from the Groups tab; you still choose whether to accept.")
			sendGroupFinder(owner)
		}
	default:
		c.sendError("unknown group finder action")
		return
	}
	if err != nil {
		c.sendError(err.Error())
		return
	}
	sendGroupFinder(c)
}

func sendGroupFinder(c *Client) {
	listings := world.GroupFinderListings(c.playerID, time.Now())
	visible := make([]game.GroupListing, 0, len(listings))
	for _, listing := range listings {
		if chatService.shouldFilter(c.username, listing.Name) || chatService.shouldFilter(listing.Name, c.username) {
			continue
		}
		requests := listing.Applicants[:0]
		for _, request := range listing.Applicants {
			if !chatService.shouldFilter(c.username, request.Name) && !chatService.shouldFilter(request.Name, c.username) {
				requests = append(requests, request)
			}
		}
		listing.Applicants = requests
		visible = append(visible, listing)
	}
	bytes, _ := json.Marshal(map[string]interface{}{"viewerId": c.playerID, "listings": visible, "activities": game.GroupActivities()})
	c.sendSafe(createMessage("group_finder_update", bytes))
}
