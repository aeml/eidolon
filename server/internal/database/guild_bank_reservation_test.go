package database

import (
	"context"
	"errors"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func reservationGuildFixture(t *testing.T) (*DB, GuildBankOperation, string, string) {
	t.Helper()
	db, op := savedGuildBankFixture(t, GuildBankDepositGold, nil)
	officer, guest := uniqueID("bank-officer"), uniqueID("bank-guest")
	if err := db.InviteToGuild(op.GuildID, op.PlayerID, officer); err != nil {
		t.Fatal(err)
	}
	if _, err := db.RespondGuildInvite(officer, op.GuildID, "Officer", true); err != nil {
		t.Fatal(err)
	}
	if _, err := db.SetGuildMemberRank(op.PlayerID, officer, GuildRankOfficer); err != nil {
		t.Fatal(err)
	}
	if err := db.InviteToGuild(op.GuildID, op.PlayerID, guest); err != nil {
		t.Fatal(err)
	}
	if _, err := db.guilds.UpdateOne(t.Context(), bson.M{"id": op.GuildID}, bson.M{"$set": bson.M{
		"bank.gold": 5000, "bank.items": []Item{{ID: "saved-bank-item", Name: "Saved Blade", Stack: 1}},
		"members.0.last_online": time.Now().UTC().Add(-40 * 24 * time.Hour),
	}}); err != nil {
		t.Fatal(err)
	}
	guild, err := db.GetGuildByID(op.GuildID)
	if err != nil {
		t.Fatal(err)
	}
	op.GuildVersion = guild.Version
	op.Fingerprint = GuildBankOperationFingerprint(op)
	prepareBankFixture(t, db, op)
	return db, op, officer, guest
}

func TestGuildBankReservationFencesEveryGuildMutation(t *testing.T) {
	mutations := map[string]func(*DB, GuildBankOperation, string, string) error{
		"gold-deposit": func(db *DB, op GuildBankOperation, _, _ string) error {
			_, err := db.DepositGuildGold(op.GuildID, op.PlayerID, 20)
			return err
		},
		"gold-withdraw": func(db *DB, op GuildBankOperation, _, _ string) error {
			_, err := db.WithdrawGuildGold(op.GuildID, op.PlayerID, 20)
			return err
		},
		"item-deposit": func(db *DB, op GuildBankOperation, _, _ string) error {
			_, err := db.DepositGuildItem(op.GuildID, op.PlayerID, Item{ID: "other-item", Stack: 1})
			return err
		},
		"item-withdraw": func(db *DB, op GuildBankOperation, _, _ string) error {
			_, _, err := db.WithdrawGuildItem(op.GuildID, op.PlayerID, "saved-bank-item")
			return err
		},
		"leave": func(db *DB, op GuildBankOperation, _, _ string) error {
			_, _, err := db.LeaveGuild(op.PlayerID)
			return err
		},
		"kick": func(db *DB, op GuildBankOperation, officer, _ string) error {
			_, err := db.KickGuildMember(op.PlayerID, officer)
			return err
		},
		"rank": func(db *DB, op GuildBankOperation, officer, _ string) error {
			_, err := db.SetGuildMemberRank(op.PlayerID, officer, GuildRankMember)
			return err
		},
		"leadership": func(db *DB, op GuildBankOperation, officer, _ string) error {
			_, err := db.TransferGuildLeadership(op.PlayerID, officer)
			return err
		},
		"message": func(db *DB, op GuildBankOperation, _, _ string) error {
			_, err := db.SetGuildMOTD(op.PlayerID, "Changed during settlement")
			return err
		},
		"disband": func(db *DB, op GuildBankOperation, _, _ string) error {
			_, err := db.DisbandGuild(op.PlayerID)
			return err
		},
		"succession": func(db *DB, _ GuildBankOperation, officer, _ string) error {
			_, err := db.ClaimInactiveGuildLeadership(officer, time.Now().UTC())
			return err
		},
		"invite-accept": func(db *DB, op GuildBankOperation, _, guest string) error {
			_, err := db.RespondGuildInvite(guest, op.GuildID, "Guest", true)
			return err
		},
		"calendar": func(db *DB, op GuildBankOperation, _, _ string) error {
			_, err := db.ChangeGuildEvent(op.PlayerID, GuildEventRequest{Action: "create", Title: "Recovery party",
				Activity: "dungeon", StartsAt: time.Now().UTC().Add(time.Hour), DurationMinutes: 60, Capacity: 5}, time.Now().UTC())
			return err
		},
	}
	for name, mutation := range mutations {
		t.Run(name, func(t *testing.T) {
			db, op, officer, guest := reservationGuildFixture(t)
			// Seed the saved hold to exercise existing writers independently of
			// reservation acquisition. This must survive every rejected mutation.
			if _, err := db.guilds.UpdateOne(t.Context(), bson.M{"id": op.GuildID}, bson.M{"$set": bson.M{
				"pending_bank_operation_id": op.ID, "pending_bank_operation_fingerprint": op.Fingerprint,
			}}); err != nil {
				t.Fatal(err)
			}
			before, err := db.GetGuildByID(op.GuildID)
			if err != nil {
				t.Fatal(err)
			}
			if err := mutation(db, op, officer, guest); !errors.Is(err, ErrGuildBankOperationBusy) {
				t.Fatalf("reserved guild mutation was not fenced: %v", err)
			}
			after, err := db.GetGuildByID(op.GuildID)
			if err != nil || !reflect.DeepEqual(before, after) {
				t.Fatal("rejected mutation changed the reserved guild", err)
			}
		})
	}
}

func TestGuildBankReservationReopenAndTerminalReleaseDoNotLoseTheHold(t *testing.T) {
	db, op, _, _ := reservationGuildFixture(t)
	before, err := db.GetGuildByID(op.GuildID)
	if err != nil {
		t.Fatal(err)
	}
	var group sync.WaitGroup
	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			if _, err := db.ReserveGuildBankOperation(op.ID, op.Fingerprint); err != nil {
				t.Error(err)
			}
		}()
	}
	group.Wait()
	held, err := db.GetGuildByID(op.GuildID)
	if err != nil || held.PendingBankOperationID != op.ID || held.PendingBankFingerprint != op.Fingerprint ||
		held.Version != before.Version || !reflect.DeepEqual(held.Bank, before.Bank) || !reflect.DeepEqual(held.Audit, before.Audit) {
		t.Fatal("reservation changed Gold, items, audit or the frozen effect version", err)
	}
	if err := db.ReleaseGuildBankOperation(op.ID, op.Fingerprint); !errors.Is(err, ErrGuildBankOperationBusy) {
		t.Fatal("a pending transfer could release its hold", err)
	}
	if _, err := db.ReserveGuildBankOperation(op.ID, "changed-fingerprint"); !errors.Is(err, ErrGuildBankOperationConflict) {
		t.Fatal("changed reservation payload was accepted", err)
	}
	reopened, err := New(os.Getenv("MONGO_URI"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = reopened.Close(context.Background()) })
	if _, err := reopened.ReserveGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal("reopened repository could not recover the exact hold", err)
	}
	if _, err := reopened.ApplyGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	// Test setup closes the storage record; no claim of character settlement.
	if _, err := reopened.FinishGuildBankOperation(op.ID, op.Fingerprint, GuildBankComplete); err != nil {
		t.Fatal(err)
	}
	ids, err := reopened.ReservedGuildBankOperationIDs(50)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, id := range ids {
		found = found || id == op.ID
	}
	if !found {
		t.Fatal("stop after completion but before release made the hold unrecoverable")
	}
	if err := reopened.ReleaseGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	cleared, err := reopened.GetGuildByID(op.GuildID)
	if err != nil || cleared.PendingBankOperationID != "" || cleared.PendingBankFingerprint != "" ||
		cleared.Bank.Gold != before.Bank.Gold+op.Gold || cleared.Version != op.GuildVersion+2 {
		t.Fatal("terminal release changed the effect or retained the hold", err)
	}
	if err := reopened.ReleaseGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	replayed, _ := reopened.GetGuildByID(op.GuildID)
	if !reflect.DeepEqual(cleared, replayed) {
		t.Fatal("release retry advanced the revision or changed the guild again")
	}
	next := op
	next.RequestID, next.GuildVersion = "request_1234567891", cleared.Version
	next.ID = GuildBankOperationID(next.Username, next.RequestID)
	next.Fingerprint = GuildBankOperationFingerprint(next)
	prepareBankFixture(t, reopened, next)
	if _, err := reopened.ReserveGuildBankOperation(next.ID, next.Fingerprint); err != nil {
		t.Fatal(err)
	}
	if err := reopened.ReleaseGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	newHold, _ := reopened.GetGuildByID(op.GuildID)
	if newHold.PendingBankOperationID != next.ID || newHold.Version != next.GuildVersion {
		t.Fatal("old terminal replay cleared another operation's hold")
	}
}

