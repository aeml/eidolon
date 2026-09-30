package database

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func savedGuildBankFixture(t *testing.T, action string, item *Item) (*DB, GuildBankOperation) {
	t.Helper()
	db := newBankOperationTestDB(t)
	op := bankOperationFixture(uniqueID("bank-apply"), "request_1234567890")
	tag := randomGuildTag(t)
	guild, err := db.CreateGuild("Guild "+tag, tag, op.PlayerID, op.CharacterName)
	if err != nil {
		t.Fatal(err)
	}
	op.GuildID, op.GuildVersion, op.Action = guild.ID, guild.Version, action
	if item != nil {
		payload, err := json.Marshal(item)
		if err != nil {
			t.Fatal(err)
		}
		op.Gold, op.ItemPayload = 0, string(payload)
	}
	op.Fingerprint = GuildBankOperationFingerprint(op)
	return db, op
}

func prepareBankFixture(t *testing.T, db *DB, op GuildBankOperation) {
	t.Helper()
	if _, err := db.PrepareGuildBankOperation(op); err != nil {
		t.Fatal(err)
	}
}

func TestGuildBankApplyGoldIsOnceAcrossConcurrentExecutorsAndRepositoryReopen(t *testing.T) {
	db, op := savedGuildBankFixture(t, GuildBankDepositGold, nil)
	prepareBankFixture(t, db, op)
	var group sync.WaitGroup
	failures := make(chan error, 20)
	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			_, err := db.ApplyGuildBankOperation(op.ID, op.Fingerprint)
			failures <- err
		}()
	}
	group.Wait()
	close(failures)
	for err := range failures {
		if err != nil {
			t.Fatal(err)
		}
	}
	guild, err := db.GetGuildByID(op.GuildID)
	if err != nil || guild == nil || guild.Bank.Gold != 500 || guild.Version != op.GuildVersion+1 ||
		guild.LastBankOperationID != op.ID || guild.LastBankOperationFingerprint != op.Fingerprint {
		t.Fatalf("guild effect was missing or repeated: %+v / %v", guild, err)
	}
	count := 0
	for _, entry := range guild.Audit {
		if entry.OperationID == op.ID {
			count++
			if entry.Amount != 500 || entry.ActorID != op.PlayerID || entry.Action != op.Action {
				t.Fatalf("audit does not describe the exact effect: %+v", entry)
			}
		}
	}
	if count != 1 {
		t.Fatalf("audit receipt count = %d", count)
	}
	reopened, err := New(os.Getenv("MONGO_URI"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = reopened.Close(context.Background()) })
	replayed, err := reopened.ApplyGuildBankOperation(op.ID, op.Fingerprint)
	if err != nil || !reflect.DeepEqual(guild, replayed) {
		t.Fatalf("reopen replay changed durable guild effect: %+v / %v", replayed, err)
	}
	// Guild-side receipt is NOT proof of character-side settlement.
	stored, err := reopened.GetGuildBankOperation(op.ID)
	if err != nil || stored.State != GuildBankPending {
		t.Fatalf("guild-only effect incorrectly completed the transfer: %+v / %v", stored, err)
	}
}

func TestGuildBankApplyWithdrawalSupportsLegacyMissingVersionOnce(t *testing.T) {
	db, op := savedGuildBankFixture(t, GuildBankWithdrawGold, nil)
	if _, err := db.guilds.UpdateOne(t.Context(), bson.M{"id": op.GuildID}, bson.M{
		"$unset": bson.M{"version": ""}, "$set": bson.M{"bank.gold": 5000},
	}); err != nil {
		t.Fatal(err)
	}
	op.GuildVersion = 0
	op.Fingerprint = GuildBankOperationFingerprint(op)
	prepareBankFixture(t, db, op)
	for i := 0; i < 2; i++ {
		guild, err := db.ApplyGuildBankOperation(op.ID, op.Fingerprint)
		if err != nil || guild.Bank.Gold != 4500 || guild.Version != 1 ||
			guild.Audit[len(guild.Audit)-1].Amount != -500 {
			t.Fatalf("legacy withdrawal failed or repeated: %+v / %v", guild, err)
		}
	}
}

func TestGuildBankApplyItemRoundTripRetainsFullPayloadAndNoDuplicates(t *testing.T) {
	item := Item{ID: "earned-fixture-blade", Name: "Rare Guild Blade", Stack: 1, MaxStack: 1,
		Rarity: "Rare", Potency: 6, Stats: map[string]int{"strength": 17, "damage": 38},
		Sockets: 1, Gems: []SocketedGem{{Type: "Ruby", Quality: "Fine", Stats: map[string]int{"damage": 4}}}}
	db, deposit := savedGuildBankFixture(t, GuildBankDepositItem, &item)
	prepareBankFixture(t, db, deposit)
	guild, err := db.ApplyGuildBankOperation(deposit.ID, deposit.Fingerprint)
	if err != nil || len(guild.Bank.Items) != 1 || !reflect.DeepEqual(guild.Bank.Items[0], item) {
		t.Fatalf("deposit lost item data: %+v / %v", guild, err)
	}
	if _, err := db.ApplyGuildBankOperation(deposit.ID, deposit.Fingerprint); err != nil {
		t.Fatal(err)
	}
	// State transition here is test setup for the next guild-side operation,
	// not a claim that an actual character has received/debited the item.
	if _, err := db.FinishGuildBankOperation(deposit.ID, deposit.Fingerprint, GuildBankComplete); err != nil {
		t.Fatal(err)
	}
	withdraw := deposit
	withdraw.RequestID, withdraw.Action, withdraw.GuildVersion = "request_1234567891", GuildBankWithdrawItem, guild.Version
	withdraw.ID = GuildBankOperationID(withdraw.Username, withdraw.RequestID)
	withdraw.Fingerprint = GuildBankOperationFingerprint(withdraw)
	prepareBankFixture(t, db, withdraw)
	for i := 0; i < 2; i++ {
		guild, err = db.ApplyGuildBankOperation(withdraw.ID, withdraw.Fingerprint)
		if err != nil || len(guild.Bank.Items) != 0 || guild.Version != withdraw.GuildVersion+1 {
			t.Fatalf("withdrawal replay changed the bank twice: %+v / %v", guild, err)
		}
	}
	// A terminal old deposit cannot reappear after a newer receipt replaces it.
	guild, err = db.ApplyGuildBankOperation(deposit.ID, deposit.Fingerprint)
	if err != nil || len(guild.Bank.Items) != 0 || guild.LastBankOperationID != withdraw.ID {
		t.Fatalf("delayed old deposit replayed: %+v / %v", guild, err)
	}
}

