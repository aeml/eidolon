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

type adminCompletionActivityStore struct {
	*fakeAdminActivityStore
	afterRead, afterAppend func()
}

func (s *adminCompletionActivityStore) ReadAdminActivity(query database.AdminActivityQuery) (database.AdminActivityPage, error) {
	page, err := s.fakeAdminActivityStore.ReadAdminActivity(query)
	if s.afterRead != nil {
		s.afterRead()
	}
	return page, err
}

func (s *adminCompletionActivityStore) AppendAdminActivity(event database.AdminActivity) error {
	err := s.fakeAdminActivityStore.AppendAdminActivity(event)
	if s.afterAppend != nil {
		hook := s.afterAppend
		s.afterAppend = nil
		hook()
	}
	return err
}

func TestAdminReadCompletionRechecksRoleAndConnectionAfterIO(t *testing.T) {
	for _, kind := range []string{MsgAdminStatus, MsgAdminPlayers, MsgAdminHistory, MsgAdminReports, MsgAdminService} {
		for _, stage := range []string{"query-revocation", "audit-revocation", "audit-role-outage", "audit-replacement"} {
			if stage == "query-revocation" && kind != MsgAdminHistory {
				continue
			}
			t.Run(kind+"/"+stage, func(t *testing.T) {
				client, roles := adminReadFixture(t)
				previousReports := adminReports
				adminReports = &fakeAdminReports{}
				t.Cleanup(func() { adminReports = previousReports })
				world.AddEntity(&game.Entity{ID: "private-player", Name: "Private character", Type: game.TypePlayer})
				activeSessions["private-player-account"] = &Client{username: "private-player-account", playerID: "private-player"}
				store := &adminCompletionActivityStore{fakeAdminActivityStore: &fakeAdminActivityStore{}}
				adminActivities = store
				event, err := database.NewAdminActivity("private-operator", "private-target", MsgAdminHistory,
					"private-read-000001", "success", "Private staff information", time.Now().UTC(), 90)
				if err != nil {
					t.Fatal(err)
				}
				store.events = append(store.events, event)
				hook := func() {
					switch stage {
					case "audit-role-outage":
						roles.lookupErr = errors.New("private authority failure")
					case "audit-replacement":
						sessionsMu.Lock()
						activeSessions[client.username] = &Client{username: client.username}
						sessionsMu.Unlock()
					default:
						delete(roles.roles, client.username)
					}
				}
				if stage == "query-revocation" {
					store.afterRead = hook
				} else {
					store.afterAppend = hook
				}
				result := adminRead(t, client, kind, "")
				if result.Success || result.Authorized || result.ModerationEnabled || result.History != nil || result.Reports != nil || result.Service != nil || len(result.Players) != 0 || len(result.Items) != 0 || result.Account != "" || result.Next != "" {
					t.Fatal("late read exposed privileged data after ownership/role change", result)
				}
				if result.ID != "read-request-000001" || strings.Contains(result.Message, "private authority") {
					t.Fatal("late denial lost correlation or leaked diagnostics", result)
				}
				last := store.events[len(store.events)-1]
				if last.Actor != client.username || last.RequestID != result.ID || last.Result == "success" {
					t.Fatal("late delivery denial lost its authenticated audit", last)
				}
			})
		}
	}
}

func TestAdminReadCompletionDenialReopensAndReplaysExactAudit(t *testing.T) {
	client, roles := adminReadFixture(t)
	dir, base := sessionActivityFixture(t)
	store := &adminCompletionActivityStore{fakeAdminActivityStore: base}
	adminActivities = store
	store.afterAppend = func() {
		delete(roles.roles, client.username)
		base.appendErr = errors.New("private database outage")
	}
	result := adminRead(t, client, MsgAdminStatus, "")
	if result.Success || result.Authorized || result.Account != "" || len(result.Items) != 0 {
		t.Fatal("failed late audit authorized a privileged response", result)
	}
	pending, err := adminActivityJournal.Pending(50)
	if err != nil || len(pending) != 1 {
		t.Fatal("late denial not retained", pending, err)
	}
	denial := pending[0]
	if denial.Actor != client.username || denial.RequestID != result.ID || denial.Result != "denied" || denial.Action != MsgAdminStatus {
		t.Fatal("wrong retained denial", denial)
	}
	encoded, _ := json.Marshal(denial)
	if strings.Contains(string(encoded), "private database") || strings.Contains(string(encoded), "items") {
		t.Fatal("audit leaked private payload or diagnostic", string(encoded))
	}
	adminActivityJournal, err = database.OpenAdminActivityJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	base.appendErr = nil
	for attempt := 0; attempt < 2; attempt++ {
		if err := retryPendingAdminActivity(); err != nil {
			t.Fatal(err)
		}
	}
	remaining, err := adminActivityJournal.Pending(50)
	if err != nil || len(remaining) != 0 || len(base.events) != 2 {
		t.Fatal("recovery lost or duplicated the late denial", remaining, base.events, err)
	}
	replayed := base.events[1]
	if replayed.ID != denial.ID || replayed.RequestID != denial.RequestID || replayed.Actor != denial.Actor || replayed.Result != denial.Result || !replayed.At.Equal(denial.At) || replayed.Summary != denial.Summary {
		t.Fatal("recovery rewrote the retained event", denial, replayed)
	}
}
