package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"sort"
	"time"
	"unicode"
	"unicode/utf8"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

const (
	MsgAdminStatus        = "admin_status"
	MsgAdminPlayers       = "admin_players"
	MsgAdminStatusResult  = "admin_status_result"
	MsgAdminPlayersResult = "admin_players_result"
	MsgAdminHistory       = "admin_history"
	MsgAdminHistoryResult = "admin_history_result"
	adminPlayerPageSize   = 50
)

var adminRequestID = regexp.MustCompile(`^[A-Za-z0-9_-]{16,64}$`)

type adminActivityStore interface {
	AppendAdminActivity(database.AdminActivity) error
	ReadAdminActivity(database.AdminActivityQuery) (database.AdminActivityPage, error)
	AdminActivityRetentionDays() int
}

var adminActivities adminActivityStore

type adminReadRequest struct {
	ID     string `json:"id"`
	After  string `json:"after,omitempty"`
	Before string `json:"before,omitempty"`
	Actor  string `json:"actor,omitempty"`
	Action string `json:"action,omitempty"`
}

type adminOnlinePlayer struct {
	AuditAccount string `json:"auditAccount,omitempty"`
	Account      string `json:"account"`
	PlayerID     string `json:"playerId"`
	Name         string `json:"name"`
	Class        string `json:"class"`
	Level        int    `json:"level"`
}

type adminReadResult struct {
	ID         string                      `json:"id"`
	Success    bool                        `json:"success"`
	Authorized bool                        `json:"authorized"`
	Message    string                      `json:"message"`
	Players    []adminOnlinePlayer         `json:"players,omitempty"`
	Next       string                      `json:"next,omitempty"`
	History    *database.AdminActivityPage `json:"history,omitempty"`
}

// Read requests have a deliberately small, closed schema. In particular actor,
// sender, role and duplicate keys cannot alter the authenticated identity.
func decodeAdminRead(msg Message) (adminReadRequest, error) {
	var request adminReadRequest
	decoder := json.NewDecoder(bytes.NewReader(msg.Payload))
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return request, errors.New("invalid request")
	}
	seen := map[string]bool{}
	for decoder.More() {
		token, err = decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || seen[key] {
			return request, errors.New("invalid field")
		}
		seen[key] = true
		value, valueErr := decoder.Token()
		text, stringValue := value.(string)
		if valueErr != nil || !stringValue {
			return request, errors.New("field must be a string")
		}
		switch key {
		case "id":
			request.ID = text
		case "after":
			if msg.Type != MsgAdminPlayers {
				return request, errors.New("invalid field")
			}
			request.After = text
		case "before", "actor", "action":
			if msg.Type != MsgAdminHistory {
				return request, errors.New("invalid field")
			}
			switch key {
			case "before":
				request.Before = text
			case "actor":
				request.Actor = text
			case "action":
				request.Action = text
			}
		default:
			return request, errors.New("unknown field")
		}
	}
	if _, err = decoder.Token(); err != nil {
		return request, err
	}
	if _, err = decoder.Token(); err != io.EOF {
		return request, errors.New("trailing data")
	}
	if !adminRequestID.MatchString(request.ID) || len(request.After) > 71 || !utf8.ValidString(request.After) {
		return request, errors.New("invalid request identifier or cursor")
	}
	for _, char := range request.After {
		if unicode.IsControl(char) {
			return request, errors.New("invalid cursor")
		}
	}
	return request, nil
}

