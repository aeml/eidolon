package game

import (
	"fmt"
	"math"
	"reflect"
	"testing"
	"time"
)

func TestChronicleHuntsOrderAndBudgets(t *testing.T) {
	catalog := chronicleQuestCatalog()
	if len(catalog) != 31 || len(ChronicleHuntCatalog()) != 8 {
		t.Fatal("expected 31 chapters including eight preparation hunts")
	}
	indices := map[string]int{}
	for i, q := range catalog {
		if _, duplicate := indices[q.ID]; duplicate || q.Chapter != i+1 {
			t.Fatal("invalid chapter identity/order")
		}
		indices[q.ID] = i
	}
	for _, hunt := range ChronicleHuntCatalog() {
		i, found := indices[hunt.ID]
		if !found || i == 0 || i+1 == len(catalog) || catalog[i-1].ID != hunt.PreviousQuestID || catalog[i+1].ID != hunt.BeforeQuestID {
			t.Fatalf("broken authored handoff: %+v", hunt)
		}
		q := catalog[i]
		if q.MaxCount != hunt.Count || q.RewardXP != (100+25*(hunt.ContentLevel-1)*(hunt.ContentLevel-1))*75/100 || q.RewardGold != hunt.ContentLevel*10 || q.Accepted || q.Completed || q.LegacyOptional {
			t.Fatalf("incorrect hunt offer: %+v", q)
		}
		if hunt.Acceptance == "" || hunt.Completion == "" || hunt.Handoff == "" || hunt.Lore == "" || hunt.CatchupAcceptance == "" || hunt.CatchupCompletion == "" {
			t.Fatal("incomplete narrative")
		}
	}
	if catalog[0].MaxCount != 3 || catalog[0].RewardXP != 100 {
		t.Fatal("tutorial was stretched into a hunt")
	}
}

func TestFirstChronicleHuntAcceptsEarlyRoadWardens(t *testing.T) {
	hunt, ok := chronicleHuntByID("chronicle_earth_kept_watch")
	if !ok || hunt.MinEnemyLevel != 3 || hunt.Count != 40 || hunt.ContentLevel != 10 {
		t.Fatal("first expedition must admit level-three road wardens without changing its count or reward budget")
	}
	for _, level := range []int{3, 4, 8, 10} {
		if !huntKillMatches(hunt, "Skeleton", level, "", 300, 200) {
			t.Fatalf("road warden level %d rejected", level)
		}
	}
	if huntKillMatches(hunt, "Skeleton", 2, "", 300, 200) {
		t.Fatal("weakened tutorial enemies must remain distinct")
	}
}

func TestChronicleHuntsMigrateAllPriorExpandedMilestones(t *testing.T) {
	oldCatalog := expandChronicleInvestigations(classicChronicleQuestCatalog())
	for milestone, active := range oldCatalog {
		t.Run(active.ID, func(t *testing.T) {
			p := newTestPlayer("hunt-migration", "Wizard")
			for i := 0; i <= milestone; i++ {
				q := oldCatalog[i]
				q.Accepted, q.Completed = true, i < milestone
				if q.Completed {
					q.Count = q.MaxCount
				}
				if q.Type == "INVESTIGATE" && q.Completed {
					q.InvestigationMask = (1 << q.MaxCount) - 1
				}
				p.Quests = append(p.Quests, q)
			}
			before := append([]Quest(nil), p.Quests...)
			ensureChronicleLocked(p)
			for _, old := range before {
				q := questByID(t, p, old.ID)
				if q.Accepted != old.Accepted || q.Completed != old.Completed || q.Count != old.Count || q.LegacyOptional {
					t.Fatalf("old progress changed: %s", q.ID)
				}
			}
			activeIndex := questByID(t, p, active.ID).Chapter
			for _, q := range p.Quests {
				if _, hunt := chronicleHuntByID(q.ID); hunt {
					if !q.LegacyOptional || q.Accepted || q.Completed || q.Count != 0 || q.Chapter >= activeIndex {
						t.Fatalf("invalid optional catch-up: %+v", q)
					}
				}
			}
			normalized := append([]Quest(nil), p.Quests...)
			if ensureChronicleLocked(p) || !reflect.DeepEqual(normalized, p.Quests) {
				t.Fatal("hunt migration not idempotent")
			}
		})
	}
}

func TestChronicleHuntKillEligibility(t *testing.T) {
	locations := map[string][2]float64{"earth": {300, 200}, "water": {0, -800}, "fire": {-1500, 200}, "air": {1500, 200}}
	for _, hunt := range ChronicleHuntCatalog() {
		point := locations[hunt.HuntingRealm]
		if !huntKillMatches(hunt, hunt.Enemy, hunt.MinEnemyLevel, "", point[0], point[1]) {
			t.Fatalf("eligible enemy rejected: %s", hunt.ID)
		}
		for _, bad := range []struct {
			enemy    string
			level    int
			instance string
			x, z     float64
		}{
			{hunt.Enemy, hunt.MinEnemyLevel - 1, "", point[0], point[1]},
			{"wrong", hunt.MinEnemyLevel, "", point[0], point[1]},
			{hunt.Enemy, hunt.MinEnemyLevel, "dungeon", point[0], point[1]},
			{hunt.Enemy, hunt.MinEnemyLevel, "", 50000, 50000},
			{hunt.Enemy, hunt.MinEnemyLevel, "", math.NaN(), point[1]},
		} {
			if huntKillMatches(hunt, bad.enemy, bad.level, bad.instance, bad.x, bad.z) {
				t.Fatalf("invalid kill counted: %+v", bad)
			}
		}
	}
}

