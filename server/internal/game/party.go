package game

import (
	"fmt"
	"log"
	"strings"
	"sync"
)

type Party struct {
	ID               string          `json:"id"`
	LeaderID         string          `json:"leaderId"`
	Members          []string        `json:"members"`
	MaxSize          int             `json:"maxSize"`
	Ready            map[string]bool `json:"ready"`
	ReadyCheckActive bool            `json:"readyCheckActive"`
	LootRule         string          `json:"lootRule"`
	MasterLooterID   string          `json:"masterLooterId,omitempty"`
	Mu               sync.RWMutex
}

func (w *World) CreateParty(leaderID string) *Party {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	leader, exists := w.Entities[leaderID]
	if !exists {
		log.Printf("CreateParty Failed: Leader %s not found", leaderID)
		return nil
	}
	if leader.PartyID != "" {
		log.Printf("CreateParty Failed: Leader %s already in party %s", leaderID, leader.PartyID)
		return nil
	}

	partyID := fmt.Sprintf("party-%s", leaderID)
	party := &Party{
		ID:       partyID,
		LeaderID: leaderID,
		Members:  []string{leaderID},
		MaxSize:  5,
		Ready:    map[string]bool{leaderID: false},
		LootRule: "ffa",
	}

	w.Parties[partyID] = party
	leader.PartyID = partyID
	return party
}

func (w *World) JoinParty(partyID, playerID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	party, exists := w.Parties[partyID]
	if !exists {
		return fmt.Errorf("party not found")
	}

	player, exists := w.Entities[playerID]
	if !exists {
		return fmt.Errorf("player not found")
	}

	if player.PartyID != "" {
		return fmt.Errorf("player already in a party")
	}

	party.Mu.Lock()
	defer party.Mu.Unlock()

	if len(party.Members) >= party.MaxSize {
		return fmt.Errorf("party is full")
	}

	party.Members = append(party.Members, playerID)
	if party.Ready == nil {
		party.Ready = make(map[string]bool)
	}
	party.Ready[playerID] = false
	player.PartyID = partyID
	return nil
}

func (w *World) LeaveParty(playerID string) (*Party, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, exists := w.Entities[playerID]
	if !exists {
		return nil, fmt.Errorf("player not found")
	}

	if player.PartyID == "" {
		return nil, fmt.Errorf("player not in a party")
	}

	partyID := player.PartyID
	party, exists := w.Parties[partyID]
	if !exists {
		player.PartyID = ""
		return nil, nil
	}

	party.Mu.Lock()
	defer party.Mu.Unlock()

	newMembers := []string{}
	for _, mid := range party.Members {
		if mid != playerID {
			newMembers = append(newMembers, mid)
		}
	}
	party.Members = newMembers
	delete(party.Ready, playerID)
	player.PartyID = ""

	if len(party.Members) == 0 {
		delete(w.Parties, partyID)
		return nil, nil // Disbanded
	}

	if party.LeaderID == playerID {
		party.LeaderID = party.Members[0]
	}
	if party.MasterLooterID == playerID {
		party.MasterLooterID = party.LeaderID
	}

	return party, nil
}

func (w *World) KickPartyMember(leaderID, targetID string) (*Party, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	leader, exists := w.Entities[leaderID]
	if !exists || leader.PartyID == "" {
		return nil, fmt.Errorf("leader not found or not in party")
	}

	party, exists := w.Parties[leader.PartyID]
	if !exists {
		return nil, fmt.Errorf("party not found")
	}

	if party.LeaderID != leaderID {
		return nil, fmt.Errorf("only leader can kick")
	}

	target, exists := w.Entities[targetID]
	if !exists {
		return nil, fmt.Errorf("target not found")
	}

	if target.PartyID != party.ID {
		return nil, fmt.Errorf("target not in this party")
	}

	party.Mu.Lock()
	defer party.Mu.Unlock()

	newMembers := []string{}
	for _, mid := range party.Members {
		if mid != targetID {
			newMembers = append(newMembers, mid)
		}
	}
	party.Members = newMembers
	delete(party.Ready, targetID)
	if party.MasterLooterID == targetID {
		party.MasterLooterID = party.LeaderID
	}
	target.PartyID = ""

	return party, nil
}

func (w *World) PromotePartyMember(leaderID, targetID string) (*Party, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	leader, exists := w.Entities[leaderID]
	if !exists || leader.PartyID == "" {
		return nil, fmt.Errorf("leader not found or not in party")
	}

	party, exists := w.Parties[leader.PartyID]
	if !exists {
		return nil, fmt.Errorf("party not found")
	}

	if party.LeaderID != leaderID {
		return nil, fmt.Errorf("only leader can promote")
	}

	target, exists := w.Entities[targetID]
	if !exists {
		return nil, fmt.Errorf("target not found")
	}

	if target.PartyID != party.ID {
		return nil, fmt.Errorf("target not in this party")
	}

	party.Mu.Lock()
	defer party.Mu.Unlock()

	party.LeaderID = targetID
	return party, nil
}

