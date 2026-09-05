package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"

	"github.com/gorilla/websocket"
)

func (c *Client) handleChatCommand(raw string) bool {
	if raw == "" || !strings.HasPrefix(raw, "/") {
		return false
	}

	fields := strings.Fields(raw)
	if len(fields) == 0 {
		return false
	}

	switch fields[0] {
	case "/level":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 2 {
			c.sendError("Usage: /level <1-100>")
			return true
		}

		level, err := strconv.Atoi(fields[1])
		if err != nil || level < 1 || level > game.MaxPlayerLevel {
			c.sendError(fmt.Sprintf("Usage: /level <1-%d>", game.MaxPlayerLevel))
			return true
		}
		if c.playerID == "" || world == nil {
			c.sendError("No active character to level.")
			return true
		}

		player, ok := world.SetPlayerLevel(c.playerID, level)
		if !ok || player == nil {
			c.sendError("No active character to level.")
			return true
		}

		if db != nil {
			char, err := db.GetCharacter(c.username, c.username)
			if err == nil && char != nil {
				char.Level = player.Level
				char.XP = player.Experience
				char.SkillPoints = player.SkillPoints
				char.SelectedBranch = player.SelectedBranch
				char.UnlockedSkills = append([]string(nil), player.UnlockedSkills...)
				char.Stats = database.Stats{
					Vitality:     player.BaseStats.Vitality,
					Strength:     player.BaseStats.Strength,
					Dexterity:    player.BaseStats.Dexterity,
					Intelligence: player.BaseStats.Intelligence,
					Wisdom:       player.BaseStats.Wisdom,
				}
				if err := db.SaveCharacter(c.username, char); err != nil {
					log.Printf("Failed to persist /level for %s: %v", c.username, err)
				}
			}
		}

		c.sendSystemChat(fmt.Sprintf("Level set to %d.", level))
		return true
	case "/qa-waypoint":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 2 || (!strings.EqualFold(fields[1], "combat") &&
			!strings.EqualFold(fields[1], "encounter") && !strings.EqualFold(fields[1], "verdant")) {
			c.sendError("Usage: /qa-waypoint <combat|encounter|verdant>")
			return true
		}
		if c.playerID == "" || world == nil {
			c.sendError("No active overworld character for QA waypoint.")
			return true
		}

		if _, ok := world.MovePlayerToQAWaypoint(c.playerID, fields[1]); !ok {
			c.sendError("No active overworld character for QA waypoint.")
			return true
		}

		if strings.EqualFold(fields[1], "combat") {
			c.sendSystemChat("QA waypoint set outside the east town gate; protection active for 5 minutes.")
		} else if strings.EqualFold(fields[1], "encounter") {
			c.sendSystemChat("QA waypoint set near a live overworld encounter; protection active for 5 minutes.")
		} else {
			c.sendSystemChat("QA waypoint set near Verdant Bastion; protection active for 5 minutes.")
		}
		return true
	case "/qa-hazard":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 2 || (!strings.EqualFold(fields[1], "earth") &&
			!strings.EqualFold(fields[1], "water") && !strings.EqualFold(fields[1], "fire") &&
			!strings.EqualFold(fields[1], "air") && !strings.EqualFold(fields[1], "town")) {
			c.sendError("Usage: /qa-hazard <earth|water|fire|air|town>")
			return true
		}
		if c.playerID == "" || world == nil {
			c.sendError("No active overworld character for QA hazard inspection.")
			return true
		}

		_, hazard, ok := world.MovePlayerToQAHazard(c.playerID, fields[1])
		if !ok {
			c.sendError("No active overworld character for QA hazard inspection.")
			return true
		}
		if hazard == nil {
			c.sendSystemChat("QA hazard pilgrimage returned to Lanternhold safety.")
		} else {
			c.sendSystemChat(fmt.Sprintf(
				"QA hazard inspection active: %s at exact radius %.0f; hostile protection remains bounded.",
				hazard.HazardType,
				hazard.Radius,
			))
		}
		return true
	case "/qa-dungeon-fallback-next":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 1 {
			c.sendError("Usage: /qa-dungeon-fallback-next")
			return true
		}
		if c.playerID == "" || world == nil || !world.ArmPlayerQADungeonFallback(c.playerID) {
			c.sendError("Return to town alive as the party leader before selecting a QA fallback run.")
			return true
		}
		c.sendSystemChat("Next fresh dungeon will use its complete fallback route; normal access and combat rules remain active.")
		return true
	case "/qa-loot-next":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 1 {
			c.sendError("Usage: /qa-loot-next")
			return true
		}
		if c.playerID == "" || world == nil || !world.ArmPlayerQAGuaranteedLoot(c.playerID) {
			c.sendError("No active character for QA loot check.")
			return true
		}

		c.sendSystemChat("Next enemy kill will produce a QA loot drop.")
		return true
	case "/qa-animation-ready":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		lowHealth := len(fields) == 2 && strings.EqualFold(fields[1], "low-health")
		persistent := len(fields) == 2 && strings.EqualFold(fields[1], "persistent")
		nearDeath := len(fields) == 2 && strings.EqualFold(fields[1], "near-death")
		if len(fields) > 2 || (len(fields) == 2 && !lowHealth && !persistent && !nearDeath) {
			c.sendError("Usage: /qa-animation-ready [low-health|persistent|near-death]")
			return true
		}
		if c.playerID == "" || world == nil || !world.PreparePlayerForAnimationQA(c.playerID, lowHealth, persistent, nearDeath) {
			c.sendError("No active character for animation readiness.")
			return true
		}

		message := "Animation QA readiness restored."
		if lowHealth {
			message = "Animation QA readiness restored at low health."
		} else if persistent {
			message = "Animation QA readiness restored for persistent-effect reconstruction."
		} else if nearDeath {
			message = "Animation QA readiness restored at one health for hostile death validation."
		}
		c.sendSystemChat(message)
		payload, _ := json.Marshal(map[string]bool{
			"lowHealth":  lowHealth,
			"persistent": persistent,
			"nearDeath":  nearDeath,
		})
		c.sendSafe(createMessage(MsgQAAnimationReady, payload))
		return true
	case "/qa-protection":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 2 || !strings.EqualFold(fields[1], "off") {
			c.sendError("Usage: /qa-protection off")
			return true
		}
		if c.playerID == "" || world == nil || !world.DisablePlayerQAProtection(c.playerID) {
			c.sendError("No active character for QA protection control.")
			return true
		}

		c.sendSystemChat("QA waypoint protection disabled; hostile damage is authoritative.")
		return true
	case "/qa-disconnect":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 1 {
			c.sendError("Usage: /qa-disconnect")
			return true
		}

		c.sendSystemChat("QA reconnect fault scheduled.")
		c.triggerQADisconnect()
		return true
	default:
		return false
	}
}

