package main

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/url"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

// Temporarily enables prepared routes only inside this test process. It proves
// real admission/handlers/Mongo interaction, NOT production protocol activation
// or a physical WebSocket login. Never consumes production MONGO_URI.
func TestReportReviewMongoPreparedChatModerationFlow(t *testing.T) {
	uri := os.Getenv("EIDOLON_REPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme != "mongodb" || parsed.Hostname() != "127.0.0.1" || parsed.Port() == "" ||
		parsed.User != nil || os.Getenv("EIDOLON_REPORT_DISPOSABLE_DATABASE") != "1" {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	restoreChat := installChatTestState(t)
	defer restoreChat()
	previousDB, previousRoles, previousActivities := db, adminRoles, adminActivities
	previousChanges, previousTargets, previousNotices, previousStatuses := adminChatModerations, adminChatModerationTargets, moderationNotices, reportStatuses
	previousHandlers, previousPolicies := messageHandlers, inboundMessagePolicies
	defer func() {
		db, adminRoles, adminActivities = previousDB, previousRoles, previousActivities
		adminChatModerations, adminChatModerationTargets, moderationNotices, reportStatuses = previousChanges, previousTargets, previousNotices, previousStatuses
		messageHandlers, inboundMessagePolicies = previousHandlers, previousPolicies
	}()
	db, adminRoles, adminActivities = repo, repo, repo
	adminChatModerations, adminChatModerationTargets, moderationNotices, reportStatuses = repo, repo, repo, repo
	messageHandlers, inboundMessagePolicies = maps.Clone(messageHandlers), maps.Clone(inboundMessagePolicies)
	messageHandlers[MsgAdminChatModeration] = handleAdminChatModeration
	messageHandlers[MsgAdminChatModerationTarget] = handleAdminChatModerationTarget
	inboundMessagePolicies[MsgAdminChatModeration] = policy(accessAuthenticated, 12288, 5, 10*time.Second)
	inboundMessagePolicies[MsgAdminChatModerationTarget] = policy(accessAuthenticated, 3072, 5, 10*time.Second)
	chatService.authorizeSend = newTemporaryChatMuteGuard(repo, time.Now)
	operator, member := fmt.Sprintf("flow-operator-%d", time.Now().UnixNano()), fmt.Sprintf("flow-member-%d", time.Now().UnixNano())
	for _, name := range []string{operator, member} {
		if err := repo.CreateUser(name, name+"@example.invalid", "isolated-test-password"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := repo.GrantAdminRole(operator, operator, "isolated_moderation_flow"); err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateCharacter(member, &database.Character{Name: "Protected hero", Class: "Wizard", Level: 45}); err != nil {
		t.Fatal(err)
	}
	before, err := repo.GetUser(member)
	if err != nil {
		t.Fatal(err)
	}
	a, b := addChatTestClient(operator, "party-1"), addChatTestClient(member, "party-1")
	exchange := func(c *Client, kind string, payload any, responseType string) json.RawMessage {
		t.Helper()
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		c.handleMessage(Message{Type: kind, Payload: encoded})
		messages := drainSentMessages(c.send)
		for _, message := range messages {
			if message.Type == responseType {
				return message.Payload
			}
		}
		t.Fatalf("missing %s response to %s: %v", responseType, kind, messages)
		return nil
	}
	submit := func(c *Client, category, body, id string) string {
		t.Helper()
		payload := exchange(c, MsgReport, ReportPayload{ReportType: category, Text: body, RequestID: id}, "report_result")
		var result struct {
			Success  bool   `json:"success"`
			ReportID string `json:"reportId"`
		}
		if err := json.Unmarshal(payload, &result); err != nil || !result.Success || result.ReportID == "" {
			t.Fatal("report was not saved", string(payload), err)
		}
		return result.ReportID
	}
	caseID := submit(a, "Player Report", "Synthetic conduct case; the reporter is not the subject.", "flow-conduct-report-001")
	previewPayload := map[string]string{"id": "flow-target-request-001", "target": member}
	denied := exchange(b, MsgAdminChatModerationTarget, previewPayload, MsgAdminChatModerationTarget+"_result")
	if strings.Contains(string(denied), `"target":`) || strings.Contains(string(denied), `"authorized":true`) {
		t.Fatal("ordinary player received staff target", string(denied))
	}
	payload := exchange(a, MsgAdminChatModerationTarget, previewPayload, MsgAdminChatModerationTarget+"_result")
	var preview struct {
		Success bool                          `json:"success"`
		Target  database.ChatModerationTarget `json:"target"`
	}
	if err := json.Unmarshal(payload, &preview); err != nil || !preview.Success || preview.Target.Account != member || preview.Target.Revision != 0 || preview.Target.Notice != nil {
		t.Fatal("wrong target preview", string(payload), err)
	}
	if strings.Contains(string(payload), before.Email) || strings.Contains(string(payload), before.PasswordHash) || strings.Contains(string(payload), "Protected hero") {
		t.Fatal("target read leaked account data")
	}
	change := database.ChatModerationRequest{ID: "flow-mute-request-0001", ReportID: caseID, ExpectedRevision: 0,
		Action: database.ChatModerationMute, DurationSeconds: 600, PublicReason: "Public synthetic explanation; you may appeal.",
		PrivateReason: "Private synthetic staff evidence.", Confirmed: true}
	apply := func(c *Client, request database.ChatModerationRequest) adminMutationResult {
		t.Helper()
		encoded, _ := json.Marshal(request)
		var fields map[string]any
		_ = json.Unmarshal(encoded, &fields)
		fields["accountId"] = preview.Target.AccountID.Hex()
		payload := exchange(c, MsgAdminChatModeration, fields, MsgAdminChatModeration+"_result")
		var result adminMutationResult
		if err := json.Unmarshal(payload, &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	if result := apply(b, change); result.Success || result.Authorized {
		t.Fatal("ordinary player applied mute", result)
	}
	if result := apply(a, change); !result.Success || !result.Final {
		t.Fatal("confirmed mute failed", result)
	}
	state, err := repo.ReadAccountChatModeration(preview.Target.AccountID)
	if err != nil || state.Revision != 1 || state.Mute == nil || len(state.Receipts) != 1 {
		t.Fatal("missing atomic mute receipt", err)
	}
	issued := *state.Mute
	if result := apply(a, change); !result.Success {
		t.Fatal("explicit exact retry failed", result)
	}
	retried, err := repo.ReadAccountChatModeration(preview.Target.AccountID)
	if err != nil || !reflect.DeepEqual(state, retried) {
		t.Fatal("retry duplicated or extended mute", err)
	}
	denial := exchange(b, MsgChat, ChatPayload{Message: "denied chat must not be broadcast"}, "error")
	if !strings.Contains(string(denial), issued.ID) || strings.Contains(string(denial), change.PrivateReason) {
		t.Fatal("chat denial lacked safe appeal reference", string(denial))
	}
	assertNoChat(t, a)
	if len(chatService.history.worlds) != 0 {
		t.Fatal("denied chat recorded in history")
	}
	owned := exchange(b, MsgModerationNotice, map[string]string{"requestId": "flow-owner-notice-001"}, MsgModerationNotice+"_result")
	if !strings.Contains(string(owned), issued.ID) || !strings.Contains(string(owned), change.PublicReason) || strings.Contains(string(owned), change.PrivateReason) {
		t.Fatal("owner notice privacy failed", string(owned))
	}
	appealID := submit(b, "Moderation Appeal", "Please review notice "+issued.ID+". Synthetic appeal.", "flow-appeal-report-001")
	reversal := change
	reversal.ID, reversal.ReportID, reversal.ExpectedRevision, reversal.Action = "flow-revoke-request-01", appealID, 1, database.ChatModerationRevoke
	reversal.NoticeID, reversal.DurationSeconds, reversal.PublicReason = issued.ID, 0, ""
	reversal.PrivateReason = "Private synthetic appeal review."
	if result := apply(a, reversal); !result.Success {
		t.Fatal("appeal-linked reversal failed", result)
	}
	if result := apply(a, change); !result.Success {
		t.Fatal("historical retry lost receipt", result)
	}
	current, err := repo.ReadAccountChatModeration(preview.Target.AccountID)
	if err != nil || current.Revision != 2 || current.Mute != nil || len(current.Receipts) != 2 {
		t.Fatal("historical retry reapplied reversed mute", err)
	}
	for _, own := range []struct{ username, id string }{{operator, caseID}, {member, appealID}} {
		view, err := repo.OwnReportStatus(own.username, own.id)
		if err != nil || view.Status != "open" {
			t.Fatal("chat action automatically resolved case", view, err)
		}
	}
	encoded, _ := json.Marshal(ChatPayload{Message: "chat restored without a relog"})
	b.handleMessage(Message{Type: MsgChat, Payload: encoded})
	assertChat(t, a, "world", "chat restored without a relog", "")
	assertChat(t, b, "world", "chat restored without a relog", "")
	if after, err := repo.GetUser(member); err != nil || !reflect.DeepEqual(before.Characters, after.Characters) {
		t.Fatal("moderation changed saved character", err)
	}
	activity, err := repo.ReadAdminActivity(database.AdminActivityQuery{})
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ = json.Marshal(activity)
	if len(activity.Entries) < 4 || strings.Contains(string(encoded), change.PrivateReason) || strings.Contains(string(encoded), reversal.PrivateReason) {
		t.Fatal("audit missing or leaked private evidence")
	}
	// A new repository connection must read the same durable account state.
	reopened, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close(context.Background())
	durable, err := reopened.ReadAccountChatModeration(preview.Target.AccountID)
	if err != nil || !reflect.DeepEqual(current, durable) {
		t.Fatal("account state was only process memory", err)
	}
}