// RejoinParty adds playerID to an existing party identified by partyID.
// Unlike JoinParty it does not check whether the player is already in a
// party — the caller is responsible for ensuring the entity was freshly
// created with an empty PartyID.  Returns an error if the party no longer
// exists or is already full.
func (w *World) RejoinParty(playerID, partyID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	party, exists := w.Parties[partyID]
	if !exists {
		return fmt.Errorf("party not found")
	}

	player, exists := w.Entities[playerID]
	if !exists {
		return fmt.Errorf("player not found")
	}

	party.Mu.Lock()
	defer party.Mu.Unlock()

	// A full login can replace a still-lingering resume-window entity while
	// the in-memory party already contains the canonical player ID. Rejoining
	// that ID must restore the entity link without duplicating the member row.
	for _, memberID := range party.Members {
		if memberID == playerID {
			player.PartyID = partyID
			return nil
		}
	}

	if len(party.Members) >= party.MaxSize {
		return fmt.Errorf("party is full")
	}

	party.Members = append(party.Members, playerID)
	player.PartyID = partyID
	return nil
}

// RejoinOrRestoreParty restores the durable PartyID link after a process
// restart. Party IDs include the original leader's canonical player ID; later
// reconnecting members join the same reconstructed registry entry.
func (w *World) RejoinOrRestoreParty(playerID, partyID string) error {
	if partyID == "" {
		return fmt.Errorf("party id is required")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, exists := w.Entities[playerID]
	if !exists {
		return fmt.Errorf("player not found")
	}
	party, exists := w.Parties[partyID]
	if !exists {
		leaderID := playerID
		if inferred := strings.TrimPrefix(partyID, "party-"); inferred != "" && inferred != partyID {
			leaderID = inferred
		}
		party = &Party{ID: partyID, LeaderID: leaderID, Members: []string{}, MaxSize: 5}
		party.Ready = make(map[string]bool)
		party.LootRule = "ffa"
		w.Parties[partyID] = party
	}

	party.Mu.Lock()
	defer party.Mu.Unlock()
	for _, memberID := range party.Members {
		if memberID == playerID {
			player.PartyID = partyID
			return nil
		}
	}
	if len(party.Members) >= party.MaxSize {
		return fmt.Errorf("party is full")
	}
	party.Members = append(party.Members, playerID)
	party.Ready[playerID] = false
	player.PartyID = partyID
	return nil
}

// RemoveExpiredMemberFromParty removes playerID from partyID after the
// entity has already been deleted from w.Entities (e.g. resume-window
// expiry).  It is safe to call even when the party no longer exists.
func (w *World) RemoveExpiredMemberFromParty(playerID, partyID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	party, exists := w.Parties[partyID]
	if !exists {
		return
	}

	party.Mu.Lock()
	defer party.Mu.Unlock()

	newMembers := make([]string, 0, len(party.Members))
	for _, mid := range party.Members {
		if mid != playerID {
			newMembers = append(newMembers, mid)
		}
	}
	party.Members = newMembers
	delete(party.Ready, playerID)

	if len(party.Members) == 0 {
		delete(w.Parties, partyID)
		return
	}

	if party.LeaderID == playerID {
		party.LeaderID = party.Members[0]
	}
}

func (w *World) GetParty(partyID string) *Party {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	return w.Parties[partyID]
}

func (p *Party) GetSnapshot() (string, string, []string) {
	p.Mu.RLock()
	defer p.Mu.RUnlock()
	members := make([]string, len(p.Members))
	copy(members, p.Members)
	return p.ID, p.LeaderID, members
}

// CanReceivePartyInvite reports whether the player with the given ID is
// eligible to receive a party invite.  Returns (true, "") when the invite
// may proceed.  Returns (false, reason) when it should be blocked:
//   - "not_found" — player does not exist in the world
//   - "busy"      — player's social status is "busy" (0.37.4)
func (w *World) CanReceivePartyInvite(playerID string) (bool, string) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	player, ok := w.Entities[playerID]
	if !ok || player.Type != TypePlayer {
		return false, "not_found"
	}
	player.Mu.RLock()
	status := player.SocialStatus
	player.Mu.RUnlock()
	if NormalizeSocialStatus(status) == "busy" {
		return false, "busy"
	}
	return true, ""
}

// GetAllParties returns a snapshot of all active parties in the world.
func (w *World) GetAllParties() []*Party {
	w.Mu.RLock()
	defer w.Mu.RUnlock()

	parties := make([]*Party, 0, len(w.Parties))
	for _, p := range w.Parties {
		parties = append(parties, p)
	}
	return parties
}

