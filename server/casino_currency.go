package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"errors"
	"time"
)

func casinoCurrencyMatches(saved, expected string) bool {
	return saved == expected || (saved == "" && expected == "gold")
}

// Only new funding and entry require current membership. Recovery and already
// funded actions must never be blocked by expiry or a membership lookup outage.
func requireCasinoVIPLocked(c *Client, now time.Time) error {
	if _, err := refreshVIPMembershipLocked(c, now); err != nil {
		return errors.New("VIP membership could not be verified; please try again")
	}
	p := world.GetEntityCopy(c.playerID)
	if p == nil || !now.Before(p.VIPUntil) {
		return errors.New("You must be a VIP to enter")
	}
	return nil
}

func requireCasinoFundingLocked(c *Client, currency string, amount int, now time.Time) error {
	if currency == "ep" {
		if err := requireCasinoVIPLocked(c, now); err != nil {
			return err
		}
	} else if currency != "gold" {
		return errors.New("unknown casino currency")
	}
	p := world.GetEntityCopy(c.playerID)
	if p == nil {
		return errors.New("character unavailable")
	}
	if amount <= 0 {
		return errors.New("invalid casino stake")
	}
	if currency == "ep" && p.EP < amount {
		return database.ErrInsufficientEP
	}
	if currency == "gold" && p.Gold < amount {
		return database.ErrInsufficientGold
	}
	return nil
}

func casinoBalance(p *game.Entity, currency string) int {
	if p == nil {
		return 0
	}
	if currency == "ep" {
		return p.EP
	}
	if currency == "gold" {
		return p.Gold
	}
	return 0
}
