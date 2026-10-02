package main

import (
	"errors"
	"fmt"
	"time"
)

// Prepared for the approved policy's startup wiring. No command creates mutes
// and no live service installs this guard yet. A failed read cannot become an
// unrestricted account, and no per-session cache outlives a reversal or expiry.
func newTemporaryChatMuteGuard(store ownChatMuteNoticeStore, now func() time.Time) func(*Client) error {
	return func(c *Client) error {
		unavailable := errors.New("Chat permission could not be checked. Please try again.")
		if store == nil || now == nil || c == nil || c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) {
			return unavailable
		}
		owner := c.username
		notice, err := store.OwnChatMuteNotice(owner)
		if err != nil || (notice != nil && (!notice.Valid() || notice.Kind != "" && notice.Kind != "mute")) {
			return unavailable
		}
		if c.username != owner || c.transportClosed.Load() || !currentCharacterConnection(c) {
			return unavailable
		}
		checkedAt := now()
		if notice == nil || checkedAt.Before(notice.StartedAt) || !checkedAt.Before(notice.ExpiresAt) {
			return nil
		}
		// Only the public reference and expiry, not reasons or staff receipts.
		return fmt.Errorf("Chat is temporarily muted until %s. Open Report, check your chat-mute notice and start an appeal draft. Reference: %s",
			notice.ExpiresAt.UTC().Format(time.RFC3339), notice.ID)
	}
}