func TestGuildBankReservationAndGovernanceRaceHaveExactlyOneWinner(t *testing.T) {
	db, op, _, _ := reservationGuildFixture(t)
	other, err := New(os.Getenv("MONGO_URI"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = other.Close(context.Background()) })
	start := make(chan struct{})
	reserved, changed := make(chan error, 1), make(chan error, 1)
	go func() {
		<-start
		_, err := db.ReserveGuildBankOperation(op.ID, op.Fingerprint)
		reserved <- err
	}()
	go func() {
		<-start
		_, err := other.SetGuildMOTD(op.PlayerID, "One authoritative winner")
		changed <- err
	}()
	close(start)
	reserveErr, changeErr := <-reserved, <-changed
	if (reserveErr == nil) == (changeErr == nil) {
		t.Fatalf("reservation and governance must not both commit or both fail: %v/%v", reserveErr, changeErr)
	}
	if reserveErr != nil && !errors.Is(reserveErr, ErrGuildBankOperationStale) {
		t.Fatal("unexpected reservation rejection", reserveErr)
	}
	if changeErr != nil && !errors.Is(changeErr, ErrGuildBankOperationBusy) {
		t.Fatal("unexpected governance rejection", changeErr)
	}
	guild, err := db.GetGuildByID(op.GuildID)
	if err != nil || guild.Bank.Gold != 5000 {
		t.Fatal("reservation race moved Gold", err)
	}
}

