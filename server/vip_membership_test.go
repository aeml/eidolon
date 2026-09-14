package main

import (
	"eidolon-server/internal/database"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func vipMembershipFixture(t *testing.T) (*Client, *testCharacterCommitter, []database.VIPPeriod) {
	t.Helper()
	c, committer, _ := epWalletFixture(t)
	now := time.Now().UTC().Truncate(time.Second)
	period, err := database.NewVIPPeriod(now.Add(-24*time.Hour), now.Add(29*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	old := loadVIPPeriods
	t.Cleanup(func() { loadVIPPeriods = old })
	periods := []database.VIPPeriod{period}
	loadVIPPeriods = func(username string) ([]database.VIPPeriod, error) {
		if username != c.username {
			t.Fatal("read another account's membership")
		}
		return periods, nil
	}
	return c, committer, periods
}

func TestVIPMembershipSavesOnlyNewMonthlyAllowanceAndNeverGoldOrPower(t *testing.T) {
	c, committer, periods := vipMembershipFixture(t)
	before := world.GetEntityCopy(c.playerID)
	awarded, err := refreshVIPMembershipLocked(c, time.Now())
	if err != nil || awarded != 100 || committer.saved.EP != 100 || committer.saved.VIPAllowanceReceipts[periods[0].ID] != 100 {
		t.Fatal("allowance not saved with receipt", awarded, err)
	}
	p := world.GetEntityCopy(c.playerID)
	if !p.VIPUntil.Equal(periods[0].EndsAt) || p.Gold != before.Gold || p.Stats != before.Stats || p.Experience != before.Experience {
		t.Fatal("VIP changed Gold, power or eligibility")
	}
	writes := len(committer.ids)
	if awarded, err = refreshVIPMembershipLocked(c, time.Now()); err != nil || awarded != 0 || len(committer.ids) != writes {
		t.Fatal("refresh wrote/granted the same month again", err)
	}
	p.VIPAllowanceReceipts[periods[0].ID] = 1000
	if world.GetEntityCopy(c.playerID).VIPAllowanceReceipts[periods[0].ID] != 100 {
		t.Fatal("snapshot aliased receipt")
	}
}

func TestVIPMembershipPendingGrantMustRecoverBeforeAcknowledgement(t *testing.T) {
	c, committer, _ := vipMembershipFixture(t)
	characterSaveCommitter = &epFailAfterPreflight{delegate: committer}
	if amount, err := refreshVIPMembershipLocked(c, time.Now()); err == nil || amount != 0 {
		t.Fatal("pending grant acknowledged")
	}
	if p := world.GetEntityCopy(c.playerID); p.EP != 100 || !p.VIPUntil.IsZero() {
		t.Fatal("pending grant lost live receipt or left access enabled")
	}
	// The live receipt already exists, but the failed save must still be retried.
	if _, err := refreshVIPMembershipLocked(c, time.Now()); err == nil {
		t.Fatal("receipt bypassed pending durability")
	}
	characterSaveCommitter = committer
	if amount, err := refreshVIPMembershipLocked(c, time.Now()); err != nil || amount != 0 || committer.saved.EP != 100 {
		t.Fatal("pending grant recovery charged twice", amount, err)
	}
}

func TestVIPMembershipIgnoresClientPeriodsAndRevokesAccessOnRepositoryFailure(t *testing.T) {
	c, _, _ := vipMembershipFixture(t)
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return nil, nil }
	c.dispatchMessage(Message{Type: MsgGetVIPStatus, Payload: json.RawMessage(`{"active":true,"monthlyEP":999999,"periods":[{"id":"free"}]}`)})
	if p := world.GetEntityCopy(c.playerID); p.EP != 0 || !p.VIPUntil.IsZero() {
		t.Fatal("client created membership or EP")
	}
	world.Entities[c.playerID].VIPUntil = time.Now().Add(time.Hour)
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return nil, errors.New("repository unavailable") }
	if _, err := refreshVIPMembershipLocked(c, time.Now()); err == nil || !world.GetEntityCopy(c.playerID).VIPUntil.IsZero() {
		t.Fatal("membership source failure did not fail closed")
	}
	if _, known := inboundMessagePolicies["provision_vip"]; known {
		t.Fatal("administrative VIP write exposed to clients")
	}
}

func TestVIPAllowanceSurvivesJournalReopenWithoutAnotherGrant(t *testing.T) {
	c, committer, dir := epWalletFixture(t)
	now := time.Now().UTC().Truncate(time.Second)
	period, err := database.NewVIPPeriod(now.Add(-time.Hour), now.Add(30*24*time.Hour-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	oldReader := loadVIPPeriods
	t.Cleanup(func() { loadVIPPeriods = oldReader })
	periods := []database.VIPPeriod{period}
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return periods, nil }
	characterSaveCommitter = &epFailAfterPreflight{delegate: committer}
	if _, err := refreshVIPMembershipLocked(c, now); err == nil {
		t.Fatal("expected pending save")
	}
	world = nil
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	characterSaveCommitter = committer
	failedCharacterSaves.users = map[string]bool{}
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if committer.saved.EP != 100 || committer.saved.VIPAllowanceReceipts[period.ID] != 100 {
		t.Fatal("restart lost allowance or receipt")
	}
	amount, _, err := database.ApplyVIPAllowance(&committer.saved.EP, &committer.saved.VIPAllowanceReceipts, periods, now)
	if err != nil || amount != 0 || committer.saved.EP != 100 {
		t.Fatal("restart granted same month again", err)
	}
}
