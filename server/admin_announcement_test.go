package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func announcementPayload(kind, next string) string {
	payload, _ := json.Marshal(map[string]interface{}{"id": "notice-request-000001", "kind": kind,
		"message": "The realm is recovering; your saved items are retained.", "nextUpdateAt": next, "confirmed": true})
	return string(payload)
}

func announcementQueueFixture(t *testing.T) {
	t.Helper()
	oldQueue, oldStopping := broadcast, serverStopping.Load()
	broadcast = make(chan BroadcastMessage, 8)
	serverStopping.Store(false)
	t.Cleanup(func() { broadcast = oldQueue; serverStopping.Store(oldStopping) })
}

func announceForTest(t *testing.T, c *Client, payload string) adminMutationResult {
	t.Helper()
	handleAdminAnnouncement(c, Message{Type: MsgAdminAnnouncement, Payload: json.RawMessage(payload)})
	messages := drainSentMessages(c.send)
	if len(messages) != 1 || messages[0].Type != MsgAdminAnnouncement+"_result" {
		t.Fatal("missing private acknowledgement")
	}
	var result adminMutationResult
	if err := json.Unmarshal(messages[0].Payload, &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestAdminAnnouncementClosedSchemaAndUTCWindow(t *testing.T) {
	now := time.Date(2026, 10, 6, 5, 0, 0, 0, time.UTC)
	valid := announcementPayload("maintenance", now.Add(time.Minute).Format(time.RFC3339))
	if _, err := decodeAdminAnnouncement([]byte(valid), now); err != nil {
		t.Fatal(err)
	}
	if _, err := decodeAdminAnnouncement([]byte(announcementPayload("recovery", "")), now); err != nil {
		t.Fatal("recovery wrongly requires another update", err)
	}
	invalid := []string{
		`null`, `[]`, valid + `{}`, strings.Repeat(" ", 1025),
		strings.Replace(valid, `"confirmed":true`, `"confirmed":false`, 1),
		strings.Replace(valid, `"confirmed":true`, `"confirmed":true,"confirmed":true`, 1),
		strings.Replace(valid, `"confirmed":true`, `"confirmed":true,"actor":"owner"`, 1),
		strings.Replace(valid, `"message":"`, `"message":{},"unused":"`, 1),
		strings.Replace(valid, `The realm`, `\nThe realm`, 1),
		strings.Replace(valid, `The realm`, ` The realm`, 1),
		strings.Replace(valid, `The realm`, strings.Repeat("x", 221), 1),
		strings.Replace(valid, `maintenance`, `shutdown`, 1),
		announcementPayload("maintenance", ""), announcementPayload("maintenance", "not-a-date"),
		announcementPayload("maintenance", now.Format(time.RFC3339)),
		announcementPayload("maintenance", now.Add(-time.Second).Format(time.RFC3339)),
		announcementPayload("maintenance", now.Add(24*time.Hour+time.Second).Format(time.RFC3339)),
		announcementPayload("maintenance", now.Add(time.Hour).Format("2006-01-02T15:04:05+00:00")),
	}
	for _, payload := range invalid {
		if _, err := decodeAdminAnnouncement([]byte(payload), now); err == nil {
			t.Fatal("invalid, duplicate, unconfirmed or non-UTC notice accepted")
		}
	}
	if _, err := decodeAdminAnnouncement([]byte{0xff}, now); err == nil {
		t.Fatal("invalid UTF8 accepted")
	}
}

func TestAdminAnnouncementPersistsPublicCopyBeforeGlobalQueue(t *testing.T) {
	c, _ := adminReadFixture(t)
	announcementQueueFixture(t)
	next := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	result := announceForTest(t, c, announcementPayload("maintenance", next))
	if !result.Success || !result.Final || !result.Authorized || len(broadcast) != 1 {
		t.Fatal("audited notice was not queued", result)
	}
	audit := adminActivities.(*fakeAdminActivityStore).events
	if len(audit) != 1 || audit[0].Action != MsgAdminAnnouncement || audit[0].Actor != c.username || audit[0].RequestID != result.ID ||
		!strings.Contains(audit[0].Reason, next) || !strings.Contains(audit[0].Reason, "admission only") || database.ValidateAdminActivity(audit[0]) != nil {
		t.Fatal("notice copy or admission audit lost")
	}
	notice := <-broadcast
	if notice.Type != MsgChat || broadcastRequiresScene(notice) || notice.InstanceID != "" {
		t.Fatal("notice is not global server chat")
	}
	var message Message
	if json.Unmarshal(notice.Data, &message) != nil {
		t.Fatal("invalid queued notice")
	}
	var chat map[string]string
	if json.Unmarshal(message.Payload, &chat) != nil || len(chat) != 3 || chat["sender"] != "System" || chat["channel"] != "server" ||
		!strings.Contains(chat["message"], next) || strings.Contains(string(notice.Data), c.username) || strings.Contains(string(notice.Data), result.ID) {
		t.Fatal("unsafe or incomplete public notice")
	}
	oldClients := clients
	clients = make(map[*Client]bool)
	t.Cleanup(func() { clients = oldClients })
	for index, scene := range []string{"", "dungeon_notice_test", game.CasinoInstanceID} {
		id := []string{"notice-town", "notice-dungeon", "notice-casino"}[index]
		world.AddEntity(&game.Entity{ID: id, Type: game.TypePlayer, InstanceID: scene})
		clients[&Client{username: id, playerID: id, send: make(chan []byte, 2)}] = true
	}
	deliverBroadcast(notice)
	for observer := range clients {
		messages := drainSentMessages(observer.send)
		if len(messages) != 1 || string(messages[0].Payload) != string(message.Payload) {
			t.Fatal("actual global delivery lost or changed notice across scenes")
		}
	}
}

func TestAdminAnnouncementAuthorityAuditAndQueueFailClosed(t *testing.T) {
	for _, scenario := range []string{"role", "role-store", "audit", "closed", "replacement", "late-role", "late-replacement", "queue", "stopping"} {
		t.Run(scenario, func(t *testing.T) {
			c, roles := adminReadFixture(t)
			announcementQueueFixture(t)
			switch scenario {
			case "role":
				roles.roles[c.username] = false
			case "role-store":
				roles.lookupErr = errors.New("private-role-error")
			case "audit":
				adminActivities.(*fakeAdminActivityStore).appendErr = errors.New("private-audit-error")
			case "closed":
				c.markTransportClosed()
			case "replacement":
				activeSessions[c.username] = &Client{username: c.username}
			case "late-role", "late-replacement":
				adminActivities = &adminCompletionActivityStore{fakeAdminActivityStore: &fakeAdminActivityStore{}, afterAppend: func() {
					if scenario == "late-role" {
						roles.roles[c.username] = false
					} else {
						activeSessions[c.username] = &Client{username: c.username}
					}
				}}
			case "queue":
				broadcast = make(chan BroadcastMessage)
			case "stopping":
				serverStopping.Store(true)
			}
			payload := announcementPayload("recovery", "")
			if scenario == "closed" {
				handleAdminAnnouncement(c, Message{Type: MsgAdminAnnouncement, Payload: []byte(payload)})
				if len(broadcast) != 0 {
					t.Fatal("closed administrator queued a notice")
				}
				return
			}
			result := announceForTest(t, c, payload)
			if result.Success || len(broadcast) != 0 || strings.Contains(result.Message, "private-") {
				t.Fatal("refused action queued a notice or leaked diagnostics", result)
			}
		})
	}
}

func TestAdminAnnouncementHasBoundedAuthenticatedDispatchPolicy(t *testing.T) {
	p := inboundMessagePolicies[MsgAdminAnnouncement]
	if messageHandlers[MsgAdminAnnouncement] == nil || p.access != accessAuthenticated || p.maxPayloadBytes != 1024 || p.burst != 3 || p.window != time.Minute {
		t.Fatal("notice route bypasses authentication or bounded rate/payload policy")
	}
}
