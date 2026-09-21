package game

import (
	"math"
	"reflect"
	"testing"
)

func TestDarkRealmCampaignCatalogAndPopulation(t *testing.T) {
	if len(darkRealmChapters) != 24 || len(darkRealmInvestigations()) != 12 || len(chronicleQuestCatalog()) != 55 {
		t.Fatal("campaign chapter budget changed")
	}
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	w.spawnDarkRealmEncounters()
	ids, sites, items := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, chapter := range darkRealmChapters {
		if ids[chapter.ID] || chapter.Title == "" || chapter.Acceptance == "" || chapter.Completion == "" || chapter.Summary == "" {
			t.Fatalf("missing/duplicate authored identity: %s", chapter.ID)
		}
		ids[chapter.ID] = true
		if _, ok := darkRealmDistrict(chapter.District); !ok {
			t.Fatal("unknown district", chapter.District)
		}
		if chapter.Type == "COLLECT" {
			if items[chapter.Item] || !chronicleDropSources[chapter.Item][chapter.Enemy] {
				t.Fatal("collection source missing/duplicate")
			}
			items[chapter.Item] = true
		}
		for _, site := range chapter.Sites {
			if sites[site.EntityID] || !darkRealmDistrictContains(chapter.District, site.X, site.Z) {
				t.Fatal("invalid discovery placement", site.ID)
			}
			sites[site.EntityID] = true
			e := w.Entities[site.EntityID]
			if e == nil || e.InstanceID != DarkRealmInstanceID || e.Type != TypeNPC || e.SubType != "ChronicleSite" {
				t.Fatal("missing shared-scene discovery", site.ID)
			}
		}
	}
	if len(sites) != 38 || len(items) != 4 {
		t.Fatal("incomplete discovery/item content")
	}
	for _, district := range DarkRealmDistricts()[1:] {
		models := map[string]int{}
		for _, e := range w.Entities {
			if e.Type != TypeEnemy || e.InstanceID != DarkRealmInstanceID || !darkRealmDistrictContains(district.ID, e.X, e.Z) {
				continue
			}
			models[e.SubType]++
			if e.Level != 100 || e.Health <= 0 || e.Damage <= 0 {
				t.Fatal("unusable encounter")
			}
			for _, chapter := range darkRealmChapters {
				for _, site := range chapter.Sites {
					if math.Hypot(e.X-site.X, e.Z-site.Z) < 15 {
						t.Fatal("enemy spawned on discovery approach")
					}
				}
			}
		}
		if models["DissonantShade"] < 5 || models["MemoryReaver"] < 5 {
			t.Fatal("district lacks both objective enemies", district.ID, models)
		}
	}
}

func TestDarkRealmNexusRequiresExpeditionButPreservesSavedContracts(t *testing.T) {
	p := darkRealmEligiblePlayer("nexus-gates")
	if CanEnterUmbralNexus(p) {
		t.Fatal("repairs alone skipped expedition")
	}
	p.Quests = append(p.Quests, Quest{ID: darkRealmNexusReadyID, Accepted: true, Count: 3, MaxCount: 3})
	if CanEnterUmbralNexus(p) {
		t.Fatal("ready objective skipped manual turn-in")
	}
	p.Quests[len(p.Quests)-1].Completed = true
	if !CanEnterUmbralNexus(p) {
		t.Fatal("claimed final investigation did not unlock Nexus")
	}
	for _, milestone := range []string{ChronicleGateOpenedID, ChronicleDarkKingID} {
		for _, completed := range []bool{false, true} {
			p.Quests = []Quest{{ID: milestone, Accepted: true, Completed: completed, MaxCount: 1, RewardXP: 123, RewardGold: 456, RewardXPQuoted: true, RewardGoldQuoted: true}}
			p.Level, p.Gold, p.Experience = 100, 777, 1234
			p.Inventory = []Item{{ID: "earned-gear", Name: "Earned item"}}
			before := append([]Item(nil), p.Inventory...)
			ensureChronicleLocked(p)
			if !CanEnterUmbralNexus(p) || p.Gold != 777 || p.Experience != 1234 || !reflect.DeepEqual(before, p.Inventory) {
				t.Fatal("migration changed earned access/resources")
			}
			q := questByID(t, p, milestone)
			if q.RewardXP != 123 || q.RewardGold != 456 || q.Completed != completed {
				t.Fatal("changed saved contract")
			}
			for _, chapter := range darkRealmChapters {
				q := questByID(t, p, chapter.ID)
				if !q.LegacyOptional || q.Accepted || q.Completed || q.Count != 0 {
					t.Fatal("missing chapter was forced completed/required")
				}
			}
			p.Level = 99
			if CanEnterUmbralNexus(p) || DarkRealmEntryAllowed(p) {
				t.Fatal("saved contract bypassed level100")
			}
		}
	}
}

