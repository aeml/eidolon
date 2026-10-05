package database

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerGuildRewardExportOwnerFencesAndNoPrivateProjection(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	now := time.Now().UTC()
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, section := range []string{"guilds", "invites", "pvp", "raids"} {
		for _, scenario := range []string{"valid", "invalid-scope", "oversized", "reset-after-read", "empty"} {
			mt.Run(section+"/"+scenario, func(mt *mtest.T) {
				ns := mt.DB.Name() + "." + mt.Coll.Name()
				proof := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
				id, _ := primitive.ObjectIDFromHex("0123456789abcdef01234560")
				row := bson.M{"_id": id}
				switch section {
				case "guilds":
					row["id"] = "public-guild"
					row["name"] = "Public Guild"
					row["tag"] = "PUB"
					row["own_members"] = bson.A{bson.M{"player_id": "player-owner", "rank": "member", "joined_at": now}}
					if scenario == "invalid-scope" {
						row["own_members"] = bson.A{bson.M{"player_id": "player-other", "rank": "member", "joined_at": now}}
					}
				case "invites":
					row["guild_id"] = "public-guild"
					row["guild_name"] = "Public Guild"
					row["inviter_id"] = "player-counterpart"
					row["target_id"] = "player-owner"
					row["created_at"] = now
					row["expires_at"] = now.Add(time.Hour)
					if scenario == "invalid-scope" {
						row["expires_at"] = now
					}
				case "pvp":
					row["player_id"] = "player-owner"
					row["season"] = "2026-Q4"
					row["updated_at"] = now
					row["rating"] = 1100
					row["season_history"] = bson.A{bson.M{"season": "2026-Q3", "rating": 1050}}
					if scenario == "invalid-scope" {
						row["player_id"] = "player-other"
					}
				case "raids":
					row["player_id"] = "player-owner"
					row["week"] = CurrentRaidWeek(now)
					row["completed_at"] = now
					if scenario == "invalid-scope" {
						row["week"] = "wrong-week"
					}
				}
				page := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "within_bound", Value: scenario != "oversized"}, {Key: "entry", Value: row}})
				if scenario == "empty" {
					page = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
				}
				last := proof
				if scenario == "reset-after-read" {
					last = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
				}
				mt.AddMockResponses(proof, page, last)
				db := &DB{users: mt.Coll, guilds: mt.Coll, guildInvites: mt.Coll, pvpProfiles: mt.Coll, raidLockouts: mt.Coll}
				data, err := db.readOwnerExportQuery(context.Background(), "owner", "synthetic owner proof", OwnerExportQuery{Section: section, Before: "0123456789abcdef01234565"}, now, maximumOwnerExportResponse)
				if scenario == "valid" || scenario == "empty" {
					if err != nil || !json.Valid(data) {
						mt.Fatal("valid owner record failed", err)
					}
					if strings.Contains(string(data), `"player_id"`) || strings.Contains(string(data), `"match_id"`) {
						mt.Fatal("private source identity exported")
					}
					if section == "guilds" && strings.Contains(string(data), `"last_online"`) {
						mt.Fatal("invented missing membership last-online timestamp")
					}
				} else if err != errOwnerExportSection || data != nil {
					mt.Fatal("invalid/reset row returned partial data")
				}
				events := mt.GetAllStartedEvents()
				for _, event := range events {
					if event.CommandName != "find" && event.CommandName != "aggregate" {
						mt.Fatal("export mutated or initialized data", event.CommandName)
					}
				}
				stages, _ := events[1].Command.Lookup("pipeline").Array().Values()
				projection := stages[3].Document().Lookup("$project").Document()
				for _, field := range []string{"members", "bank", "audit", "events", "last_match_id", "revision", "last_result.match_id", "reward_state.opponents", "retry_after", "reward_payload"} {
					if projection.Lookup(field).Type != 0 {
						mt.Fatal("raw shared/private projection widened", field)
					}
				}
			})
		}
	}
	for _, source := range []any{ownerGuildSource{}, ownerInviteSource{}, ownerCompetitiveSource{}, ownerRaidSource{}} {
		data, err := json.Marshal(source)
		if err != nil || string(data) != "{}" {
			t.Fatal("source DTO no longer private")
		}
	}
	for section, format := range ownerExportFormats {
		if format == "" || !IsOwnerExportFormat(format) || !ValidOwnerExportQuery(OwnerExportQuery{Section: section, CharacterName: func() string {
			if section == "progress" {
				return "owner"
			}
			return ""
		}()}) {
			t.Fatal("registered category/format diverged", section)
		}
	}
	if ValidOwnerExportQuery(OwnerExportQuery{Section: "unregistered"}) || IsOwnerExportFormat("eidolon-owner-raw-user") {
		t.Fatal("unknown category/format admitted")
	}
}
