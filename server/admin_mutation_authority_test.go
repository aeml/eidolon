package main

import (
	"errors"
	"strings"
	"testing"

	"eidolon-server/internal/database"
)

type adminAuthorityOperationStore struct {
	*schedulerOperationStore
	afterLookup func()
}

func (s *adminAuthorityOperationStore) GetAdminOperation(id string) (*database.AdminOperation, error) {
	op, err := s.schedulerOperationStore.GetAdminOperation(id)
	if s.afterLookup != nil {
		hook := s.afterLookup
		s.afterLookup = nil
		hook()
	}
	return op, err
}

func changeAdminAuthorityForTest(client *Client, roles *fakeAdminRoleStore, stage string) {
	switch stage {
	case "role-outage":
		roles.lookupErr = errors.New("private authority outage")
	case "replacement":
		sessionsMu.Lock()
		activeSessions[client.username] = &Client{username: client.username}
		sessionsMu.Unlock()
	default:
		delete(roles.roles, client.username)
	}
}

func TestAdminMutationRevalidatesBeforeNewDurableIntent(t *testing.T) {
	for _, stage := range []string{"revocation", "role-outage", "replacement"} {
		t.Run(stage, func(t *testing.T) {
			client, roles, base, committer, player := adminMutationFixture(t)
			adminOperations = &adminAuthorityOperationStore{schedulerOperationStore: base, afterLookup: func() {
				changeAdminAuthorityForTest(client, roles, stage)
			}}
			result := adminMutationReply(t, client, MsgAdminGrantGold, adminGoldRequestFixture)
			if result.Success || result.Authorized || result.Final || result.ID != "request-123456789" || strings.Contains(result.Message, "private authority") {
				t.Fatal("stale authority admitted new intent", result)
			}
			if player.Gold != 100 || len(base.ops) != 0 || len(committer.ids) != 0 || base.finishes != 0 {
				t.Fatal("denied new intent changed character or operation store", player.Gold, base.ops, committer.ids)
			}
			events := adminActivities.(*fakeAdminActivityStore).events
			if len(events) != 1 || events[0].Actor != client.username || events[0].RequestID != result.ID || events[0].Result == "success" {
				t.Fatal("late rejection lost audit", events)
			}
		})
	}
}

func TestAdminReportReviewRevalidatesAfterAuditBeforeChangingCase(t *testing.T) {
	for _, stage := range []string{"revocation", "role-outage", "replacement"} {
		t.Run(stage, func(t *testing.T) {
			client, roles := adminReadFixture(t)
			reviews := reportReviewStoreFixture(t)
			activities := &adminCompletionActivityStore{fakeAdminActivityStore: &fakeAdminActivityStore{}, afterAppend: func() {
				changeAdminAuthorityForTest(client, roles, stage)
			}}
			adminActivities = activities
			result := reviewReport(t, client, validReportReviewPayload)
			if result.Success || result.Authorized || result.Final || reviews.calls != 0 || result.ID != "review-request-000001" || strings.Contains(result.Message, "private authority") {
				t.Fatal("stale authority changed report", result, reviews.calls)
			}
			if len(activities.events) != 2 || activities.events[1].Actor != client.username || activities.events[1].RequestID != result.ID || activities.events[1].Result == "success" {
				t.Fatal("late report rejection lost audit", activities.events)
			}
		})
	}
}

func TestAdminMutationDurableApprovedIntentStillRecoversAfterRevocation(t *testing.T) {
	client, roles, operations, committer, player := adminMutationFixture(t)
	committer.fail = errors.New("modeled character save outage")
	result := adminMutationReply(t, client, MsgAdminGrantGold, adminGoldRequestFixture)
	if result.Success || !result.Pending || len(operations.ops) != 1 || player.Gold != 200 {
		t.Fatal("fixture did not retain an approved pending grant", result, operations.ops, player.Gold)
	}
	delete(roles.roles, client.username)
	committer.fail = nil
	for attempt := 0; attempt < 2; attempt++ {
		if err := recoverPendingAdminOperations(); err != nil {
			t.Fatal(err)
		}
	}
	if player.Gold != 200 || operations.finishes != 1 {
		t.Fatal("revocation discarded or duplicated approved recovery", player.Gold, operations.finishes)
	}
	for _, op := range operations.ops {
		if op.State != database.AdminOperationComplete || op.Audit.Result != "success" {
			t.Fatal("approved intent did not reach its original audited outcome", op)
		}
	}
	result = adminMutationReply(t, client, MsgAdminGrantGold, adminGoldRequestFixture)
	if result.Success || result.Authorized || player.Gold != 200 || operations.finishes != 1 {
		t.Fatal("revoked actor replay exposed success or repeated recovery", result, player.Gold, operations.finishes)
	}
}
