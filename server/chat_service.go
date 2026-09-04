package main

import (
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const maximumChatCharacters = 500

type chatHistory struct {
	worlds      map[string][]ChatPayload
	parties     map[string][]ChatPayload
	guilds      map[string][]ChatPayload
	whispers    map[string][]ChatPayload
	replyTarget map[string]string
	blocked     map[string]map[string]bool
	ignored     map[string]map[string]bool
}

type structuredChatService struct {
	mu      sync.Mutex
	limit   int
	history chatHistory
	now     func() time.Time
}

var chatService = newStructuredChatService(50)

func newStructuredChatService(historyLimit int) *structuredChatService {
	return &structuredChatService{
		limit: historyLimit,
		history: chatHistory{
			worlds:      make(map[string][]ChatPayload),
			parties:     make(map[string][]ChatPayload),
			guilds:      make(map[string][]ChatPayload),
			whispers:    make(map[string][]ChatPayload),
			replyTarget: make(map[string]string),
			blocked:     make(map[string]map[string]bool),
			ignored:     make(map[string]map[string]bool),
		},
		now: time.Now,
	}
}

func (service *structuredChatService) Send(sender *Client, input ChatPayload) error {
	if sender == nil || sender.username == "" || sender.playerID == "" {
		return errors.New("active character required")
	}
	channel, recipient, message, err := service.resolveInput(sender.username, input)
	if err != nil {
		return err
	}
	if !utf8.ValidString(message) || utf8.RuneCountInString(message) > maximumChatCharacters {
		return errors.New("chat message is too long")
	}

	payload := ChatPayload{
		Message:     message,
		Sender:      sender.username,
		Channel:     channel,
		Recipient:   recipient,
		TimestampMs: service.now().UnixMilli(),
	}

	switch channel {
	case "world":
		senderEntity := world.GetEntityCopy(sender.playerID)
		if senderEntity == nil {
			return errors.New("active character required")
		}
		instanceID := senderEntity.InstanceID
		service.recordWorld(instanceID, payload)
		for _, client := range activeClientSnapshot() {
			recipientEntity := world.GetEntityCopy(client.playerID)
			if recipientEntity != nil && recipientEntity.InstanceID == instanceID && !service.shouldFilter(client.username, sender.username) {
				sendChatPayload(client, payload)
			}
		}
	case "party":
		entity := world.GetEntityCopy(sender.playerID)
		if entity == nil || entity.PartyID == "" {
			return errors.New("you are not in a party")
		}
		service.recordParty(entity.PartyID, payload)
		for _, client := range activeClientSnapshot() {
			member := world.GetEntityCopy(client.playerID)
			if member != nil && member.PartyID == entity.PartyID && !service.shouldFilter(client.username, sender.username) {
				sendChatPayload(client, payload)
			}
		}
	case "guild":
		if db == nil {
			return errors.New("guild chat is unavailable")
		}
		guild, err := db.GetGuildForPlayer(sender.playerID)
		if err != nil || guild == nil {
			return errors.New("you are not in a guild")
		}
		service.recordGuild(guild.ID, payload)
		for _, member := range guild.Members {
			client := getClientByPlayerID(member.PlayerID)
			if client != nil && !service.shouldFilter(client.username, sender.username) {
				sendChatPayload(client, payload)
			}
		}
	case "whisper":
		recipientClient := activeClientByUsername(recipient)
		if recipientClient == nil || recipientClient.playerID == "" {
			return errors.New("whisper recipient is offline")
		}
		if strings.EqualFold(recipientClient.username, sender.username) {
			return errors.New("cannot whisper yourself")
		}
		if service.shouldFilter(recipientClient.username, sender.username) || service.isBlocked(sender.username, recipientClient.username) {
			return errors.New("unable to whisper recipient")
		}
		payload.Recipient = recipientClient.username
		service.recordWhisper(sender.username, recipientClient.username, payload)
		sendChatPayload(sender, payload)
		sendChatPayload(recipientClient, payload)
	default:
		return errors.New("unsupported chat channel")
	}
	return nil
}

func (service *structuredChatService) Replay(client *Client, partyID string) {
	if client == nil || client.username == "" {
		return
	}
	instanceID := ""
	if entity := world.GetEntityCopy(client.playerID); entity != nil {
		instanceID = entity.InstanceID
	}
	guildID := ""
	if db != nil {
		if guild, err := db.GetGuildForPlayer(client.playerID); err == nil && guild != nil {
			guildID = guild.ID
		}
	}
	service.mu.Lock()
	history := append([]ChatPayload(nil), service.history.worlds[instanceID]...)
	if partyID != "" {
		history = append(history, service.history.parties[partyID]...)
	}
	if guildID != "" {
		history = append(history, service.history.guilds[guildID]...)
	}
	history = append(history, service.history.whispers[strings.ToLower(client.username)]...)
	service.mu.Unlock()

	sort.SliceStable(history, func(left, right int) bool {
		return history[left].TimestampMs < history[right].TimestampMs
	})
	for _, payload := range history {
		if service.shouldFilter(client.username, payload.Sender) {
			continue
		}
		payload.History = true
		sendChatPayload(client, payload)
	}
}

func (service *structuredChatService) SetBlocked(blocker, blocked string, value bool) {
	blocker = strings.ToLower(blocker)
	blocked = strings.ToLower(blocked)
	service.mu.Lock()
	defer service.mu.Unlock()
	if service.history.blocked[blocker] == nil {
		service.history.blocked[blocker] = make(map[string]bool)
	}
	if value {
		service.history.blocked[blocker][blocked] = true
	} else {
		delete(service.history.blocked[blocker], blocked)
	}
}

func (service *structuredChatService) ReplaceBlocked(blocker string, blocked []string) {
	blocker = strings.ToLower(blocker)
	replacement := make(map[string]bool, len(blocked))
	for _, username := range blocked {
		replacement[strings.ToLower(username)] = true
	}
	service.mu.Lock()
	service.history.blocked[blocker] = replacement
	service.mu.Unlock()
}

func (service *structuredChatService) SetIgnored(ignorer, ignored string, value bool) {
	ignorer = strings.ToLower(ignorer)
	ignored = strings.ToLower(ignored)
	service.mu.Lock()
	defer service.mu.Unlock()
	if service.history.ignored[ignorer] == nil {
		service.history.ignored[ignorer] = make(map[string]bool)
	}
	if value {
		service.history.ignored[ignorer][ignored] = true
	} else {
		delete(service.history.ignored[ignorer], ignored)
	}
}

func (service *structuredChatService) ReplaceIgnored(ignorer string, ignored []string) {
	ignorer = strings.ToLower(ignorer)
	replacement := make(map[string]bool, len(ignored))
	for _, username := range ignored {
		replacement[strings.ToLower(username)] = true
	}
	service.mu.Lock()
	service.history.ignored[ignorer] = replacement
	service.mu.Unlock()
}

func (service *structuredChatService) isBlocked(first, second string) bool {
	first = strings.ToLower(first)
	second = strings.ToLower(second)
	if first == second {
		return false
	}
	service.mu.Lock()
	defer service.mu.Unlock()
	return service.history.blocked[first][second] || service.history.blocked[second][first]
}

func (service *structuredChatService) shouldFilter(viewer, sender string) bool {
	viewer = strings.ToLower(viewer)
	sender = strings.ToLower(sender)
	if viewer == sender {
		return false
	}
	service.mu.Lock()
	defer service.mu.Unlock()
	return service.history.blocked[viewer][sender] || service.history.blocked[sender][viewer] || service.history.ignored[viewer][sender]
}

func (service *structuredChatService) HandleModerationCommand(client *Client, raw string) (bool, error) {
	fields := strings.Fields(raw)
	if len(fields) == 0 {
		return false, nil
	}
	command := strings.ToLower(fields[0])
	if command != "/block" && command != "/ignore" && command != "/unblock" && command != "/unignore" {
		return false, nil
	}
	if len(fields) != 2 {
		return true, errors.New("usage: /block|/unblock|/ignore|/unignore <player>")
	}
	if db == nil {
		return true, errors.New("relationship service unavailable")
	}
	target, err := db.GetUser(fields[1])
	if err != nil || target == nil {
		return true, errors.New("player not found")
	}
	if strings.EqualFold(client.username, target.Username) {
		return true, errors.New("cannot block yourself")
	}
	if command == "/unblock" {
		if err := db.UnblockPlayer(usernameToPlayerID(client.username), usernameToPlayerID(target.Username)); err != nil {
			return true, err
		}
		service.SetBlocked(client.username, target.Username, false)
		client.sendSystemChat("Unblocked " + target.Username + ".")
		return true, nil
	}
	if command == "/unignore" {
		if err := db.UnignorePlayer(usernameToPlayerID(client.username), usernameToPlayerID(target.Username)); err != nil {
			return true, err
		}
		service.SetIgnored(client.username, target.Username, false)
		client.sendSystemChat("Unignored " + target.Username + ".")
		return true, nil
	}
	if command == "/ignore" {
		if err := db.IgnorePlayer(usernameToPlayerID(client.username), usernameToPlayerID(target.Username)); err != nil {
			return true, err
		}
		service.SetIgnored(client.username, target.Username, true)
		client.sendSystemChat("Ignored " + target.Username + ".")
		return true, nil
	}
	if err := db.BlockPlayer(usernameToPlayerID(client.username), usernameToPlayerID(target.Username)); err != nil {
		return true, err
	}
	service.SetBlocked(client.username, target.Username, true)
	client.sendSystemChat("Blocked " + target.Username + ".")
	return true, nil
}

func refreshChatBlocks(username string) {
	if db == nil || username == "" {
		return
	}
	relationships, err := db.GetBlockedPlayers(usernameToPlayerID(username))
	if err != nil {
		return
	}
	blocked := make([]string, 0, len(relationships))
	for _, relationship := range relationships {
		if relationship != nil {
			blocked = append(blocked, playerIDToUsername(relationship.AddresseeID))
		}
	}
	chatService.ReplaceBlocked(username, blocked)
	ignoredRelationships, err := db.GetIgnoredPlayers(usernameToPlayerID(username))
	if err != nil {
		return
	}
	ignored := make([]string, 0, len(ignoredRelationships))
	for _, relationship := range ignoredRelationships {
		if relationship != nil {
			ignored = append(ignored, playerIDToUsername(relationship.AddresseeID))
		}
	}
	chatService.ReplaceIgnored(username, ignored)
}

func (service *structuredChatService) resolveInput(sender string, input ChatPayload) (string, string, string, error) {
	message := strings.TrimSpace(input.Message)
	channel := strings.ToLower(strings.TrimSpace(input.Channel))
	recipient := strings.TrimSpace(input.Recipient)
	if channel == "" || channel == "global" {
		channel = "world"
	}

	fields := strings.Fields(message)
	if len(fields) > 0 {
		command := strings.ToLower(fields[0])
		switch command {
		case "/p", "/party":
			channel = "party"
			message = strings.TrimSpace(strings.TrimPrefix(message, fields[0]))
		case "/g", "/guild":
			channel = "guild"
			message = strings.TrimSpace(strings.TrimPrefix(message, fields[0]))
		case "/w", "/whisper":
			if len(fields) < 3 {
				return "", "", "", errors.New("usage: /w <player> <message>")
			}
			channel = "whisper"
			recipient = fields[1]
			message = strings.TrimSpace(strings.Join(fields[2:], " "))
		case "/r":
			if len(fields) < 2 {
				return "", "", "", errors.New("usage: /r <message>")
			}
			service.mu.Lock()
			recipient = service.history.replyTarget[strings.ToLower(sender)]
			service.mu.Unlock()
			if recipient == "" {
				return "", "", "", errors.New("no whisper to reply to")
			}
			channel = "whisper"
			message = strings.TrimSpace(strings.TrimPrefix(message, fields[0]))
		case "/world":
			channel = "world"
			message = strings.TrimSpace(strings.TrimPrefix(message, fields[0]))
		}
	}
	if message == "" {
		return "", "", "", errors.New("chat message is empty")
	}
	if channel == "whisper" && recipient == "" {
		return "", "", "", errors.New("whisper recipient is required")
	}
	return channel, recipient, message, nil
}

func (service *structuredChatService) recordWorld(instanceID string, payload ChatPayload) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.history.worlds[instanceID] = appendBounded(service.history.worlds[instanceID], payload, service.limit)
}