func TestGuildBankApplyRejectsChangedPermissionsVersionAndItemWithoutEffects(t *testing.T) {
	for _, scenario := range []string{"version", "member-withdraw", "missing-member", "changed-item", "overflow", "insufficient-gold"} {
		t.Run(scenario, func(t *testing.T) {
			action := GuildBankDepositGold
			var item *Item
			if scenario == "member-withdraw" || scenario == "insufficient-gold" {
				action = GuildBankWithdrawGold
			}
			if scenario == "changed-item" {
				action, item = GuildBankWithdrawItem, &Item{ID: "bank-blade", Stack: 1, Potency: 2}
			}
			db, op := savedGuildBankFixture(t, action, item)
			updates := bson.M{}
			switch scenario {
			case "version":
				updates["version"] = op.GuildVersion + 1
			case "member-withdraw":
				updates["members.0.rank"] = GuildRankMember
				updates["bank.gold"] = 1000
			case "missing-member":
				updates["members"] = []GuildMember{}
			case "changed-item":
				changed := *item
				changed.Potency++
				updates["bank.items"] = []Item{changed}
			case "overflow":
				updates["bank.gold"] = math.MaxInt - 100
			case "insufficient-gold":
				updates["bank.gold"] = 100
			}
			if _, err := db.guilds.UpdateOne(t.Context(), bson.M{"id": op.GuildID}, bson.M{"$set": updates}); err != nil {
				t.Fatal(err)
			}
			before, _ := db.GetGuildByID(op.GuildID)
			prepareBankFixture(t, db, op)
			if _, err := db.ApplyGuildBankOperation(op.ID, op.Fingerprint); err == nil {
				t.Fatal("invalid guild effect accepted")
			}
			after, _ := db.GetGuildByID(op.GuildID)
			if !reflect.DeepEqual(before, after) {
				t.Fatalf("failed effect changed saved guild: before=%+v after=%+v", before, after)
			}
		})
	}
}

func TestGuildBankApplyPreservesPresenceAndBoundedAudit(t *testing.T) {
	db, op := savedGuildBankFixture(t, GuildBankDepositGold, nil)
	audit := make([]GuildAuditEntry, GuildAuditLimit)
	if _, err := db.guilds.UpdateOne(t.Context(), bson.M{"id": op.GuildID}, bson.M{"$set": bson.M{"audit": audit}}); err != nil {
		t.Fatal(err)
	}
	prepareBankFixture(t, db, op)
	at := time.Now().UTC().Truncate(time.Millisecond)
	var group sync.WaitGroup
	group.Add(1)
	go func() {
		defer group.Done()
		if err := db.TouchGuildMember(op.PlayerID, at); err != nil {
			t.Error(err)
		}
	}()
	if _, err := db.ApplyGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	group.Wait()
	guild, err := db.GetGuildByID(op.GuildID)
	if err != nil || guild == nil || !guildMember(guild, op.PlayerID).LastOnline.Equal(at) ||
		len(guild.Audit) != GuildAuditLimit || guild.Audit[len(guild.Audit)-1].OperationID != op.ID {
		t.Fatalf("targeted transfer lost presence or unbounded audit: %+v / %v", guild, err)
	}
}

func TestGuildBankApplyDoesNotTrustUnsavedPlansOrRejectedRequests(t *testing.T) {
	db, op := savedGuildBankFixture(t, GuildBankDepositGold, nil)
	if _, err := db.ApplyGuildBankOperation(op.ID, op.Fingerprint); !errors.Is(err, ErrGuildBankOperationConflict) {
		t.Fatalf("unsaved intent applied: %v", err)
	}
	prepareBankFixture(t, db, op)
	if _, err := db.ApplyGuildBankOperation(op.ID, "changed-fingerprint"); !errors.Is(err, ErrGuildBankOperationConflict) {
		t.Fatalf("changed intent applied: %v", err)
	}
	if _, err := db.FinishGuildBankOperation(op.ID, op.Fingerprint, GuildBankRejected); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ApplyGuildBankOperation(op.ID, op.Fingerprint); !errors.Is(err, ErrGuildBankOperationRejected) {
		t.Fatalf("rejected request applied: %v", err)
	}
	guild, _ := db.GetGuildByID(op.GuildID)
	if guild.Bank.Gold != 0 || guild.LastBankOperationID != "" {
		t.Fatal("unaccepted intent changed the bank")
	}
}
