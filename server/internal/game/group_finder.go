package game

import (
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

type GroupActivity struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	MinLevel int    `json:"minLevel"`
}

func GroupActivities() []GroupActivity {
	activities := []GroupActivity{{"world", "Questing and exploration", 1}, {"arena", "Arena 2v2", 1}}
	levels := DungeonEntryLevels()
	for _, id := range []string{"verdant_bastion_catacombs", "abyssal_well", "molten_core", "tempest_spire", "umbral_nexus"} {
		activities = append(activities, GroupActivity{id, formatDungeonLabel(id), levels[id]})
	}
	for _, id := range []string{"earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid"} {
		definition, _ := ElementalRaidDefinitionForType(id)
		activities = append(activities, GroupActivity{id, definition.Name, definition.RequiredLevel})
	}
	return activities
}

type GroupApplicant struct {
	PlayerID  string    `json:"playerId"`
	Name      string    `json:"name"`
	Class     string    `json:"class"`
	Level     int       `json:"level"`
	Role      string    `json:"role"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type GroupListing struct {
	OwnerID    string           `json:"ownerId"`
	Name       string           `json:"name"`
	Mode       string           `json:"mode"`
	Activity   string           `json:"activity"`
	Role       string           `json:"role"`
	Note       string           `json:"note"`
	MinLevel   int              `json:"minLevel"`
	Level      int              `json:"level"`
	Class      string           `json:"class"`
	Members    int              `json:"members"`
	Capacity   int              `json:"capacity"`
	ExpiresAt  time.Time        `json:"expiresAt"`
	Requested  bool             `json:"requested"`
	Applicants []GroupApplicant `json:"applicants,omitempty"`
	requests   map[string]GroupApplicant
}

type groupActor struct {
	name, class, partyID string
	level                int
	available            bool
}

func (w *World) groupActorLocked(id string) groupActor {
	player := w.Entities[id]
	if player == nil {
		return groupActor{}
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	return groupActor{player.Name, player.SubType, player.PartyID, player.Level,
		player.Type == TypePlayer && !player.Disconnected && player.SocialStatus != "busy"}
}

func validGroupRole(role string) bool {
	return role == "tank" || role == "healer" || role == "damage" || role == "flexible"
}

func (w *World) refreshGroupListingLocked(listing *GroupListing, now time.Time) bool {
	actor := w.groupActorLocked(listing.OwnerID)
	if !actor.available || w.HasPvPMatch(listing.OwnerID) || !now.Before(listing.ExpiresAt) {
		return false
	}
	listing.Name, listing.Class, listing.Level = actor.name, actor.class, actor.level
	listing.Members, listing.Capacity = 1, 5
	if actor.partyID != "" {
		if listing.Mode == "looking" {
			return false
		}
		party := w.Parties[actor.partyID]
		if party == nil {
			return false
		}
		party.Mu.RLock()
		leader := party.LeaderID
		listing.Members, listing.Capacity = len(party.Members), party.MaxSize
		party.Mu.RUnlock()
		if leader != listing.OwnerID || listing.Members >= listing.Capacity {
			return false
		}
	}
	for id, request := range listing.requests {
		applicant := w.groupActorLocked(id)
		if !applicant.available || applicant.partyID != "" || !now.Before(request.ExpiresAt) {
			delete(listing.requests, id)
		}
	}
	return true
}

func (w *World) pruneGroupListingsLocked(now time.Time) {
	for id, listing := range w.groupListings {
		if !w.refreshGroupListingLocked(listing, now) {
			delete(w.groupListings, id)
		}
	}
}

func (w *World) PostGroupListing(id, mode, activity, role, note string, minimum int, now time.Time) error {
	if (mode != "looking" && mode != "recruit") || !validGroupRole(role) {
		return fmt.Errorf("choose a listing type and a valid role")
	}
	note = strings.TrimSpace(note)
	if utf8.RuneCountInString(note) > 160 || strings.IndexFunc(note, unicode.IsControl) >= 0 {
		return fmt.Errorf("listing notes must be at most160 characters without control characters")
	}
	floor := 0
	for _, choice := range GroupActivities() {
		if choice.ID == activity {
			floor = choice.MinLevel
		}
	}
	if floor == 0 || minimum < floor || minimum > MaxPlayerLevel {
		return fmt.Errorf("choose a supported activity and minimum level matching its entry floor")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.pruneGroupListingsLocked(now)
	actor := w.groupActorLocked(id)
	if !actor.available || actor.level < minimum {
		return fmt.Errorf("you must be available and meet your listing's level")
	}
	listing := &GroupListing{OwnerID: id, Mode: mode, Activity: activity, Role: role, Note: note,
		MinLevel: minimum, ExpiresAt: now.Add(20 * time.Minute), requests: make(map[string]GroupApplicant)}
	if !w.refreshGroupListingLocked(listing, now) {
		return fmt.Errorf("recruit as a party leader, or look for a group while ungrouped")
	}
	if w.groupListings == nil {
		w.groupListings = make(map[string]*GroupListing)
	}
	if previous := w.groupListings[id]; previous != nil && previous.Mode == mode && previous.Activity == activity && previous.MinLevel == minimum {
		listing.requests = previous.requests
	}
	if w.groupListings[id] == nil && len(w.groupListings) >= 250 {
		return fmt.Errorf("recruitment board is full; try again shortly")
	}
	w.groupListings[id] = listing
	return nil
}

func (w *World) RemoveGroupListing(id string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	delete(w.groupListings, id)
}

func (w *World) CancelGroupRequest(ownerID, applicantID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if listing := w.groupListings[ownerID]; listing != nil {
		delete(listing.requests, applicantID)
	}
}

func (w *World) RequestGroupListing(applicantID, ownerID, role string, now time.Time) error {
	if applicantID == ownerID || !validGroupRole(role) {
		return fmt.Errorf("choose another group and your role")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.pruneGroupListingsLocked(now)
	listing := w.groupListings[ownerID]
	actor := w.groupActorLocked(applicantID)
	if listing == nil || listing.Mode != "recruit" {
		return fmt.Errorf("recruitment listing is no longer available")
	}
	if !actor.available || w.HasPvPMatch(applicantID) || actor.partyID != "" || actor.level < listing.MinLevel {
		return fmt.Errorf("be available, ungrouped and meet the listing's minimum level")
	}
	if len(listing.requests) >= 20 && listing.requests[applicantID].PlayerID == "" {
		return fmt.Errorf("this group has enough pending requests")
	}
	listing.requests[applicantID] = GroupApplicant{applicantID, actor.name, actor.class, actor.level, role, now.Add(5 * time.Minute)}
	return nil
}

func (w *World) GroupFinderListings(viewerID string, now time.Time) []GroupListing {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.pruneGroupListingsLocked(now)
	listings := make([]GroupListing, 0, len(w.groupListings))
	for _, listing := range w.groupListings {
		copy := *listing
		copy.requests = nil
		copy.Requested = listing.requests[viewerID].PlayerID != ""
		if viewerID == listing.OwnerID {
			for _, request := range listing.requests {
				copy.Applicants = append(copy.Applicants, request)
			}
			sort.Slice(copy.Applicants, func(i, j int) bool { return copy.Applicants[i].Name < copy.Applicants[j].Name })
		}
		listings = append(listings, copy)
	}
	sort.Slice(listings, func(i, j int) bool { return listings[i].OwnerID < listings[j].OwnerID })
	return listings
}
