package main

import "errors"

func clientPublicName(c *Client) string {
	if name := c.publicName.Load(); name != nil {
		return *name
	}
	return c.username
}

func setClientPublicName(c *Client, name string) {
	if c == nil || name == "" {
		return
	}
	c.publicName.Store(&name)
	if world != nil {
		world.SetPlayerPublicName("player-"+c.username, name)
	}
}

func hydrateClientPublicName(c *Client) error {
	if c == nil || c.username == "" {
		return errors.New("public name unavailable")
	}
	// Standalone protocol fixtures have no database; production initialization
	// requires one. This fallback changes presentation only, never permissions.
	if db == nil {
		setClientPublicName(c, c.username)
		return nil
	}
	owner := c.username
	name, err := db.OwnPublicName(owner)
	if err != nil || name == "" || c.username != owner || c.transportClosed.Load() || !currentCharacterConnection(c) {
		return errors.New("public name unavailable")
	}
	setClientPublicName(c, name)
	return nil
}

// One bounded projection per requested list/history, never a database lookup
// on every rendered frame or simulation tick. A failed projection uses a neutral
// label rather than resurrecting a corrected abusive account name publicly.
func publicPlayerNames(accounts []string) map[string]string {
	names := make(map[string]string, len(accounts))
	for _, account := range accounts {
		names[account] = account
	}
	if db == nil {
		return names
	} // Isolated legacy fixtures; production always has DB.
	if labels, err := db.PublicPlayerNames(accounts); err == nil {
		return labels
	}
	for account := range names {
		names[account] = "Adventurer"
	}
	return names
}
