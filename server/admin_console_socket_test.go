package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"github.com/gorilla/websocket"
)

// Actual production binary and disposable accounts. No production role or
// currency is modified, and fixture permissions never replace socket admission.
func TestAdminConsoleActualSessionsAndHistoryRestart(t *testing.T) {
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
	operator, member := fmt.Sprintf("operator-%d", time.Now().UnixNano()), fmt.Sprintf("member-%d", time.Now().UnixNano())
	appellant := fmt.Sprintf("appellant-%d", time.Now().UnixNano())
	for _, name := range []string{operator, member, appellant} {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-test-password"); err != nil {
			t.Fatal(err)
		}
	}
	if granted, err := repo.GrantAdminRole(operator, operator, "disposable_integration_fixture"); err != nil || !granted {
		t.Fatal(granted, err)
	}
	// Seed restrictions only on a disposable account before the server starts.
	// Staff socket enforcement remains a separate complete-milestone gate.
	conduct, err := repo.CreateReport(operator, "Player Report", "Synthetic name/conduct case for isolated acceptance.")
	if err != nil {
		t.Fatal(err)
	}
	subject, err := repo.ReadChatModerationTarget(operator, appellant)
	if err != nil {
		t.Fatal(err)
	}
	var requiredName database.ChatMuteNotice
	for i, kind := range []string{database.ChatModerationMute, database.ModerationSuspend, database.ModerationRequireNameChange} {
		request := database.ChatModerationRequest{ID: "socket-fixture-" + kind, ReportID: conduct.ID.Hex(), ExpectedRevision: int64(i), Action: kind,
			DurationSeconds: 600, PublicReason: "Public synthetic explanation.", PrivateReason: "Private synthetic evidence.", Confirmed: true}
		if kind == database.ModerationRequireNameChange {
			request.DurationSeconds = 0
		}
		receipt, err := repo.ApplyChatModeration(operator, subject.AccountID, request)
		if err != nil {
			t.Fatal(err)
		}
		if kind == database.ModerationRequireNameChange {
			requiredName = receipt.Notice
		}
	}
	correction := database.PublicNameCorrectionRequest{ID: "socket-name-correction-0001", NoticeID: requiredName.ID,
		PublicName: fmt.Sprintf("Arcanis %012d", time.Now().UnixNano()%1_000_000_000_000), Confirmed: true}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 201, "-save-journal-dir", journal)
	defer stop()
	// An ordinary account authenticates but never joins/creates a character.
	// Only its explicit appeal is accepted; other report categories remain
	// character-bound and do not sneak through relaxed socket admission.
	loginOnly, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer loginOnly.Close()
	resourceSend(t, loginOnly, MsgLogin, AuthPayload{Username: appellant, Password: appellant + "-test-password"})
	var authenticated struct {
		HasCharacter bool `json:"hasCharacter"`
	}
	resourceReadMessage(t, loginOnly, "login_success", &authenticated)
	if authenticated.HasCharacter {
		t.Fatal("account-support login created a character")
	}
	resourceSend(t, loginOnly, MsgModerationNotice, map[string]string{"requestId": "outside-notice-000001"})
	var ownNotices struct {
		Success bool                      `json:"success"`
		Notices []database.ChatMuteNotice `json:"notices"`
	}
	resourceReadMessage(t, loginOnly, MsgModerationNotice+"_result", &ownNotices)
	if !ownNotices.Success || len(ownNotices.Notices) != 3 {
		t.Fatal("private notice route required world entry", ownNotices)
	}
	for range 2 {
		resourceSend(t, loginOnly, MsgPublicNameCorrection, correction)
		var result adminMutationResult
		resourceReadMessage(t, loginOnly, MsgPublicNameCorrection+"_result", &result)
		if !result.Success || !result.Final || result.ID != correction.ID {
			t.Fatal("confirmed correction/retry failed", result)
		}
	}
	resourceSend(t, loginOnly, MsgModerationNotice, map[string]string{"requestId": "outside-notice-000002"})
	resourceReadMessage(t, loginOnly, MsgModerationNotice+"_result", &ownNotices)
	if !ownNotices.Success || len(ownNotices.Notices) != 2 {
		t.Fatal("correction cleared independent restrictions", ownNotices)
	}
	for _, notice := range ownNotices.Notices {
		if notice.Kind == database.ModerationRequireNameChange {
			t.Fatal("corrected requirement still active")
		}
	}
	var accountReport struct {
		Success   bool   `json:"success"`
		ReportID  string `json:"reportId"`
		RequestID string `json:"requestId"`
	}
	resourceSend(t, loginOnly, MsgReport, ReportPayload{ReportType: "Bug Report", Text: "Not allowed outside the world.", RequestID: "outside-report-000001"})
	resourceReadMessage(t, loginOnly, "report_result", &accountReport)
	if accountReport.Success || accountReport.RequestID != "outside-report-000001" {
		t.Fatal("non-appeal bypassed character requirement", accountReport)
	}
	resourceReadMessage(t, loginOnly, MsgError, nil)
	resourceSend(t, loginOnly, MsgReport, ReportPayload{ReportType: "Moderation Appeal", Text: "Please review this account notice.", RequestID: "outside-appeal-000001"})
	resourceReadMessage(t, loginOnly, "report_result", &accountReport)
	if !accountReport.Success || len(accountReport.ReportID) != 24 || accountReport.RequestID != "outside-appeal-000001" {
		t.Fatal("outside-world appeal not saved", accountReport)
	}
	loginOnly.Close()
	a, _ := resourceLoginCharacter(t, address, operator, operator+"-test-password", "Fighter")
	b, token := resourceLoginCharacter(t, address, member, member+"-test-password", "Wizard")
	request := func(conn *websocket.Conn, kind, requestID string) adminReadResult {
		t.Helper()
		resourceSend(t, conn, kind, map[string]string{"id": requestID})
		var response adminReadResult
		resourceReadMessage(t, conn, kind+"_result", &response)
		return response
	}
	if response := request(a, MsgAdminStatus, "admin-status-000001"); !response.Success || !response.Authorized {
		t.Fatal(response)
	}
	if response := request(b, MsgAdminStatus, "member-status-000001"); !response.Success || response.Authorized {
		t.Fatal(response)
	}
	if response := request(b, MsgAdminPlayers, "member-players-000001"); response.Success || response.Authorized || len(response.Players) != 0 {
		t.Fatal("member read admin roster")
	}
	response := request(a, MsgAdminPlayers, "admin-players-000001")
	found := map[string]bool{}
	for _, player := range response.Players {
		found[player.Account] = true
	}
	if !response.Success || !found[operator] || !found[member] {
		t.Fatal("missing authenticated players")
	}
	const reportText = "Private collision report <img src=x>"
	resourceSend(t, b, MsgReport, ReportPayload{ReportType: "Bug Report", Text: reportText, RequestID: "report-submit-000001"})
	var saved struct {
		Success  bool   `json:"success"`
		ReportID string `json:"reportId"`
	}
	resourceReadMessage(t, b, "report_result", &saved)
	if !saved.Success || saved.ReportID == "" {
		t.Fatal("report did not persist", saved)
	}
	if denied := request(b, MsgAdminReports, "member-reports-000001"); denied.Success || denied.Authorized || denied.Reports != nil {
		t.Fatal("ordinary player read private reports", denied)
	}
	reports := request(a, MsgAdminReports, "admin-reports-000001")
	foundReport := false
	if reports.Success && reports.Reports != nil {
		for _, report := range reports.Reports.Reports {
			if report.ID.Hex() == saved.ReportID && report.Username == member && report.Text == reportText && report.Status == database.ReportStatusOpen {
				foundReport = true
			}
		}
	}
	if !foundReport {
		t.Fatal("admin did not receive submitted report JSON", reports)
	}
	lookupStatus := func(conn *websocket.Conn, requestID string) *database.ReportStatusView {
		t.Helper()
		resourceSend(t, conn, MsgReportStatus, map[string]string{"requestId": requestID, "reportId": saved.ReportID})
		var result struct {
			Success bool                       `json:"success"`
			Report  *database.ReportStatusView `json:"report"`
		}
		resourceReadMessage(t, conn, MsgReportStatus+"_result", &result)
		if !result.Success {
			return nil
		}
		return result.Report
	}
	if view := lookupStatus(b, "report-status-000001"); view == nil || view.Status != "open" {
		t.Fatal("report owner could not check saved case", view)
	}
	if view := lookupStatus(a, "report-status-000002"); view != nil {
		t.Fatal("owner lookup exposed another account's case")
	}
	reviewRequest := database.ReportReviewRequest{ID: "review-socket-000001", ReportID: saved.ReportID,
		ExpectedStatus: "open", Status: "resolved", Reason: "Private staff review reason", Confirmed: true}
	resourceSend(t, b, MsgAdminReportReview, reviewRequest)
	var reviewResult adminMutationResult
	resourceReadMessage(t, b, MsgAdminReportReview+"_result", &reviewResult)
	if reviewResult.Success || reviewResult.Authorized {
		t.Fatal("ordinary account resolved a case", reviewResult)
	}
	resourceSend(t, a, MsgAdminReportReview, reviewRequest)
	resourceReadMessage(t, a, MsgAdminReportReview+"_result", &reviewResult)
	if !reviewResult.Success || !reviewResult.Authorized || !reviewResult.Final {
		t.Fatal("confirmed staff resolution failed", reviewResult)
	}
	if view := lookupStatus(b, "report-status-000003"); view == nil || view.Status != "resolved" || view.ResolvedAt == nil {
		t.Fatal("owner did not see completed review", view)
	}
	// The same confirmed request is replayable without a second case revision.
	resourceSend(t, a, MsgAdminReportReview, reviewRequest)
	resourceReadMessage(t, a, MsgAdminReportReview+"_result", &reviewResult)
	if !reviewResult.Success {
		t.Fatal("exact retry failed", reviewResult)
	}
	resourceCloseAndWait(t, repo, b, member)
	resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Close()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
	resourceReadMessage(t, resumed, MsgResumeSession, nil)
	resourceReadMessage(t, resumed, MsgQuestUpdate, nil)
	resourceCloseAndWait(t, repo, resumed, member)
	history := request(a, MsgAdminHistory, "admin-history-000001")
	if !history.Success || history.History == nil {
		t.Fatal(history)
	}
	encoded, _ := json.Marshal(history)
	if strings.Contains(string(encoded), token) || strings.Contains(string(encoded), "-test-password") || strings.Contains(string(encoded), "password_hash") {
		t.Fatal("history leaked credentials")
	}
	if strings.Contains(string(encoded), "Private collision report") {
		t.Fatal("private report text copied into activity history")
	}
	if strings.Contains(string(encoded), "Private staff review reason") {
		t.Fatal("private staff note copied into history")
	}
	resourceCloseAndWait(t, repo, a, operator)
	stop()
	// Startup replays any last disconnect still queued when the server stopped.
	_, stopRestart := compatStartServer(t, binary, uri, 202, "-save-journal-dir", journal)
	defer stopRestart()
	cases, err := repo.ReadReportPage(database.ReportQuery{Status: "resolved"})
	if err != nil {
		t.Fatal(err)
	}
	durableReview := false
	for _, report := range cases.Reports {
		if report.ID.Hex() == saved.ReportID && report.ReviewRevision == 1 && len(report.ReviewReceipts) == 1 &&
			report.LastReview != nil && report.LastReview.Actor == operator && report.LastReview.Reason == reviewRequest.Reason {
			durableReview = true
		}
	}
	if !durableReview {
		t.Fatal("resolved case or single private receipt did not survive restart")
	}
	view, err := repo.OwnReportStatus(appellant, accountReport.ReportID)
	if err != nil || view.ReportType != "Moderation Appeal" || view.Status != database.ReportStatusOpen {
		t.Fatal("outside-world appeal did not survive restart", view, err)
	}
	appellantUser, err := repo.GetUser(appellant)
	if err != nil || len(appellantUser.Characters) != 0 || appellantUser.Username != appellant || appellantUser.PublicName != correction.PublicName {
		t.Fatal("account support created or changed a saved character", err)
	}
	state, err := repo.ReadAccountChatModeration(subject.AccountID)
	if err != nil || state.Revision != 4 || len(state.Receipts) != 4 || state.NameChange != nil || state.Mute == nil || state.Suspension == nil {
		t.Fatal("correction receipt or independent restrictions lost on restart", state, err)
	}
	page, err := repo.ReadAdminActivity(database.AdminActivityQuery{Actor: member})
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	seen := map[string]bool{}
	for _, event := range page.Entries {
		if seen[event.ID.Hex()] {
			t.Fatal("duplicate durable event")
		}
		seen[event.ID.Hex()] = true
		counts[event.Action]++
	}
	if counts["login"] != 1 || counts["resume"] != 1 || counts["disconnect"] != 2 || counts[MsgAdminStatus] != 1 || counts[MsgAdminPlayers] != 1 || counts[MsgAdminReports] != 1 {
		t.Fatal("wrong saved session history", counts)
	}
	t.Log("actual accounts: login-only public-name correction/retry preserving separate restrictions and saves, authenticated notices/appeal, report/admin JSON, denied resolution, owner-only status, confirmed resolution/replay/private receipt, login/resume/disconnect and restart-persisted correction/cases/history passed")
}
