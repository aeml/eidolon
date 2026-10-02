package main

import (
	"errors"
	"strings"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Used only for new invitations/composition, never saved ownership or a quoted
// response. Online labels are already hydrated; no DB read per chat message.
func activeClientByPublicName(input string) *Client {
	input = strings.TrimSpace(input)
	if input == "" || len(input) > 256 {
		return nil
	}
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	if c := activeSessions[input]; c != nil && !c.retired.Load() && !c.transportClosed.Load() {
		return c
	}
	var found *Client
	for _, c := range activeSessions {
		if c == nil || c.retired.Load() || c.transportClosed.Load() || (!strings.EqualFold(c.username, input) && !strings.EqualFold(clientPublicName(c), input)) {
			continue
		}
		if found != nil {
			return nil
		}
		found = c
	}
	return found
}

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
	unique := make([]string, 0, len(accounts))
	for _, account := range accounts {
		if account == "" {
			continue
		}
		if _, exists := names[account]; exists {
			continue
		}
		names[account] = account
		unique = append(unique, account)
	}
	if db == nil {
		return names
	} // Isolated legacy fixtures; production always has DB.
	for start := 0; start < len(unique); start += 256 {
		batch := unique[start:min(start+256, len(unique))]
		labels, err := db.PublicPlayerNames(batch)
		for _, account := range batch {
			if err != nil {
				names[account] = "Adventurer"
			} else {
				names[account] = labels[account]
			}
		}
	}
	return names
}

// These copies exist only at the presentation boundary; settlement continues
// to read canonical names and IDs from the unchanged trading snapshots/store.
func publicAuctionViews(auctions []*game.Auction) []*game.Auction {
	accounts := make([]string, 0, 2*len(auctions))
	for _, auction := range auctions {
		if auction == nil {
			continue
		}
		accounts = append(accounts, auction.SellerName, auction.BidderName)
	}
	labels := publicPlayerNames(accounts)
	views := make([]*game.Auction, 0, len(auctions))
	for _, auction := range auctions {
		if auction == nil {
			continue
		}
		copy := *auction
		copy.SellerName = labels[auction.SellerName]
		copy.BidderName = labels[auction.BidderName]
		views = append(views, &copy)
	}
	return views
}

type publicPvPProfile struct {
	database.PvPProfile
	Name string `json:"name"`
}

func publicPvPProfiles(profiles []database.PvPProfile) []publicPvPProfile {
	accounts := make([]string, 0, len(profiles))
	for _, profile := range profiles {
		accounts = append(accounts, playerIDToUsername(profile.PlayerID))
	}
	labels := publicPlayerNames(accounts)
	views := make([]publicPvPProfile, 0, len(profiles))
	for _, profile := range profiles {
		views = append(views, publicPvPProfile{profile, labels[playerIDToUsername(profile.PlayerID)]})
	}
	return views
}
