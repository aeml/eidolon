package main

import "sync"

// Test-client cooperation only, not a server monster tag or a damage receipt.
// Combined cohorts have at most five parties. Each owns one current target;
// no actor history, timer, grant or private account data is retained here.
// Lock order is party.mu then claims.mu; claims never acquires a party lock.
type partyTargetClaims struct {
	mu      sync.Mutex
	targets []string
}

func (c *partyTargetClaims) available(group int, target string) bool {
	if c == nil {
		return true
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.availableLocked(group, target)
}

func (c *partyTargetClaims) availableLocked(group int, target string) bool {
	if group < 0 || group >= len(c.targets) || target == "" {
		return false
	}
	for other, held := range c.targets {
		if other != group && held == target {
			return false
		}
	}
	return true
}

func (c *partyTargetClaims) claim(group int, target string) bool {
	if c == nil {
		return true
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.availableLocked(group, target) {
		return false
	}
	c.targets[group] = target
	return true
}

func (c *partyTargetClaims) release(group int) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if group >= 0 && group < len(c.targets) {
		c.targets[group] = ""
	}
}