func (c *Client) triggerQADisconnect() {
	if c.qaDisconnect != nil {
		c.qaDisconnect()
		return
	}
	if c.conn == nil {
		return
	}

	conn := c.conn
	go func() {
		// Let writePump flush the system chat before the server creates a real
		// transport interruption. NetworkManager must then resume the session.
		time.Sleep(150 * time.Millisecond)
		_ = conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseGoingAway, "QA reconnect fault"),
			time.Now().Add(time.Second),
		)
		_ = conn.Close()
	}()
}

func (c *Client) sendSystemChat(message string) {
	payload, _ := json.Marshal(ChatPayload{Message: message, Sender: "System", Channel: "server"})
	msg, _ := json.Marshal(Message{Type: MsgChat, Payload: payload})
	c.sendSafe(msg)
}

func (c *Client) sendSafe(data []byte) (delivered bool) {
	defer func() {
		if r := recover(); r != nil {
			// Channel closed, client disconnected
			delivered = false
		}
	}()
	queue := c.send
	if c.prioritySend != nil {
		queue = c.prioritySend
	}
	select {
	case queue <- data:
		return true
	default:
		// A saturated lossless lane means the peer cannot keep up. Never block
		// gameplay or the hub behind it; closing the socket makes the existing
		// read-pump cleanup path retire the client deterministically.
		if c.conn != nil {
			_ = c.conn.Close()
		}
		return false
	}
}

func (c *Client) sendError(msg string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from sendError panic: %v", r)
		}
	}()
	m := Message{
		Type:    MsgError,
		Payload: json.RawMessage(`"` + msg + `"`),
	}
	b, _ := json.Marshal(m)
	c.sendSafe(b)
}

// entityToSnapshot extracts fields we track for delta comparison
