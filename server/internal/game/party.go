package game

import (
	"fmt"
	"log"
	"sync"
)

type Party struct {
	ID       string   `json:"id"`
	LeaderID string   `json:"leaderId"`
	Members  []string `json:"members"`
	MaxSize  int      `json:"maxSize"`
	Mu       sync.RWMutex
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
	player.PartyID = ""

	if len(party.Members) == 0 {
		delete(w.Parties, partyID)
		return nil, nil // Disbanded
	}

	if party.LeaderID == playerID {
		party.LeaderID = party.Members[0]
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

	if len(party.Members) >= party.MaxSize {
		return fmt.Errorf("party is full")
	}

	party.Members = append(party.Members, playerID)
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