func TestDarkRealmHuntsRequireEligiblePlayerAndDistrict(t *testing.T) {
	w := newTestWorld()
	chapter := darkRealmChapters[1]
	for _, scenario := range []string{"valid", "wrong-district", "wrong-instance", "player-elsewhere", "low-enemy", "ineligible", "wrong-enemy"} {
		t.Run(scenario, func(t *testing.T) {
			p := darkRealmEligiblePlayer("hunter")
			p.InstanceID = DarkRealmInstanceID
			p.Quests = append(p.Quests, Quest{ID: chapter.ID, Category: QuestCategoryChronicle, Type: "KILL", Target: "DarkRealmHunt:" + chapter.ID, Accepted: true, MaxCount: chapter.Count})
			enemy, level, instance, x, z := chapter.Enemy, 100, DarkRealmInstanceID, 40000.0, 40400.0
			switch scenario {
			case "wrong-district":
				x = 39300
			case "wrong-instance":
				instance = "umbral-private"
			case "player-elsewhere":
				p.InstanceID = ""
			case "low-enemy":
				level = 99
			case "ineligible":
				p.Level = 99
			case "wrong-enemy":
				enemy = "Skeleton"
			}
			w.updateDarkRealmHuntKillLocked(p, enemy, level, instance, x, z)
			want := 0
			if scenario == "valid" {
				want = 1
			}
			q := questByID(t, p, chapter.ID)
			if q.Count != want || q.Completed {
				t.Fatal("incorrect hunt credit", q)
			}
		})
	}
}

func TestDarkRealmDropsKeepDistrictAndPityBoundaries(t *testing.T) {
	w := newTestWorld()
	p := darkRealmEligiblePlayer("collector")
	p.InstanceID = DarkRealmInstanceID
	chapter := darkRealmChapters[2]
	p.Quests = append(p.Quests, Quest{ID: chapter.ID, Category: QuestCategoryChronicle, Type: "COLLECT", Target: chapter.Item, Accepted: true, MaxCount: chapter.Count, CollectionVersion: 2, DropMisses: 3})
	w.AddEntity(p)
	if drop := w.spawnChronicleDropLocked(p.ID, chapter.Enemy, DarkRealmInstanceID, 39300, 40400, 0); drop != nil {
		t.Fatal("wrong district produced fragment")
	}
	if questByID(t, p, chapter.ID).DropMisses != 3 {
		t.Fatal("wrong district consumed pity")
	}
	if drop := w.spawnChronicleDropLocked(p.ID, chapter.Enemy, DarkRealmInstanceID, 40000, 40400, .99); drop != nil {
		t.Fatal("fourth miss produced fragment")
	}
	drop := w.spawnChronicleDropLocked(p.ID, chapter.Enemy, DarkRealmInstanceID, 40000, 40400, .99)
	if drop == nil || drop.LootOwnerID != p.ID || drop.LootItem.Name != chapter.Item || !IsChronicleQuestItem(*drop.LootItem) {
		t.Fatal("fifth eligible kill did not produce personal bound fragment")
	}
	if questByID(t, p, chapter.ID).DropMisses != 0 {
		t.Fatal("pity did not reset")
	}
}

func TestDarkRealmInspectionRequiresActualSharedScene(t *testing.T) {
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	p := darkRealmEligiblePlayer("reader")
	chapter := darkRealmChapters[0]
	site := chapter.Sites[0]
	p.X, p.Z = site.X, site.Z
	p.Quests = append(p.Quests, Quest{ID: chapter.ID, Category: QuestCategoryChronicle, Type: "INVESTIGATE", Accepted: true, MaxCount: len(chapter.Sites)})
	w.AddEntity(p)
	if _, err := w.InspectChronicleSite(p.ID, site.EntityID); err == nil {
		t.Fatal("same coordinates in another scene gave credit")
	}
	p.InstanceID = DarkRealmInstanceID
	if _, err := w.InspectChronicleSite(p.ID, site.EntityID); err != nil {
		t.Fatal(err)
	}
	if _, err := w.InspectChronicleSite(p.ID, site.EntityID); err != nil {
		t.Fatal(err)
	}
	q := questByID(t, p, chapter.ID)
	if q.Count != 1 || q.InvestigationMask != 1 || q.Completed {
		t.Fatal("discovery was duplicated or auto-completed")
	}
}

