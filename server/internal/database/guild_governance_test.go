package database

import (
	"context"
	"os"
	"reflect"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestGuildGovernanceFreshPermissionsSuccessionAuditAndRepositoryReopen(t *testing.T) {
	db := newFriendshipDB(t)
	leader, officer, member := uniqueID("governance-leader"), uniqueID("governance-officer"), uniqueID("governance-member")
	tag := randomGuildTag(t)
	guild, err := db.CreateGuild("Guild "+tag, tag, leader, "Leader")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.guilds.DeleteOne(t.Context(), bson.M{"id": guild.ID})
		_, _ = db.guildInvites.DeleteMany(t.Context(), bson.M{"guild_id": guild.ID})
	})
	for _, id := range []string{officer, member} {
		if err := db.InviteToGuild(guild.ID, leader, id); err != nil {
			t.Fatal(err)
		}
		if _, err := db.RespondGuildInvite(id, guild.ID, id, true); err != nil {
			t.Fatal(err)
		}
	}
	guild, err = db.SetGuildMemberRank(leader, officer, GuildRankOfficer)
	if err != nil {
		t.Fatal(err)
	}
	entry := guild.Audit[len(guild.Audit)-1]
	if entry.Action != "rank_changed" || entry.ActorID != leader || entry.TargetID != officer ||
		entry.PreviousRank != GuildRankMember || entry.Rank != GuildRankOfficer {
		t.Fatal("rank audit does not describe the actual ownership decision", entry)
	}
	if _, err := db.DepositGuildGold(guild.ID, leader, 250); err != nil {
		t.Fatal(err)
	}
	before, err := db.GetGuildByID(guild.ID)
	if err != nil {
		t.Fatal(err)
	}
	for name, attempt := range map[string]func() error{
		"member withdrawal":   func() error { _, err := db.WithdrawGuildGold(guild.ID, member, 1); return err },
		"member invitation":   func() error { return db.InviteToGuild(guild.ID, member, "outsider") },
		"member message":      func() error { _, err := db.SetGuildMOTD(member, "forged"); return err },
		"officer promotion":   func() error { _, err := db.SetGuildMemberRank(officer, member, GuildRankOfficer); return err },
		"officer transfer":    func() error { _, err := db.TransferGuildLeadership(officer, member); return err },
		"officer disband":     func() error { _, err := db.DisbandGuild(officer); return err },
		"active leader claim": func() error { _, err := db.ClaimInactiveGuildLeadership(officer, time.Now().UTC()); return err },
	} {
		if err := attempt(); err == nil {
			t.Fatal("unauthorized governance succeeded", name)
		}
	}
	after, err := db.GetGuildByID(guild.ID)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatal("rejected governance changed bank, roster, version or audit", err)
	}
	if _, err := db.guilds.UpdateOne(t.Context(), bson.M{"id": guild.ID}, bson.M{"$set": bson.M{
		"members.0.last_online": time.Now().UTC().Add(-31 * 24 * time.Hour),
	}}); err != nil {
		t.Fatal(err)
	}
	claimed, err := db.ClaimInactiveGuildLeadership(officer, time.Now().UTC())
	if err != nil || claimed.LeaderID != officer || guildMember(claimed, leader).Rank != GuildRankOfficer ||
		guildMember(claimed, officer).Rank != GuildRankLeader || claimed.Bank.Gold != 250 {
		t.Fatal("inactive succession changed funds or failed ownership transfer", err)
	}
	// Mongo stores dates at millisecond precision; compare two authoritative
	// reads rather than an in-memory nanosecond timestamp returned by mutation.
	canonical, err := db.GetGuildByID(guild.ID)
	if err != nil {
		t.Fatal(err)
	}
	reopened, err := New(os.Getenv("MONGO_URI"))
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close(context.Background())
	persisted, err := reopened.GetGuildByID(guild.ID)
	if err != nil || !reflect.DeepEqual(canonical, persisted) {
		t.Fatal("ownership/audit did not survive repository reopen", err)
	}
	left, deleted, err := reopened.LeaveGuild(officer)
	if err != nil || deleted || left.LeaderID != leader || left.Bank.Gold != 250 || len(left.Members) != 2 {
		t.Fatal("leader departure did not retain bank and select the remaining officer", err)
	}
	if _, err := reopened.DisbandGuild(officer); err == nil {
		t.Fatal("former leader retained destructive authority")
	}
}