func (service *structuredChatService) recordParty(partyID string, payload ChatPayload) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.history.parties[partyID] = appendBounded(service.history.parties[partyID], payload, service.limit)
}

func (service *structuredChatService) recordGuild(guildID string, payload ChatPayload) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.history.guilds[guildID] = appendBounded(service.history.guilds[guildID], payload, service.limit)
}

func (service *structuredChatService) recordWhisper(sender, recipient string, payload ChatPayload) {
	service.mu.Lock()
	defer service.mu.Unlock()
	senderKey := strings.ToLower(sender)
	recipientKey := strings.ToLower(recipient)
	service.history.whispers[senderKey] = appendBounded(service.history.whispers[senderKey], payload, service.limit)
	service.history.whispers[recipientKey] = appendBounded(service.history.whispers[recipientKey], payload, service.limit)
	service.history.replyTarget[senderKey] = recipient
	service.history.replyTarget[recipientKey] = sender
}

func appendBounded(history []ChatPayload, payload ChatPayload, limit int) []ChatPayload {
	history = append(history, payload)
	if limit > 0 && len(history) > limit {
		history = append([]ChatPayload(nil), history[len(history)-limit:]...)
	}
	return history
}

func activeClientSnapshot() []*Client {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	clients := make([]*Client, 0, len(activeSessions))
	for _, client := range activeSessions {
		if client != nil && client.playerID != "" {
			clients = append(clients, client)
		}
	}
	return clients
}

func activeClientByUsername(username string) *Client {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	if client := activeSessions[username]; client != nil {
		return client
	}
	for activeUsername, client := range activeSessions {
		if strings.EqualFold(activeUsername, username) {
			return client
		}
	}
	return nil
}

func sendChatPayload(client *Client, payload ChatPayload) {
	if client == nil {
		return
	}
	encodedPayload, err := json.Marshal(payload)
	if err != nil {
		return
	}
	encodedMessage, err := json.Marshal(Message{Type: MsgChat, Payload: encodedPayload})
	if err == nil {
		client.sendSafe(encodedMessage)
	}
}