func (w *World) StartPartyReadyCheck(leaderID string) (*Party, error) {
	w.Mu.RLock()
	leader := w.Entities[leaderID]
	if leader == nil || leader.PartyID == "" {
		w.Mu.RUnlock()
		return nil, fmt.Errorf("leader not found or not in party")
	}
	party := w.Parties[leader.PartyID]
	w.Mu.RUnlock()
	if party == nil {
		return nil, fmt.Errorf("party not found")
	}
	party.Mu.Lock()
	defer party.Mu.Unlock()
	if party.LeaderID != leaderID {
		return nil, fmt.Errorf("only leader can start a ready check")
	}
	party.Ready = make(map[string]bool, len(party.Members))
	for _, memberID := range party.Members {
		party.Ready[memberID] = false
	}
	party.ReadyCheckActive = true
	return party, nil
}

func (w *World) SetPartyReady(playerID string, ready bool) (*Party, error) {
	w.Mu.RLock()
	player := w.Entities[playerID]
	if player == nil || player.PartyID == "" {
		w.Mu.RUnlock()
		return nil, fmt.Errorf("player not in party")
	}
	party := w.Parties[player.PartyID]
	w.Mu.RUnlock()
	if party == nil {
		return nil, fmt.Errorf("party not found")
	}
	party.Mu.Lock()
	defer party.Mu.Unlock()
	if !party.ReadyCheckActive {
		return nil, fmt.Errorf("no ready check is active")
	}
	party.Ready[playerID] = ready
	allReady := len(party.Members) > 0
	for _, memberID := range party.Members {
		allReady = allReady && party.Ready[memberID]
	}
	if allReady {
		party.ReadyCheckActive = false
	}
	return party, nil
}

func (w *World) ConvertPartyToRaid(leaderID string) (*Party, error) {
	w.Mu.RLock()
	leader := w.Entities[leaderID]
	if leader == nil || leader.PartyID == "" {
		w.Mu.RUnlock()
		return nil, fmt.Errorf("leader is not in a party")
	}
	party := w.Parties[leader.PartyID]
	w.Mu.RUnlock()
	if party == nil {
		return nil, fmt.Errorf("party not found")
	}
	party.Mu.Lock()
	defer party.Mu.Unlock()
	if party.LeaderID != leaderID {
		return nil, fmt.Errorf("only the party leader can form a raid")
	}
	if leader.Level < MaxPlayerLevel {
		return nil, fmt.Errorf("raid groups unlock at level %d", MaxPlayerLevel)
	}
	party.MaxSize = 10
	return party, nil
}

func (w *World) ValidateWeeklyRaidParty(leaderID string) (*Party, []string, error) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	leader := w.Entities[leaderID]
	if leader == nil || leader.PartyID == "" {
		return nil, nil, fmt.Errorf("a raid group is required")
	}
	party := w.Parties[leader.PartyID]
	if party == nil {
		return nil, nil, fmt.Errorf("raid group not found")
	}
	party.Mu.RLock()
	defer party.Mu.RUnlock()
	if party.LeaderID != leaderID || party.MaxSize != 10 {
		return nil, nil, fmt.Errorf("the leader must form a raid group first")
	}
	if len(party.Members) < 5 || len(party.Members) > 10 {
		return nil, nil, fmt.Errorf("weekly raid requires 5-10 players")
	}
	members := append([]string(nil), party.Members...)
	for _, memberID := range members {
		member := w.Entities[memberID]
		if member == nil || member.Level < MaxPlayerLevel || member.Disconnected {
			return nil, nil, fmt.Errorf("every raid member must be online and level %d", MaxPlayerLevel)
		}
		if !party.Ready[memberID] {
			return nil, nil, fmt.Errorf("every raid member must confirm the ready check")
		}
	}
	return party, members, nil
}

func (w *World) SetPartyLootRule(leaderID, rule, masterLooterID string) (*Party, error) {
	w.Mu.RLock()
	leader := w.Entities[leaderID]
	if leader == nil || leader.PartyID == "" {
		w.Mu.RUnlock()
		return nil, fmt.Errorf("leader not found or not in party")
	}
	party := w.Parties[leader.PartyID]
	w.Mu.RUnlock()
	if party == nil {
		return nil, fmt.Errorf("party not found")
	}
	party.Mu.Lock()
	defer party.Mu.Unlock()
	if party.LeaderID != leaderID {
		return nil, fmt.Errorf("only leader can change loot rules")
	}
	rule = strings.ToLower(strings.TrimSpace(rule))
	if rule != "ffa" && rule != "master" {
		return nil, fmt.Errorf("invalid loot rule")
	}
	if rule == "master" {
		if masterLooterID == "" {
			masterLooterID = leaderID
		}
		found := false
		for _, memberID := range party.Members {
			found = found || memberID == masterLooterID
		}
		if !found {
			return nil, fmt.Errorf("master looter must be a party member")
		}
	} else {
		masterLooterID = ""
	}
	party.LootRule = rule
	party.MasterLooterID = masterLooterID
	return party, nil
}

func PartyRoleForClass(class string) string {
	switch class {
	case "Fighter":
		return "tank"
	case "Cleric":
		return "support"
	default:
		return "damage"
	}
}
