package game

import "strings"

// DefaultSocialStatus is the status assigned when none is set or an invalid
// value is provided.
const DefaultSocialStatus = "available"

var validSocialStatuses = map[string]bool{
	"available":     true,
	"looking_party": true,
	"in_run":        true,
	"busy":          true,
}

// NormalizeSocialStatus lower-cases and trims the input, returning
// DefaultSocialStatus if the result is not a recognised status value.
func NormalizeSocialStatus(status string) string {
	normalized := strings.ToLower(strings.TrimSpace(status))
	if validSocialStatuses[normalized] {
		return normalized
	}
	return DefaultSocialStatus
}

// SetPlayerSocialStatus applies an explicit, player-requested status change.
// Returns the resulting status and true, or ("", false) if the player is not
// found in the world.
func (w *World) SetPlayerSocialStatus(playerID string, status string) (string, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player, ok := w.Entities[playerID]
	if !ok || player.Type != TypePlayer {
		return "", false
	}
	player.SocialStatus = NormalizeSocialStatus(status)
	return player.SocialStatus, true
}

// SetPlayerSocialStatusAutomatic applies a system-driven status change with
// context-aware preconditions (0.37.4):
//
//   - "in_run"   is set only when the current status is not "busy"
//     (player explicitly requested no-disturb; respect it).
//   - "available" is set only when the current status is "in_run"
//     (revert what the system previously set; don't clobber a manual choice).
//
// Returns the resulting status and true if the update was applied, or the
// unchanged status and false if the precondition was not met.
func (w *World) SetPlayerSocialStatusAutomatic(playerID, newStatus string) (string, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player, ok := w.Entities[playerID]
	if !ok || player.Type != TypePlayer {
		return "", false
	}
	current := NormalizeSocialStatus(player.SocialStatus)
	target := NormalizeSocialStatus(newStatus)
	switch target {
	case "in_run":
		if current == "busy" {
			return current, false
		}
	case "available":
		if current != "in_run" {
			return current, false
		}
	}
	player.SocialStatus = target
	return target, true
}
