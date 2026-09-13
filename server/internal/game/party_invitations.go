package game

import (
	"fmt"
	"time"
)

type PartyInvitation struct {
	InviterID string
	TargetID  string
	PartyID   string
	ExpiresAt time.Time
	party     *Party // Party IDs may be reused after disband; this invitation may not.
}

// One outstanding modal per target, matching the current UI. Invitations are
// session-local and expire after sixty seconds; restart never revives consent.
func (w *World) IssuePartyInvitation(inviterID, targetID string, now time.Time) (PartyInvitation, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	inviter, target := w.Entities[inviterID], w.Entities[targetID]
	if inviter == nil || target == nil || inviterID == targetID {
		return PartyInvitation{}, fmt.Errorf("party invitation requires two available players")
	}
	inviter.Mu.RLock()
	partyID, inviterAvailable := inviter.PartyID, inviter.Type == TypePlayer && !inviter.Disconnected
	inviter.Mu.RUnlock()
	target.Mu.RLock()
	targetAvailable := target.Type == TypePlayer && !target.Disconnected && target.PartyID == "" && target.SocialStatus != "busy"
	target.Mu.RUnlock()
	party := w.Parties[partyID]
	if !inviterAvailable || !targetAvailable || party == nil {
		return PartyInvitation{}, fmt.Errorf("player is unavailable or already grouped")
	}
	if w.HasPvPMatch(inviterID) || w.HasPvPMatch(targetID) {
		return PartyInvitation{}, fmt.Errorf("finish the current arena match before changing parties")
	}
	party.Mu.RLock()
	canInvite := party.LeaderID == inviterID && len(party.Members) < party.MaxSize
	party.Mu.RUnlock()
	if !canInvite {
		return PartyInvitation{}, fmt.Errorf("only the current leader of a non-full party may invite")
	}
	if w.partyInvitations == nil {
		w.partyInvitations = make(map[string]PartyInvitation)
	}
	for id, pending := range w.partyInvitations {
		if !now.Before(pending.ExpiresAt) || w.Entities[id] == nil {
			delete(w.partyInvitations, id)
		}
	}
	invite := PartyInvitation{InviterID: inviterID, TargetID: targetID, PartyID: partyID, ExpiresAt: now.Add(time.Minute), party: party}
	w.partyInvitations[targetID] = invite
	return invite, nil
}

// Validation and joining share World.Mu, so capacity, leadership or membership
// cannot change between checking the invitation and using it.
func (w *World) RespondPartyInvitation(targetID, inviterID string, accepted bool, now time.Time) (*Party, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	invite, exists := w.partyInvitations[targetID]
	if !exists || invite.InviterID != inviterID {
		return nil, fmt.Errorf("party invitation not found")
	}
	delete(w.partyInvitations, targetID)
	if !now.Before(invite.ExpiresAt) {
		return nil, fmt.Errorf("party invitation expired; ask for another invite")
	}
	if !accepted {
		return nil, nil
	}
	inviter, target := w.Entities[inviterID], w.Entities[targetID]
	party := w.Parties[invite.PartyID]
	if inviter == nil || target == nil || party == nil || party != invite.party {
		return nil, fmt.Errorf("the invited party no longer exists")
	}
	inviter.Mu.RLock()
	available := !inviter.Disconnected && inviter.PartyID == invite.PartyID
	inviter.Mu.RUnlock()
	target.Mu.RLock()
	available = available && !target.Disconnected && target.SocialStatus != "busy"
	target.Mu.RUnlock()
	party.Mu.RLock()
	available = available && party.LeaderID == inviterID
	party.Mu.RUnlock()
	if !available {
		return nil, fmt.Errorf("party invitation is no longer available")
	}
	if w.HasPvPMatch(inviterID) || w.HasPvPMatch(targetID) {
		return nil, fmt.Errorf("finish the current arena match before changing parties")
	}
	if err := w.joinPartyLocked(invite.PartyID, targetID); err != nil {
		return nil, err
	}
	return party, nil
}