func handleAdminRead(c *Client, msg Message) {
	result := adminReadResult{Message: "Administration is unavailable. Try refreshing."}
	responseType := MsgAdminStatusResult
	if msg.Type == MsgAdminPlayers {
		responseType = MsgAdminPlayersResult
	}
	if msg.Type == MsgAdminHistory {
		responseType = MsgAdminHistoryResult
	}
	defer func() {
		// Do not acknowledge a privileged read without its durable audit entry.
		// A later mutation must couple this to its own recoverable operation;
		// this read handler never grants currency, items or movement.
		if c.username != "" && currentCharacterConnection(c) {
			outcome := "error"
			if result.Success && result.Authorized {
				outcome = "success"
			} else if result.Message == "Administrator access is not enabled for this account." {
				outcome = "denied"
			}
			id := result.ID
			if id == "" {
				id = "invalid-request"
			}
			var auditErr error
			if adminActivities == nil {
				auditErr = errors.New("activity unavailable")
			} else {
				event, err := database.NewAdminActivity(c.username, "", msg.Type, id, outcome, result.Message, time.Now(), adminActivities.AdminActivityRetentionDays())
				auditErr = err
				if err == nil {
					auditErr = adminActivities.AppendAdminActivity(event)
				}
			}
			if auditErr != nil {
				result = adminReadResult{ID: result.ID, Message: "Administration activity storage is unavailable. Try refreshing."}
			}
		}
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(responseType, payload))
	}()
	request, err := decodeAdminRead(msg)
	if err != nil {
		result.Message = "Invalid administration request."
		return
	}
	result.ID = request.ID
	if c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) || adminRoles == nil {
		return
	}
	// No cached role, bootstrap allowlist or QA authorization is accepted here.
	authorized, err := adminRoles.HasAdminRole(c.username)
	if err != nil {
		return
	}
	result.Authorized = authorized
	if !authorized {
		result.Success = msg.Type == MsgAdminStatus
		result.Message = "Administrator access is not enabled for this account."
		return
	}
	if msg.Type == MsgAdminStatus {
		result.Success, result.Message = true, "Administrator access verified."
		return
	}
	if msg.Type == MsgAdminHistory {
		if adminActivities == nil {
			result.Authorized = false
			return
		}
		page, err := adminActivities.ReadAdminActivity(database.AdminActivityQuery{Before: request.Before, Actor: request.Actor, Action: request.Action})
		if err != nil {
			result.Authorized = false
			result.Message = "Activity history unavailable or filter invalid. Refresh with valid filters."
			return
		}
		result.History = &page
		result.Success, result.Message = true, "Activity history refreshed."
		return
	}
	if world == nil {
		result.Authorized = false
		return
	}
	result.Players, result.Next = adminOnlinePage(request.After)
	result.Success, result.Message = true, "Online players refreshed."
}

// Use the authenticated session registry, not nearby entities or a client-sent
// account. Copy only public character identity; never serialize full characters.
// Pagination is a sorted account keyset. Refresh starts a new live observation;
// players joining/leaving between pages are not a historical snapshot.
func adminOnlinePage(after string) ([]adminOnlinePlayer, string) {
	type binding struct{ account, playerID, key string }
	sessionsMu.Lock()
	bindings := make([]binding, 0, len(activeSessions))
	for account, client := range activeSessions {
		key := database.AdminActivityAccountKey(account)
		if key > after && client != nil && client.playerID != "" &&
			!client.retired.Load() && !client.transportClosed.Load() {
			bindings = append(bindings, binding{account, client.playerID, key})
		}
	}
	sessionsMu.Unlock()
	sort.Slice(bindings, func(i, j int) bool { return bindings[i].key < bindings[j].key })
	players := make([]adminOnlinePlayer, 0, adminPlayerPageSize)
	for _, bound := range bindings {
		entity := world.GetEntity(bound.playerID)
		if entity == nil {
			continue
		}
		entity.Mu.RLock()
		entry := adminOnlinePlayer{Account: bound.account, PlayerID: entity.ID,
			Name: entity.Name, Class: entity.SubType, Level: entity.Level}
		if bound.key != bound.account {
			entry.AuditAccount = bound.key
		}
		isPlayer := entity.Type == game.TypePlayer
		entity.Mu.RUnlock()
		if !isPlayer {
			continue
		}
		if len(players) == adminPlayerPageSize {
			return players, database.AdminActivityAccountKey(players[len(players)-1].Account)
		}
		players = append(players, entry)
	}
	return players, ""
}