func TestDarkRealmNexusEntryQualifiesEveryPartyMemberBeforeCreatingRun(t *testing.T) {
	w := newTestWorld()
	leader, follower := darkRealmEligiblePlayer("nexus-leader"), darkRealmEligiblePlayer("nexus-follower")
	leader.Quests = append(leader.Quests, Quest{ID: darkRealmNexusReadyID, Completed: true})
	w.AddEntity(leader)
	w.AddEntity(follower)
	party := w.CreateParty(leader.ID)
	if err := w.JoinParty(party.ID, follower.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := w.EnterPartyDungeon(leader.ID, "umbral_nexus", DifficultyNormal, 100); err == nil {
		t.Fatal("leader carried an ineligible member through the gate")
	}
	if leader.InstanceID != "" || follower.InstanceID != "" || len(w.InstanceLayouts) != 0 {
		t.Fatal("failed entry mutated party run")
	}
	follower.Quests = append(follower.Quests, Quest{ID: darkRealmNexusReadyID, Completed: true})
	run, moved, err := w.EnterPartyDungeon(leader.ID, "umbral_nexus", DifficultyNormal, 100)
	if err != nil || len(moved) != 2 || run.InstanceID == "" || leader.InstanceID != follower.InstanceID {
		t.Fatalf("eligible party entry failed: %+v %v %v", run, moved, err)
	}
}

func TestDarkRealmFreshPartialContractRemainsRequiredAfterRefresh(t *testing.T) {
	p := darkRealmEligiblePlayer("fresh-expedition")
	p.Quests = nil
	for _, q := range chronicleQuestCatalog() {
		if q.ID == darkRealmChapters[2].ID {
			q.Accepted, q.Count, q.DropMisses = true, 7, 3
			q.RewardXP, q.RewardGold = 222, 333
			p.Quests = append(p.Quests, q)
			break
		}
		q.Accepted, q.Completed, q.Count = true, true, q.MaxCount
		if q.Type == "INVESTIGATE" {
			q.InvestigationMask = (1 << q.MaxCount) - 1
		}
		p.Quests = append(p.Quests, q)
	}
	ensureChronicleLocked(p)
	q := questByID(t, p, darkRealmChapters[2].ID)
	if q.LegacyOptional || q.Completed || !q.Accepted || q.Count != 7 || q.DropMisses != 3 || q.RewardXP != 222 || q.RewardGold != 333 {
		t.Fatal("refresh changed active expedition contract", q)
	}
	if CanEnterUmbralNexus(p) {
		t.Fatal("partial expedition bypassed Nexus gate")
	}
}

func TestDarkRealmDeathPipelineSharesNearbyCreditNotWholeDistrict(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	chapter := darkRealmChapters[1]
	var members []*Entity
	for _, id := range []string{"dark-leader", "dark-nearby", "dark-far", "dark-town"} {
		p := darkRealmEligiblePlayer(id)
		p.InstanceID, p.X, p.Z = DarkRealmInstanceID, 40000, 40400
		p.Experience, p.ResonanceXP, p.Gold = 0, 0, 0
		p.Quests = append(p.Quests, Quest{ID: chapter.ID, Category: QuestCategoryChronicle, Type: "KILL", Target: "DarkRealmHunt:" + chapter.ID, MaxCount: chapter.Count, Accepted: true})
		w.AddEntity(p)
		members = append(members, p)
	}
	party := w.CreateParty(members[0].ID)
	for _, p := range members[1:] {
		if err := w.JoinParty(party.ID, p.ID); err != nil {
			t.Fatal(err)
		}
	}
	members[1].X += OverworldPartyRewardRadius
	members[2].X += OverworldPartyRewardRadius + .01
	members[3].InstanceID = ""
	enemy := &Entity{ID: "dark-credit-shade", Type: TypeEnemy, SubType: chapter.Enemy, Level: 100, InstanceID: DarkRealmInstanceID,
		Health: 1, MaxHealth: 1, State: "IDLE", X: 40000, Z: 40400, SpawnX: 40000, SpawnZ: 40400}
	w.AddEntity(enemy)
	enemy.Mu.Lock()
	w.handleDeath(enemy, members[0], nil)
	enemy.Mu.Unlock()
	w.StopBackground()
	for index, p := range members {
		q := questByID(t, p, chapter.ID)
		if index < 2 {
			if q.Count != 1 || q.Completed || p.ResonanceXP <= 0 || p.Gold <= 0 {
				t.Fatal("nearby member lost shared rewards/quest credit", p.ID, q.Count, p.ResonanceXP)
			}
		} else if q.Count != 0 || p.ResonanceXP != 0 || p.Gold != 0 {
			t.Fatal("remote member received shared-world credit", p.ID)
		}
	}
}