func TestGuildBankReservationPreservesPresenceAndFencesPreHoldSnapshots(t *testing.T) {
	db, op, _, _ := reservationGuildFixture(t)
	stale, err := db.GetGuildByID(op.GuildID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ReserveGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	at := time.Now().UTC().Truncate(time.Millisecond)
	if err := db.TouchGuildMember(op.PlayerID, at); err != nil {
		t.Fatal(err)
	}
	held, err := db.GetGuildByID(op.GuildID)
	if err != nil || held.Version != op.GuildVersion || !guildMember(held, op.PlayerID).LastOnline.Equal(at) {
		t.Fatal("held presence invalidated the transfer version or was lost", err)
	}
	if _, err := db.FinishGuildBankOperation(op.ID, op.Fingerprint, GuildBankRejected); err != nil {
		t.Fatal(err)
	}
	if err := db.ReleaseGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	stale.Version++
	stale.MOTD = "Stale pre-hold snapshot"
	if err := db.saveUnreservedGuild(t.Context(), stale, op.GuildVersion); err == nil {
		t.Fatal("a pre-hold replacement overwrote newer presence after rejection")
	}
	if _, err := db.SetGuildMOTD(op.PlayerID, "Recovered guild is usable"); err != nil {
		t.Fatal("terminal rejection did not unlock the guild", err)
	}
	latest, err := db.GetGuildByID(op.GuildID)
	if err != nil || !guildMember(latest, op.PlayerID).LastOnline.Equal(at) || latest.Bank.Gold != 5000 {
		t.Fatal("rejected transfer or later governance lost presence/value", err)
	}
	// Outside a reservation, presence itself advances the CAS version.
	stale = latest
	previousVersion := latest.Version
	if err := db.TouchGuildMember(op.PlayerID, at.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	stale.Version++
	if err := db.saveUnreservedGuild(t.Context(), stale, previousVersion); err == nil {
		t.Fatal("ordinary presence was overwritten by a stale full-guild writer")
	}
}

func TestGuildBankReservationPreventsLastMemberLeaveFromDeletingTheGuild(t *testing.T) {
	db, op := savedGuildBankFixture(t, GuildBankDepositGold, nil)
	prepareBankFixture(t, db, op)
	if _, err := db.ReserveGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	if _, disbanded, err := db.LeaveGuild(op.PlayerID); disbanded || !errors.Is(err, ErrGuildBankOperationBusy) {
		t.Fatal("last-member leave deleted a guild with an unsettled transfer", err)
	}
	guild, err := db.GetGuildByID(op.GuildID)
	if err != nil || guild == nil || guild.PendingBankOperationID != op.ID {
		t.Fatal("last-member leave lost the saved reservation", err)
	}
}
