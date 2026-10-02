package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

// Exercise registered production handlers, immediate retirement, join/resume
// admission and durable reversal. Every account belongs to disposable Mongo.
func TestAdminModerationActualSessionsAndRestart(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo and built server")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires isolated loopback Mongo and absolute binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	operator := fmt.Sprintf("moderator-%d", time.Now().UnixNano())
	owner := fmt.Sprintf("subject-%d", time.Now().UnixNano())
	for _, name := range []string{operator, owner} {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-test-password"); err != nil {
			t.Fatal(err)
		}
	}
	if ok, err := repo.GrantAdminRole(operator, operator, "disposable_moderation_fixture"); err != nil || !ok {
		t.Fatal(ok, err)
	}
	fixture := &database.Character{Name: owner, Class: "Wizard", Level: 30, Gold: 1234, EP: 17,
		ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200, LastDailyQuest: time.Now(),
		Stats:     database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10},
		Resources: &database.CharacterResources{Version: 1, Health: 17, Mana: 100}}
	if err := repo.SetFirstCharacter(owner, fixture); err != nil {
		t.Fatal(err)
	}
	conduct, err := repo.CreateReport(operator, "Player Report", "Private synthetic evidence, not a public explanation.")
	if err != nil {
		t.Fatal(err)
	}
	preview, err := repo.ReadChatModerationTarget(operator, owner)
	if err != nil {
		t.Fatal(err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 211, "-save-journal-dir", journal)
	defer stop()
	staff, _ := resourceLoginCharacter(t, address, operator, operator+"-test-password", "Fighter")
	subject, token := resourceLoginCharacter(t, address, owner, owner+"-test-password", "Wizard")
	resourceSend(t, staff, MsgAdminStatus, map[string]string{"id": "moderation-status-0001"})
	var status adminReadResult
	resourceReadMessage(t, staff, MsgAdminStatus+"_result", &status)
	if !status.Success || !status.Authorized || !status.ModerationEnabled {
		t.Fatal("production capability missing", status)
	}
	change := func(conn *websocket.Conn, action string, revision int64, noticeID string) {
		t.Helper()
		duration := int64(600)
		publicReason := "Public synthetic explanation"
		if action == database.ModerationRequireNameChange || action == database.ChatModerationRevoke {
			duration = 0
		}
		if action == database.ChatModerationRevoke {
			publicReason = ""
		}
		resourceSend(t, conn, MsgAdminChatModeration, map[string]any{
			"id": fmt.Sprintf("socket-response-%d", revision), "accountId": preview.AccountID.Hex(),
			"reportId": conduct.ID.Hex(), "expectedRevision": revision, "action": action,
			"durationSeconds": duration, "noticeId": noticeID,
			"publicReason": publicReason, "privateReason": "Private synthetic evidence", "confirmed": true,
		})
		var response adminMutationResult
		resourceReadMessage(t, conn, MsgAdminChatModeration+"_result", &response)
		if !response.Success || !response.Authorized || !response.Final || response.Pending || strings.Contains(response.Message, "Private synthetic") {
			t.Fatal(response)
		}
	}
	denied := func(conn *websocket.Conn, kind string) {
		t.Helper()
		var payload struct{ Kind, Message, NoticeID string }
		resourceReadMessage(t, conn, "world_access_denied", &payload)
		if payload.Kind != kind || payload.NoticeID == "" || !strings.Contains(payload.Message, "Account help") || strings.Contains(payload.Message, "Private synthetic") {
			t.Fatal("incorrect public denial", payload)
		}
		// Old clients must also lose the transport after the control is flushed.
		conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				if timeout, ok := err.(net.Error); ok && timeout.Timeout() {
					t.Fatal("world denial was delivered without closing the transport")
				}
				break
			}
		}
	}
	loginHelp := func() *websocket.Conn {
		t.Helper()
		conn, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { conn.Close() })
		resourceSend(t, conn, MsgLogin, AuthPayload{Username: owner, Password: owner + "-test-password"})
		var result struct {
			HasCharacter bool `json:"hasCharacter"`
		}
		resourceReadMessage(t, conn, "login_success", &result)
		if !result.HasCharacter {
			t.Fatal("restriction deleted the character")
		}
		return conn
	}
	checkNotices := func(conn *websocket.Conn, id string, count int) {
		t.Helper()
		resourceSend(t, conn, MsgModerationNotice, map[string]string{"requestId": id})
		var result struct {
			Success bool
			Notices []database.ChatMuteNotice
		}
		resourceReadMessage(t, conn, MsgModerationNotice+"_result", &result)
		if !result.Success || len(result.Notices) != count {
			t.Fatal(result)
		}
	}
	change(staff, database.ChatModerationMute, 0, "")
	resourceSend(t, subject, MsgChat, ChatPayload{Message: "muted world message"})
	resourceReadMessage(t, subject, MsgError, nil)
	// A mute is not a suspension: ordinary gameplay requests still work.
	resourceSend(t, subject, MsgAbility, AbilityPayload{SkillName: "not-an-unlocked-skill"})
	resourceReadMessage(t, subject, MsgAbilityResult, nil)
	change(staff, database.ModerationRequireNameChange, 1, "")
	denied(subject, database.ModerationRequireNameChange)
	resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Close()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
	denied(resumed, database.ModerationRequireNameChange)
	help := loginHelp()
	checkNotices(help, "socket-notices-0001", 2)
	state, err := repo.ReadAccountChatModeration(preview.AccountID)
	if err != nil || state.NameChange == nil || state.Mute == nil {
		t.Fatal(state, err)
	}
	label := fmt.Sprintf("Keeper %012d", time.Now().UnixNano()%1_000_000_000_000)
	resourceSend(t, help, MsgPublicNameCorrection, database.PublicNameCorrectionRequest{ID: "socket-name-0001", NoticeID: state.NameChange.ID, PublicName: label, Confirmed: true})
	var correction adminMutationResult
	resourceReadMessage(t, help, MsgPublicNameCorrection+"_result", &correction)
	if !correction.Success || !correction.Final {
		t.Fatal(correction)
	}
	checkNotices(help, "socket-notices-0002", 1)
	help.Close()
	subject, _ = resourceLoginCharacter(t, address, owner, owner+"-test-password", "Wizard")
	change(staff, database.ModerationSuspend, 3, "")
	denied(subject, database.ModerationSuspend)
	help = loginHelp()
	checkNotices(help, "socket-notices-0003", 2)
	resourceSend(t, help, MsgReport, ReportPayload{ReportType: "Moderation Appeal", Text: "Please review this synthetic restriction.", RequestID: "socket-appeal-0001"})
	var appeal struct {
		Success  bool
		ReportID string
	}
	resourceReadMessage(t, help, "report_result", &appeal)
	if !appeal.Success || len(appeal.ReportID) != 24 {
		t.Fatal(appeal)
	}
	help.Close()
	staff.Close()
	stop()
	address, stop = compatStartServer(t, binary, uri, 212, "-save-journal-dir", journal)
	defer stop()
	help = loginHelp()
	checkNotices(help, "socket-notices-0004", 2)
	resourceSend(t, help, MsgJoin, JoinPayload{Type: "Wizard"})
	denied(help, database.ModerationSuspend)
	staff, _ = resourceLoginCharacter(t, address, operator, operator+"-test-password", "Fighter")
	state, err = repo.ReadAccountChatModeration(preview.AccountID)
	if err != nil || state.Revision != 4 || state.Suspension == nil || state.Mute == nil || state.NameChange != nil {
		t.Fatal(state, err)
	}
	change(staff, database.ChatModerationRevoke, 4, state.Suspension.ID)
	change(staff, database.ChatModerationRevoke, 5, state.Mute.ID)
	subject, _ = resourceLoginCharacter(t, address, owner, owner+"-test-password", "Wizard")
	resourceSend(t, subject, MsgChat, ChatPayload{Message: "reversed restriction permits chat"})
	var chat ChatPayload
	resourceReadMessage(t, subject, MsgChat, &chat)
	if chat.Sender != owner || chat.PublicName != label {
		t.Fatal("public correction changed account identity", chat)
	}
	saved := resourceCloseAndWait(t, repo, subject, owner)
	if saved.Name != fixture.Name || saved.Class != fixture.Class || saved.Level != fixture.Level || saved.Gold != fixture.Gold || saved.EP != fixture.EP {
		t.Fatal("moderation changed progression or currencies", saved)
	}
	state, err = repo.ReadAccountChatModeration(preview.AccountID)
	if err != nil || state.Revision != 6 || len(state.Receipts) != 6 || state.Mute != nil || state.Suspension != nil || state.NameChange != nil {
		t.Fatal("reversal state not durable", state, err)
	}
}
