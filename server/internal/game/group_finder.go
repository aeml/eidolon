package game

import (
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
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
	activities = append(activities, GroupActivity{"weekly_raid", "Dark King · Citadel of the Eclipse", MaxPlayerLevel})
	return activities
}

type GroupApplicant struct {
	ID        string    `json:"id"`
	PlayerID  string    `json:"playerId"`
	Name      string    `json:"name"`
	Class     string    `json:"class"`
	Level     int       `json:"level"`
	Role      string    `json:"role"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type GroupListing struct {
	ID         string           `json:"id"`
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
	RequestID  string           `json:"requestId,omitempty"`
	Applicants []GroupApplicant `json:"applicants,omitempty"`
	Plan       GroupPlan        `json:"plan"`
	Roles      map[string]int   `json:"roles"`
	Ready      int              `json:"ready"`
	Checking   bool             `json:"checking"`
	requests   map[string]GroupApplicant
	party      *Party
}

// Public board plans are short-lived, not calendar reservations or entry rights.
type GroupPlan struct {
	StartsAt       *time.Time `json:"startsAt,omitempty"`
	MeetingPointID string     `json:"meetingPointId"`
}

func GroupMeetingPoints() []WorldLocation {
	points := []WorldLocation{}
	for _, point := range worldLocations {
		if point.InstanceID == "" {
			points = append(points, point)
		}
	}
	sort.Slice(points, func(i, j int) bool { return points[i].ID < points[j].ID })
	return points
}

func validateGroupPlan(plan GroupPlan, now time.Time) (GroupPlan, error) {
	if plan.MeetingPointID == "" {
		plan.MeetingPointID = "dungeon-guide"
	}
	point, ok := worldLocations[plan.MeetingPointID]
	if !ok || point.InstanceID != "" {
		return plan, fmt.Errorf("choose a public Lanternhold meeting point")
	}
	if plan.StartsAt != nil {
		start := plan.StartsAt.UTC()
		if start.Before(now) || !start.Before(now.Add(20*time.Minute)) {
			return plan, fmt.Errorf("choose a start within the next 20 minutes; use the guild calendar for later events")
		}
		plan.StartsAt = &start
	}
	return plan, nil
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
	return groupActor{player.DisplayName(), player.SubType, player.PartyID, player.Level,
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
	listing.Roles = map[string]int{groupRoleForClass(actor.class): 1}
	listing.Ready, listing.Checking = 0, false
	if listing.party != nil && actor.partyID == "" {
		return false // Departing the advertised party retires its plan.
	}
	if actor.partyID != "" {
		if listing.Mode == "looking" {
			return false
		}
		party := w.Parties[actor.partyID]
		if party == nil || (listing.party != nil && listing.party != party) {
			return false
		}
		listing.party = party
		party.Mu.RLock()
		leader := party.LeaderID
		listing.Members, listing.Capacity = len(party.Members), party.MaxSize
		listing.Roles = map[string]int{}
		for _, id := range party.Members {
			member := w.groupActorLocked(id)
			listing.Roles[groupRoleForClass(member.class)]++
			if party.Ready[id] && member.available {
				listing.Ready++
			}
		}
		listing.Checking = party.ReadyCheckActive
		party.Mu.RUnlock()
		if leader != listing.OwnerID || listing.Members >= listing.Capacity {
			return false
		}
	}
	for id, request := range listing.requests {
		applicant := w.groupActorLocked(id)
		if !applicant.available || applicant.partyID != "" || applicant.level < listing.MinLevel || w.HasPvPMatch(id) || !now.Before(request.ExpiresAt) {
			delete(listing.requests, id)
		}
	}
	return true
}

func groupRoleForClass(class string) string {
	role := PartyRoleForClass(class)
	if role == "support" {
		return "healer"
	}
	return role
}

func (w *World) pruneGroupListingsLocked(now time.Time) {
	for id, listing := range w.groupListings {
		if !w.refreshGroupListingLocked(listing, now) {
			delete(w.groupListings, id)
		}
	}
}

func (w *World) PostGroupListing(id, mode, activity, role, note string, minimum int, now time.Time, plans ...GroupPlan) error {
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
	plan := GroupPlan{}
	if len(plans) > 0 {
		plan = plans[0]
	}
	plan, err := validateGroupPlan(plan, now)
	if err != nil {
		return err
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.pruneGroupListingsLocked(now)
	actor := w.groupActorLocked(id)
	if !actor.available || actor.level < minimum {
		return fmt.Errorf("you must be available and meet your listing's level")
	}
	listing := &GroupListing{ID: uuid.NewString(), OwnerID: id, Mode: mode, Activity: activity, Role: role, Note: note, Plan: plan,
		MinLevel: minimum, ExpiresAt: now.Add(20 * time.Minute), requests: make(map[string]GroupApplicant)}
	if !w.refreshGroupListingLocked(listing, now) {
		return fmt.Errorf("recruit as a party leader, or look for a group while ungrouped")
	}
	if w.groupListings == nil {
		w.groupListings = make(map[string]*GroupListing)
	}
	if w.groupListings[id] == nil && len(w.groupListings) >= 250 {
		return fmt.Errorf("recruitment board is full; try again shortly")
	}
	w.groupListings[id] = listing
	return nil
}

func (w *World) RemoveGroupListing(id, listingID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if listing := w.groupListings[id]; listing == nil || listing.ID != listingID {
		return fmt.Errorf("listing changed or expired; refresh Groups")
	}
	delete(w.groupListings, id)
	return nil
}

func (w *World) CancelGroupRequest(ownerID, applicantID, listingID, applicationID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	listing := w.groupListings[ownerID]
	if listing == nil || listing.ID != listingID || listing.requests[applicantID].ID != applicationID || applicationID == "" {
		return fmt.Errorf("application changed or expired; refresh Groups")
	}
	delete(listing.requests, applicantID)
	return nil
}

func (w *World) RequestGroupListing(applicantID, ownerID, listingID, role string, now time.Time) error {
	if applicantID == ownerID || !validGroupRole(role) {
		return fmt.Errorf("choose another group and your role")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.pruneGroupListingsLocked(now)
	listing := w.groupListings[ownerID]
	actor := w.groupActorLocked(applicantID)
	if listing == nil || listing.ID != listingID || listing.Mode != "recruit" {
		return fmt.Errorf("recruitment listing is no longer available")
	}
	if !actor.available || w.HasPvPMatch(applicantID) || actor.partyID != "" || actor.level < listing.MinLevel {
		return fmt.Errorf("be available, ungrouped and meet the listing's minimum level")
	}
	if len(listing.requests) >= 20 && listing.requests[applicantID].PlayerID == "" {
		return fmt.Errorf("this group has enough pending requests")
	}
	listing.requests[applicantID] = GroupApplicant{uuid.NewString(), applicantID, actor.name, actor.class, actor.level, role, now.Add(5 * time.Minute)}
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
		copy.party = nil
		copy.Roles = make(map[string]int, len(listing.Roles))
		for role, count := range listing.Roles {
			copy.Roles[role] = count
		}
		if copy.Plan.StartsAt != nil {
			start := *copy.Plan.StartsAt
			copy.Plan.StartsAt = &start
		}
		copy.Requested = listing.requests[viewerID].PlayerID != ""
		if copy.Requested {
			copy.RequestID = listing.requests[viewerID].ID
		}
		if viewerID == listing.OwnerID {
			for _, request := range listing.requests {
				request.Name = w.groupActorLocked(request.PlayerID).name
				copy.Applicants = append(copy.Applicants, request)
			}
			sort.Slice(copy.Applicants, func(i, j int) bool { return copy.Applicants[i].Name < copy.Applicants[j].Name })
		}
		listings = append(listings, copy)
	}
	sort.Slice(listings, func(i, j int) bool { return listings[i].OwnerID < listings[j].OwnerID })
	return listings
}
