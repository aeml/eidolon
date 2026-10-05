package database

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerGuildRewardExportMongoProjectionPagingAndNoSettlement(t *testing.T) {
	uri := os.Getenv("EIDOLON_OWNER_EXPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable owner-export Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("explicit disposable loopback Mongo required")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	base := db.users.Database()
	db.users = base.Collection(uniqueID("guild-reward-users"))
	db.reports = base.Collection(uniqueID("guild-reward-cases"))
	db.guilds = base.Collection(uniqueID("guild-reward-guilds"))
	db.guildInvites = base.Collection(uniqueID("guild-reward-invites"))
	db.pvpProfiles = base.Collection(uniqueID("guild-reward-pvp"))
	db.raidLockouts = base.Collection(uniqueID("guild-reward-raids"))
	collections := []*mongo.Collection{db.users, db.reports, db.guilds, db.guildInvites, db.pvpProfiles, db.raidLockouts}
	t.Cleanup(func() {
		for _, collection := range collections {
			_ = collection.Drop(context.Background())
		}
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC().Truncate(time.Millisecond)
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	if _, err := db.users.InsertOne(ctx, bson.M{"username": "owner", "password_hash": string(hash)}); err != nil {
		t.Fatal(err)
	}
	caseID := primitive.NewObjectID()
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": caseID, "username": "owner", "report_type": "Account Data Export", "export_approval": bson.M{"enabled": true, "revision": int64(1), "at": now}}); err != nil {
		t.Fatal(err)
	}
	expected := map[string]map[string]bool{"guilds": {}, "invites": {}, "pvp": {}, "raids": {}}
	for i := 0; i < 12; i++ {
		guildID := primitive.NewObjectID()
		expected["guilds"][guildID.Hex()] = true
		if _, err := db.guilds.InsertOne(ctx, bson.M{"_id": guildID, "id": fmt.Sprintf("guild-%d", i), "name": "Public Guild", "tag": "PUB", "members": bson.A{bson.M{"player_id": "player-owner", "username": "owner", "rank": "member", "joined_at": now, "last_online": now}, bson.M{"player_id": "player-private-other", "username": "private-member", "rank": "leader", "joined_at": now, "last_online": now}}, "bank": bson.M{"items": bson.A{bson.M{"name": strings.Repeat("private-bank-", 50000)}}}, "audit": bson.A{bson.M{"reason": "private-audit"}}}); err != nil {
			t.Fatal(err)
		}
		inviteID := primitive.NewObjectID()
		expected["invites"][inviteID.Hex()] = true
		inviter, target := "player-public-counterpart", "player-owner"
		if i%2 == 0 {
			inviter, target = target, inviter
		}
		if _, err := db.guildInvites.InsertOne(ctx, bson.M{"_id": inviteID, "guild_id": "guild-public", "guild_name": "Public Guild", "guild_tag": "PUB", "inviter_id": inviter, "target_id": target, "created_at": now, "expires_at": now.Add(time.Hour), "private_payload": "private-invite"}); err != nil {
			t.Fatal(err)
		}
		raidID := primitive.NewObjectID()
		expected["raids"][raidID.Hex()] = true
		completed := now.Add(-time.Duration(i) * 7 * 24 * time.Hour)
		raid := bson.M{"_id": raidID, "player_id": "player-owner", "week": CurrentRaidWeek(completed), "completed_at": completed, "retry_after": now, "reward_payload": "private-raid-reward"}
		if i%2 == 0 {
			raid["delivery_pending"] = true
		}
		if _, err := db.raidLockouts.InsertOne(ctx, raid); err != nil {
			t.Fatal(err)
		}
	}
	profileID := primitive.NewObjectID()
	expected["pvp"][profileID.Hex()] = true
	if _, err := db.pvpProfiles.InsertOne(ctx, bson.M{"_id": profileID, "player_id": "player-owner", "rating": 1200, "wins": 4, "losses": 2, "honor": 300, "season_points": 12, "season_victories": 4, "season": "2026-Q4", "updated_at": now, "revision": 9, "last_match_id": "private-match-replay", "last_result": bson.M{"won": true, "team_score": 5, "opponent_score": 3, "reason": "Ranked victory", "match_id": "private-result-identity"}, "reward_state": bson.M{"day": "2026-10-05", "deserter_until": now.Unix() + 600, "opponents": bson.M{"player-private-other": 99}}, "season_history": bson.A{bson.M{"season": "2026-Q3", "rating": 1100, "wins": 3, "losses": 1, "medal": "Bronze", "settled_at": now.Unix() - 3600, "private_opponents": strings.Repeat("private-season-", 50000)}}}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.guilds.InsertOne(ctx, bson.M{"id": "private-unrelated", "members": bson.A{bson.M{"player_id": "player-other"}}}); err != nil {
		t.Fatal(err)
	}
	for _, variant := range []string{"expired", "other"} {
		invite := bson.M{"guild_id": "guild-public", "guild_name": "Public Guild", "inviter_id": "player-owner", "target_id": "player-public-counterpart", "created_at": now, "expires_at": now.Add(time.Hour)}
		if variant == "expired" {
			invite["expires_at"] = now
		} else {
			invite["inviter_id"] = "player-other"
		}
		if _, err := db.guildInvites.InsertOne(ctx, invite); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.pvpProfiles.InsertOne(ctx, bson.M{"player_id": "player-other", "private_profile": "private-other"}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.raidLockouts.InsertOne(ctx, bson.M{"player_id": "player-other", "week": "private-week"}); err != nil {
		t.Fatal(err)
	}
	read := func(section, before string) ([]byte, error) {
		return db.ReadApprovedOwnerExportQuery(ctx, "owner", "synthetic owner proof", caseID.Hex(), 1, OwnerExportQuery{Section: section, Before: before}, now, maximumOwnerExportResponse)
	}
	for _, section := range []string{"guilds", "invites", "pvp", "raids"} {
		before := ""
		seen := make(map[string]bool)
		pages := 2
		if section == "pvp" {
			pages = 1
		}
		for pageNumber := 0; pageNumber < pages; pageNumber++ {
			data, err := read(section, before)
			if err != nil || strings.Contains(string(data), "private-") {
				t.Fatal("own records failed or private shared data leaked", section, err)
			}
			var page struct {
				Entries  []json.RawMessage   `json:"entries"`
				Coverage ownerExportCoverage `json:"coverage"`
				Next     string              `json:"next"`
			}
			if json.Unmarshal(data, &page) != nil || page.Coverage.CompleteAccountExport {
				t.Fatal("invalid coverage/envelope")
			}
			want := 10
			if pageNumber == 1 {
				want = 2
			}
			if section == "pvp" {
				want = 1
			}
			if len(page.Entries) != want {
				t.Fatal("source filter/page count lost", section)
			}
			for _, raw := range page.Entries {
				var key struct {
					ID primitive.ObjectID `json:"id"`
				}
				if json.Unmarshal(raw, &key) != nil || !expected[section][key.ID.Hex()] || seen[key.ID.Hex()] {
					t.Fatal("other/expired/duplicate ID exported")
				}
				seen[key.ID.Hex()] = true
				if section == "pvp" {
					var entry ownerCompetitiveEntry
					if json.Unmarshal(raw, &entry) != nil || entry.Summary.Rating != 1200 || len(entry.Summary.SeasonHistory) != 1 || entry.Summary.SeasonHistory[0].Rating != 1100 || entry.Summary.LastResult.Reason != "Ranked victory" || entry.Summary.QueuePenalty.DeserterUntil != now.Unix()+600 {
						t.Fatal("competitive record provenance lost")
					}
				}
				if section == "guilds" {
					var entry ownerGuildEntry
					if json.Unmarshal(raw, &entry) != nil || entry.Membership.Rank != "member" || !entry.Membership.JoinedAt.Equal(now) {
						t.Fatal("own membership lost")
					}
				}
			}
			if pageNumber == 0 && pages == 2 && page.Next == "" || pageNumber == pages-1 && page.Next != "" {
				t.Fatal("invalid continuation")
			}
			before = page.Next
		}
		if len(seen) != len(expected[section]) {
			t.Fatal("owner rows missing", section)
		}
	}
	// Missing profile stays an empty read, never a default profile/season write.
	if data, err := db.readOwnerExportQuery(ctx, "owner", "synthetic owner proof", OwnerExportQuery{Section: "pvp", Before: profileID.Hex()}, now, maximumOwnerExportResponse); err != nil || !strings.Contains(string(data), `"entries":[]`) {
		t.Fatal("empty profile continuation failed", err)
	}
	oversizedID := primitive.NewObjectID()
	if _, err := db.guilds.InsertOne(ctx, bson.M{"_id": oversizedID, "id": "guild-oversized", "name": strings.Repeat("x", 3000), "tag": "BIG", "members": bson.A{bson.M{"player_id": "player-owner", "rank": "member", "joined_at": now}}}); err != nil {
		t.Fatal(err)
	}
	if data, err := read("guilds", ""); err != errOwnerExportSection || data != nil {
		t.Fatal("oversized own guild row silently skipped")
	}
	for collection, want := range map[*mongo.Collection]int64{db.guilds: 14, db.guildInvites: 14, db.pvpProfiles: 2, db.raidLockouts: 13} {
		if count, err := collection.CountDocuments(ctx, bson.M{}); err != nil || count != want {
			t.Fatal("export altered shared/reward source state")
		}
	}
	var profile bson.M
	if db.pvpProfiles.FindOne(ctx, bson.M{"_id": profileID}).Decode(&profile) != nil || profile["revision"] != int32(9) || profile["season"] != "2026-Q4" {
		t.Fatal("export settled/rolled competitive profile")
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"export_approval.enabled": false, "export_approval.revision": int64(2)}}); err != nil {
		t.Fatal(err)
	}
	for _, section := range []string{"guilds", "invites", "pvp", "raids"} {
		if data, err := read(section, oversizedID.Hex()); err != errOwnerExportSection || data != nil {
			t.Fatal("revoked approval continued shared/reward reads")
		}
	}
}
