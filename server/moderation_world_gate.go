package main

import (
	"errors"
	"time"

	"eidolon-server/internal/database"
)

// Prepared gate for world entry/resume. Do not install
// until login-screen notices/appeals, public-name correction and immediate
// retirement of already-online restricted characters are connected as well.
// Authentication itself must remain available for notices and appeal drafts.
// Retire online targets under their character-work lock when a response is
// applied; never add a Mongo query to every movement or snapshot tick.
type worldModerationGate func(*Client) (*database.ChatMuteNotice, error)

func newWorldModerationGate(store ownAccountModerationNoticeStore, clock func() time.Time) worldModerationGate {
	return func(client *Client) (*database.ChatMuteNotice, error) {
		unavailable := errors.New("World access could not be checked. Please reconnect and try again.")
		if store == nil || clock == nil || client == nil || client.username == "" ||
			client.transportClosed.Load() || !currentCharacterConnection(client) {
			return nil, unavailable
		}
		owner := client.username
		notices, err := store.OwnModerationNotices(owner)
		if err != nil || len(notices) > 3 || client.username != owner ||
			client.transportClosed.Load() || !currentCharacterConnection(client) {
			return nil, unavailable
		}
		seen := make(map[string]bool, 3)
		var suspension, nameChange *database.ChatMuteNotice
		now := clock()
		for _, notice := range notices {
			kind := notice.Kind
			if kind == "" {
				kind = database.ChatModerationMute // Legacy mute only.
			}
			if !notice.Valid() || seen[kind] {
				return nil, unavailable
			}
			seen[kind] = true
			if !notice.Active(now) {
				continue
			}
			copy := notice
			switch kind {
			case database.ModerationSuspend:
				suspension = &copy
			case database.ModerationRequireNameChange:
				nameChange = &copy
			}
		}
		// Mutes restrict chat, not gameplay. A simultaneous suspension remains
		// effective after correcting a name; independent reversals stay separate.
		if suspension != nil {
			return suspension, nil
		}
		return nameChange, nil
	}
}
