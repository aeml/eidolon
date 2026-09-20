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

func TestAdministratorVIPMonthlyAllowanceAndRoleRevocation(t *testing.T) {
	c, committer, _ := vipMembershipFixture(t)
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return nil, nil }
	roles := &fakeAdminRoleStore{roles: map[string]bool{c.username: true}}
	setAdminRoleTestState(t, roles, "bootstrap-only")
	now := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	before := world.GetEntityCopy(c.playerID)
	for _, want := range []int{100, 0} {
		amount, err := refreshVIPMembershipLocked(c, now)
		if err != nil || amount != want {
			t.Fatal("admin monthly refresh", amount, err)
		}
	}
	p := world.GetEntityCopy(c.playerID)
	if p.EP != 100 || committer.saved.EP != 100 || !p.VIPUntil.Equal(time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)) ||
		p.Gold != before.Gold || p.Stats != before.Stats || p.Experience != before.Experience {
		t.Fatal("admin VIP not saved or changed gameplay power")
	}
	delete(roles.roles, c.username)
	adminBootstrapUsernames[c.username] = struct{}{} // Bootstrap name alone is not authority.
	if amount, err := refreshVIPMembershipLocked(c, now); err != nil || amount != 0 || !world.GetEntityCopy(c.playerID).VIPUntil.IsZero() {
		t.Fatal("revoked admin kept VIP access", err)
	}
	roles.roles[c.username] = true
	if amount, err := refreshVIPMembershipLocked(c, now); err != nil || amount != 0 {
		t.Fatal("role toggle duplicated allowance", err)
	}
	if amount, err := refreshVIPMembershipLocked(c, now.AddDate(0, 1, 0)); err != nil || amount != 100 || committer.saved.EP != 200 {
		t.Fatal("next admin month not saved exactly once", amount, err)
	}
	roles.lookupErr = errors.New("role repository unavailable")
	if _, err := refreshVIPMembershipLocked(c, now.AddDate(0, 1, 0)); err == nil || !world.GetEntityCopy(c.playerID).VIPUntil.IsZero() {
		t.Fatal("unverified admin retained access")
	}
}

func TestAdministratorVIPDoesNotDoubleExistingMembershipAllowance(t *testing.T) {
	c, _, periods := vipMembershipFixture(t)
	setAdminRoleTestState(t, &fakeAdminRoleStore{roles: map[string]bool{c.username: true}}, "")
	if amount, err := refreshVIPMembershipLocked(c, periods[0].StartsAt.Add(time.Hour)); err != nil || amount != 100 || world.GetEntityCopy(c.playerID).EP != 100 {
		t.Fatal("admin and membership allowances stacked", amount, err)
	}
}

func TestAdministratorVIPReceiptOnlyChangeIsDurable(t *testing.T) {
	c, committer, periods := vipMembershipFixture(t)
	setAdminRoleTestState(t, &fakeAdminRoleStore{roles: map[string]bool{}}, "")
	now := periods[0].StartsAt.Add(time.Hour)
	if amount, err := refreshVIPMembershipLocked(c, now); err != nil || amount != 100 {
		t.Fatal("normal membership grant", amount, err)
	}
	setAdminRoleTestState(t, &fakeAdminRoleStore{roles: map[string]bool{c.username: true}}, "")
	writes := len(committer.ids)
	if amount, err := refreshVIPMembershipLocked(c, now); err != nil || amount != 0 || len(committer.ids) <= writes || committer.saved.VIPAllowanceReceipts["vip-admin-"+now.UTC().Format("2006-01")] != 100 {
		t.Fatal("admin entitlement receipt was not saved", amount, err)
	}
	writes = len(committer.ids)
	if amount, err := refreshVIPMembershipLocked(c, now); err != nil || amount != 0 || len(committer.ids) != writes {
		t.Fatal("unchanged admin refresh wrote again", amount, err)
	}
}

func TestAdministratorVIPPendingGrantMustRecoverBeforeAccess(t *testing.T) {
	c, committer, _ := vipMembershipFixture(t)
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return nil, nil }
	setAdminRoleTestState(t, &fakeAdminRoleStore{roles: map[string]bool{c.username: true}}, "")
	characterSaveCommitter = &epFailAfterPreflight{delegate: committer}
	now := time.Now()
	if amount, err := refreshVIPMembershipLocked(c, now); err == nil || amount != 0 || !world.GetEntityCopy(c.playerID).VIPUntil.IsZero() {
		t.Fatal("pending admin grant acknowledged or access enabled", amount, err)
	}
	characterSaveCommitter = committer
	if amount, err := refreshVIPMembershipLocked(c, now); err != nil || amount != 0 || committer.saved.EP != 100 || !world.GetEntityCopy(c.playerID).VIPUntil.After(now) {
		t.Fatal("admin grant did not recover exactly once", amount, err)
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
