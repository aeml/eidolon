package main

import "go.mongodb.org/mongo-driver/bson/primitive"

type sessionAccountIdentityMatcher interface {
	MatchAccountIdentity(string, primitive.ObjectID) (bool, error)
}

var sessionAccountIdentities sessionAccountIdentityMatcher

func sessionAccountIdentityCurrent(c *Client, username string, id primitive.ObjectID) bool {
	if !requireBoundCharacterSaves {
		return true
	}
	if !clientAcceptsAccountID(c, id) || (c.username != "" && c.username != username) || !liveAccountIdentityMatches(username, id) {
		return false
	}
	store := sessionAccountIdentities
	if store == nil {
		store = db
	}
	if store == nil {
		return false
	}
	matched, err := store.MatchAccountIdentity(username, id)
	return err == nil && matched && clientAcceptsAccountID(c, id) &&
		(c.username == "" || c.username == username) && !c.transportClosed.Load() && !c.retired.Load() && liveAccountIdentityMatches(username, id)
}

func clientAccountID(c *Client) primitive.ObjectID {
	if c == nil {
		return primitive.NilObjectID
	}
	if id := c.accountIdentity.Load(); id != nil {
		return *id
	}
	return primitive.NilObjectID
}

func clientAcceptsAccountID(c *Client, id primitive.ObjectID) bool {
	return c != nil && (!requireBoundCharacterSaves || !id.IsZero()) &&
		(clientAccountID(c).IsZero() || clientAccountID(c) == id)
}

func pinClientAccountID(c *Client, id primitive.ObjectID) bool {
	if !clientAcceptsAccountID(c, id) {
		return false
	}
	if id.IsZero() {
		return !requireBoundCharacterSaves
	}
	if c.accountIdentity.CompareAndSwap(nil, &id) {
		return true
	}
	return clientAccountID(c) == id
}

func liveAccountIdentityMatches(username string, id primitive.ObjectID) bool {
	if !requireBoundCharacterSaves {
		return true
	}
	if username == "" || id.IsZero() {
		return false
	}
	if world != nil {
		if live := world.GetEntityCopy("player-" + username); live != nil {
			return live.PersistenceAccountID == id
		}
	}
	return true
}

// Snapshot a token's immutable generation without consuming it. Ordinary token
// validation still checks closure, expiry, ownership and rotation under its lock.
func resumeTokenIdentity(token, username string) (primitive.ObjectID, bool) {
	resumeTokensMu.Lock()
	defer resumeTokensMu.Unlock()
	entry := resumeTokens[token]
	if entry == nil || entry.username != username || (requireBoundCharacterSaves && entry.accountID.IsZero()) {
		return primitive.NilObjectID, false
	}
	return entry.accountID, true
}