func TestChronicleHuntProductionDeathCreditsOnceWithoutCompleting(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("hunt-killer", "Wizard")
	p.Level, p.MaxExperience, p.X, p.Z = 100, experienceRequiredForLevel(100), 300, 200
	w.AddEntity(p)
	for _, q := range chronicleQuestCatalog() {
		if q.ID == "chronicle_earth_kept_watch" {
			q.Accepted = true
			p.Quests = []Quest{q}
		}
	}
	updates := make(chan []Quest, 4)
	w.OnQuestUpdate = func(_ string, quests []Quest) { updates <- quests }
	for i, level := range []int{2, 3} {
		e := &Entity{ID: fmt.Sprintf("hunt-target-%d", i), Type: TypeEnemy, SubType: "Skeleton", Level: level, Health: 1, MaxHealth: 1, State: "IDLE", X: 302, Z: 200, SpawnX: 302, SpawnZ: 200}
		w.AddEntity(e)
		e.Mu.Lock()
		w.handleDeath(e, p, nil)
		w.handleDeath(e, p, nil)
		e.Mu.Unlock()
	}
	select {
	case snapshot := <-updates:
		if snapshot[0].Count != 1 || snapshot[0].Completed || snapshot[0].GrantedXP != 0 || snapshot[0].GrantedGold != 0 {
			t.Fatalf("incorrect kill receipt: %+v", snapshot[0])
		}
	case <-time.After(5 * time.Second):
		t.Fatal("missing qualifying hunt credit")
	}
	p.Mu.RLock()
	defer p.Mu.RUnlock()
	q := p.Quests[0]
	if q.Count != 1 || q.Completed {
		t.Fatal("duplicate death or weak starter earned hunt completion")
	}
}

func TestChronicleHuntPartyCreditRequiresAnEligibleAcceptedContract(t *testing.T) {
	for _, scenario := range []string{"nearby", "unaccepted", "completed", "far", "dead", "other-instance"} {
		t.Run(scenario, func(t *testing.T) {
			w := newTestWorld()
			players := []*Entity{}
			for _, id := range []string{"leader", "member", "last-recipient"} {
				p := newTestPlayer("hunt-party-"+id, "Wizard")
				p.Level, p.MaxExperience, p.X, p.Z = 100, experienceRequiredForLevel(100), 300, 200
				for _, q := range chronicleQuestCatalog() {
					if q.ID == "chronicle_earth_kept_watch" {
						q.Accepted = true
						p.Quests = []Quest{q}
					}
				}
				w.AddEntity(p)
				players = append(players, p)
			}
			party := w.CreateParty(players[0].ID)
			for _, p := range players[1:] {
				if err := w.JoinParty(party.ID, p.ID); err != nil {
					t.Fatal(err)
				}
			}
			member := players[1]
			switch scenario {
			case "unaccepted":
				member.Quests[0].Accepted = false
			case "completed":
				member.Quests[0].Completed = true
				member.Quests[0].Count = member.Quests[0].MaxCount
			case "far":
				member.X = 900
			case "dead":
				member.State, member.Health = "DEAD", 0
			case "other-instance":
				member.InstanceID = "unrelated-dungeon"
			}
			before := member.Quests[0]
			lastUpdated := make(chan struct{}, 2)
			w.OnQuestUpdate = func(id string, _ []Quest) {
				if id == players[2].ID {
					lastUpdated <- struct{}{}
				}
			}
			enemy := &Entity{ID: "party-hunt-target", Type: TypeEnemy, SubType: "Skeleton", Level: 8,
				Health: 1, MaxHealth: 1, State: "IDLE", X: 302, Z: 200, SpawnX: 302, SpawnZ: 200}
			w.AddEntity(enemy)
			enemy.Mu.Lock()
			w.handleDeath(enemy, players[0], nil)
			w.handleDeath(enemy, players[0], nil)
			enemy.Mu.Unlock()
			select {
			case <-lastUpdated:
			case <-time.After(5 * time.Second):
				t.Fatal("last eligible party member did not receive the hunt update")
			}
			member.Mu.RLock()
			defer member.Mu.RUnlock()
			after := member.Quests[0]
			wantCount := before.Count
			if scenario == "nearby" {
				wantCount++
			}
			if after.Count != wantCount || after.Completed != before.Completed || after.GrantedXP != 0 || after.GrantedGold != 0 {
				t.Fatalf("incorrect party hunt credit: before=%+v after=%+v", before, after)
			}
		})
	}
}
