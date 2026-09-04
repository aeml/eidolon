package database

import (
	crand "crypto/rand"
	"encoding/hex"
	"testing"
	"time"
)

func TestValidateGuildIdentityNormalizesAndRejectsUnsafeInput(t *testing.T) {
	name, tag, err := ValidateGuildIdentity("  Night   Watch ", "nw")
	if err != nil || name != "Night Watch" || tag != "NW" {
		t.Fatalf("unexpected normalized identity: %q %q %v", name, tag, err)
	}
	for _, invalid := range [][2]string{{"x", "OK"}, {"Valid Name", "TOOLONG"}, {"<script>", "OK"}} {
		if _, _, err := ValidateGuildIdentity(invalid[0], invalid[1]); err == nil {
			t.Fatalf("accepted invalid guild identity: %q %q", invalid[0], invalid[1])
		}
	}
}

func TestGuildDungeonSeasonMatchesQuarterAndRejectsInvalidRun(t *testing.T) {
	if got := CurrentGuildDungeonSeason(time.Date(2026, time.September, 1, 0, 0, 0, 0, time.UTC)); got != "2026-Q3" {
		t.Fatalf("season = %q, want 2026-Q3", got)
	}
	if err := (&DB{}).RecordGuildDungeonRun(GuildDungeonRun{}); err == nil {
		t.Fatal("uninitialized leaderboard accepted a run")
	}
}

func TestGuildRankPermissions(t *testing.T) {
	if !GuildRankCan(GuildRankLeader, GuildPermissionSetRank) {
		t.Fatal("leader lacks rank permission")
	}
	if !GuildRankCan(GuildRankOfficer, GuildPermissionWithdrawBank) {
		t.Fatal("officer lacks bank permission")
	}
	if GuildRankCan(GuildRankOfficer, GuildPermissionSetRank) || GuildRankCan(GuildRankMember, GuildPermissionInvite) {
		t.Fatal("rank received elevated permission")
	}
}

func TestAppendBoundedGuildAudit(t *testing.T) {
	entries := make([]GuildAuditEntry, GuildAuditLimit)
	entries = appendBoundedGuildAudit(entries, GuildAuditEntry{Action: "latest"})
	if len(entries) != GuildAuditLimit || entries[len(entries)-1].Action != "latest" {
		t.Fatalf("audit was not bounded: %+v", entries)
	}
}

func randomGuildTag(t *testing.T) string {
	t.Helper()
	value := make([]byte, 2)
	if _, err := crand.Read(value); err != nil {
		t.Fatal(err)
	}
	return "G" + hex.EncodeToString(value)
}

func TestGuildPersistenceLifecycle(t *testing.T) {
	db := newFriendshipDB(t)
	leaderID, memberID := uniqueID("guild-leader"), uniqueID("guild-member")
	tag := randomGuildTag(t)
	guild, err := db.CreateGuild("Guild "+tag, tag, leaderID, "Leader")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.guilds.DeleteOne(t.Context(), map[string]string{"id": guild.ID})
		_, _ = db.guildInvites.DeleteMany(t.Context(), map[string]string{"guild_id": guild.ID})
	})
	if err := db.InviteToGuild(guild.ID, leaderID, memberID); err != nil {
		t.Fatal(err)
	}
	invites, err := db.GetGuildInvites(memberID)
	if err != nil || len(invites) != 1 {
		t.Fatalf("guild invite was not persisted: %+v %v", invites, err)
	}
	guild, err = db.RespondGuildInvite(memberID, guild.ID, "Member", true)
	if err != nil || len(guild.Members) != 2 {
		t.Fatalf("guild membership was not accepted: %+v %v", guild, err)
	}
	guild, err = db.SetGuildMemberRank(leaderID, memberID, GuildRankOfficer)
	if err != nil || guildMember(guild, memberID).Rank != GuildRankOfficer {
		t.Fatalf("guild rank was not updated: %+v %v", guild, err)
	}
	if _, err := db.DepositGuildGold(guild.ID, leaderID, 250); err != nil {
		t.Fatal(err)
	}
	if _, err := db.WithdrawGuildGold(guild.ID, memberID, 100); err != nil {
		t.Fatal(err)
	}
	if _, err := db.DepositGuildItem(guild.ID, leaderID, Item{ID: "guild-item", Name: "Guild Blade", Stack: 1}); err != nil {
		t.Fatal(err)
	}
	if _, item, err := db.WithdrawGuildItem(guild.ID, memberID, "guild-item"); err != nil || item.Name != "Guild Blade" {
		t.Fatalf("guild item withdrawal failed: %+v %v", item, err)
	}
	guild, err = db.TransferGuildLeadership(leaderID, memberID)
	if err != nil || guild.LeaderID != memberID {
		t.Fatalf("leadership transfer failed: %+v %v", guild, err)
	}
	if _, _, err := db.LeaveGuild(leaderID); err != nil {
		t.Fatal(err)
	}
}
