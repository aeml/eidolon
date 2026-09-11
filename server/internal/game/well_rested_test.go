package game

import (
	"math"
	"reflect"
	"testing"
	"time"
)

func restTestPlayer(class string) *Entity {
	e := &Entity{ID: "rest-player", Type: TypePlayer, SubType: class, State: "IDLE", Level: 1,
		Health: 1, BaseStats: Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}}
	e.RecalculateStats()
	return e
}

func TestWellRestedPvPExitUsesCurrentStatsAfterExpiry(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(class, func(t *testing.T) {
			a, b := restTestPlayer(class), restTestPlayer("Fighter")
			a.ID, b.ID = "rest-arena-a", "rest-arena-b"
			a.X, a.Z, b.X, b.Z = 1, 200, 3, 200
			a.WellRestedSeconds, b.WellRestedSeconds = 2, 10
			a.RecalculateStats()
			b.RecalculateStats()
			w := newPvPTestWorld(a, b)
			match := startTestPvPMatch(w, PvPModeArena1v1, []string{a.ID}, []string{b.ID})
			if a.InstanceID != match.ID || w.SafeZoneAt(a.InstanceID, a.X, a.Z) != "" {
				t.Fatal("arena inherited overworld sanctuary")
			}
			for _, player := range []*Entity{a, b} {
				player.Mu.Lock()
				player.updateSafeZoneRestLocked(3, w.SafeZoneAt(player.InstanceID, player.X, player.Z), time.Now())
				player.Mu.Unlock()
			}
			if a.WellRestedSeconds != 0 || a.MaxHealth != 100 || b.WellRestedSeconds != 7 || b.MaxHealth != 110 {
				t.Fatal("arena did not consume the separate rest banks")
			}
			w.ForfeitPvP(a.ID)
			if a.InstanceID != "" || a.Z != 200 || a.MaxHealth != 100 || a.Health != 100 || a.Stats.Strength != 10 {
				t.Fatal("match restoration revived expired stats")
			}
			if b.WellRestedSeconds != 7 || b.MaxHealth != 110 || b.Health != 110 {
				t.Fatal("match exit changed surviving rest bank")
			}
			a.Mu.Lock()
			a.updateSafeZoneRestLocked(.5, w.SafeZoneAt(a.InstanceID, a.X, a.Z), time.Now())
			a.Mu.Unlock()
			if a.WellRestedSeconds != .5 || a.MaxHealth != 110 || a.Health != 105 || a.Stats.Strength != 11 {
				t.Fatal("town return stacked or refilled the reactivated bonus")
			}
		})
	}
}

func TestWellRestedUsesElapsedServerTimeWithoutOfflineCatchup(t *testing.T) {
	e, start := restTestPlayer("Wizard"), time.Now()
	e.updateSafeZoneRestAtLocked("lanternhold", start)
	if e.WellRestedSeconds != 0 || e.Health != 1 {
		t.Fatal("new login received pre-admission time")
	}
	// Only two simulation callbacks occur over ten elapsed seconds. Rest and
	// recovery still represent ten seconds, not two fixed 33ms physics steps.
	e.updateSafeZoneRestAtLocked("lanternhold", start.Add(4*time.Second))
	e.updateSafeZoneRestAtLocked("lanternhold", start.Add(10*time.Second))
	if e.WellRestedSeconds != 10 || e.Health != 110 || e.Mana != 110 {
		t.Fatalf("delayed ticks slowed recovery: %+v", e)
	}
	e.updateSafeZoneRestAtLocked("lanternhold", start.Add(9*time.Second))
	if e.WellRestedSeconds != 10 {
		t.Fatal("backward clock awarded time")
	}
	e.updateSafeZoneRestAtLocked("", start.Add(12*time.Second))
	if e.WellRestedSeconds != 8 {
		t.Fatal("outside real-time countdown wrong")
	}
	e.Disconnected = true
	e.updateSafeZoneRestAtLocked("lanternhold", start.Add(100*time.Second))
	if e.WellRestedSeconds != 8 {
		t.Fatal("disconnected time awarded rest")
	}
	e.Disconnected = false
	e.updateSafeZoneRestAtLocked("lanternhold", start.Add(101*time.Second))
	if e.WellRestedSeconds != 9 {
		t.Fatal("offline interval carried into next online tick")
	}
}

func TestWellRestedResumeStartsAFreshElapsedClock(t *testing.T) {
	w := newTestWorld()
	e := restTestPlayer("Wizard")
	e.WellRestedSeconds = 123
	w.AddEntity(e)
	w.SetEntityDisconnected(e.ID, time.Now().Add(-time.Hour))
	if !e.restTickAt.IsZero() {
		t.Fatal("disconnect kept elapsed clock")
	}
	before := time.Now()
	if _, ok := w.ClearEntityDisconnected(e.ID); !ok {
		t.Fatal("resume failed")
	}
	if e.restTickAt.Before(before) || e.WellRestedSeconds != 123 {
		t.Fatal("resume backdated rest or changed bank")
	}
	e.updateSafeZoneRestAtLocked("lanternhold", e.restTickAt.Add(time.Second))
	if e.WellRestedSeconds != 124 {
		t.Fatal("resume earned offline time")
	}
}

func TestSafeZoneRegistryBoundariesAndFutureScenes(t *testing.T) {
	w := &World{SafeZones: NewSafeZoneRegistry()}
	for _, point := range [][2]float64{{-100, 100}, {100, 300}, {100, 100}, {-100, 300}, {0, 200}} {
		if w.SafeZoneAt("", point[0], point[1]) != "lanternhold" {
			t.Fatal("fence excluded", point)
		}
		if w.SafeZoneAt("dungeon-same-coordinates", point[0], point[1]) != "" {
			t.Fatal("town leaked into instance", point)
		}
	}
	for _, point := range [][2]float64{{-100.001, 200}, {100.001, 200}, {0, 99.999}, {0, 300.001}, {math.NaN(), 200}, {0, math.Inf(1)}} {
		if w.SafeZoneAt("", point[0], point[1]) != "" {
			t.Fatal("outside location protected", point)
		}
	}
	zone := SafeZone{ID: "future-air-shrine", Name: "Future shrine", MinX: 1000, MaxX: 1100, MinZ: 200, MaxZ: 300}
	if err := w.SafeZones.Register(zone); err != nil {
		t.Fatal(err)
	}
	if w.SafeZoneAt("", 1050, 250) != zone.ID {
		t.Fatal("future zone was not registered")
	}
	if err := w.SafeZones.Register(zone); err == nil {
		t.Fatal("duplicate zone accepted")
	}
	zone.ID, zone.InstanceID = "instance-shrine", "owned-instance"
	if err := w.SafeZones.Register(zone); err != nil {
		t.Fatal(err)
	}
	if w.SafeZoneAt("owned-instance", 1050, 250) != zone.ID || w.SafeZoneAt("other-instance", 1050, 250) != "" {
		t.Fatal("instance scope ignored")
	}
	zone.ID, zone.MinX = "bad-zone", math.NaN()
	if err := w.SafeZones.Register(zone); err == nil {
		t.Fatal("invalid zone accepted")
	}
}

func TestWellRestedSafeZoneHealingAndElapsedTimer(t *testing.T) {
	e, now := restTestPlayer("Wizard"), time.Now()
	for tick := 0; tick < 100; tick++ {
		e.updateSafeZoneRestLocked(.01, "lanternhold", now)
	}
	if math.Abs(e.WellRestedSeconds-1) > 1e-9 || e.Health != 12 || e.Mana != 11 || e.MaxHealth != 110 || e.MaxMana != 110 {
		t.Fatalf("one second did not give 10%% of final maxima: rest=%f hp=%d/%d mp=%d/%d", e.WellRestedSeconds, e.Health, e.MaxHealth, e.Mana, e.MaxMana)
	}
	if math.Abs(e.HpRegen-.11) > 1e-9 || math.Abs(e.ManaRegen-.11) > 1e-9 {
		t.Fatal("passive coefficient changed")
	}
	e.updateSafeZoneRestLocked(9, "lanternhold", now)
	if e.Health != 110 || e.Mana != 110 || math.Abs(e.WellRestedSeconds-10) > 1e-9 {
		t.Fatal("safe recovery/cap failed")
	}
	e.updateSafeZoneRestLocked(2.25, "", now)
	if math.Abs(e.WellRestedSeconds-7.75) > 1e-9 {
		t.Fatal("outside time not consumed")
	}
	e.updateSafeZoneRestLocked(1.5, "lanternhold", now)
	if math.Abs(e.WellRestedSeconds-9.25) > 1e-9 {
		t.Fatal("inside duration was consumed")
	}
	e.updateSafeZoneRestLocked(10000, "lanternhold", now)
	if e.WellRestedSeconds != MaxWellRestedSeconds {
		t.Fatal("two-hour cap failed")
	}
	for _, dt := range []float64{-1, 0, math.NaN(), math.Inf(1)} {
		e.updateSafeZoneRestLocked(dt, "", now)
	}
	if e.WellRestedSeconds != MaxWellRestedSeconds {
		t.Fatal("invalid elapsed time changed rest")
	}
}

func TestWellRestedDisconnectDeathAndExpiryDoNotRefill(t *testing.T) {
	e, now := restTestPlayer("Rogue"), time.Now()
	e.WellRestedSeconds = 123.75
	e.RecalculateStats()
	e.Health, e.Mana, e.Disconnected = 17, 0, true
	for _, zone := range []string{"", "lanternhold"} {
		e.updateSafeZoneRestLocked(100, zone, now)
	}
	if e.WellRestedSeconds != 123.75 || e.Health != 17 || e.Mana != 0 {
		t.Fatal("disconnected actor earned/spent rest or healed")
	}
	e.Disconnected, e.State, e.Health = false, "DEAD", 0
	e.updateSafeZoneRestLocked(100, "lanternhold", now)
	if e.WellRestedSeconds != 123.75 || e.Health != 0 || e.Mana != 0 {
		t.Fatal("corpse earned rest or regenerated")
	}
	e.updateSafeZoneRestLocked(200, "", now)
	if e.IsWellRested() || e.WellRestedSeconds != 0 || e.Health != 0 || e.Mana != 0 || e.State != "DEAD" {
		t.Fatal("expiry refilled a dead character")
	}
	e.State, e.Health, e.WellRestedSeconds = "IDLE", 50, 1
	e.RecalculateStats()
	e.Health, e.Mana = e.MaxHealth, e.MaxMana
	for i := 0; i < 100; i++ {
		e.RecalculateStats()
	}
	if e.Health != 110 || e.Mana != 110 {
		t.Fatal("recalculation clipped boosted capacity")
	}
	e.updateSafeZoneRestLocked(1, "", now)
	if e.Health != 100 || e.Mana != 100 || e.MaxHealth != 100 || e.MaxMana != 100 {
		t.Fatal("expiry did not clamp excess capacity")
	}
}

func TestWellRestedAllClassStatsApplyOnce(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(class, func(t *testing.T) {
			makePlayer := func() *Entity {
				e := restTestPlayer(class)
				e.Level = 30
				e.Equipment = map[string]Item{"chest": {Stats: map[string]int{"damage": 100, "defense": 100, "critChance": 20,
					"fireDamage": 20, "poisonDamage": 20, "holyDamage": 20, "healingDone": 20, "lifesteal": 20, "allResist": 20}}}
				e.RecalculateStats()
				return e
			}
			plain, rested := makePlayer(), makePlayer()
			rested.WellRestedSeconds = 7200
			boost := func(v int) int { return int(math.Floor(float64(v)*1.1 + 1e-9)) }
			for cycle := 0; cycle < 100; cycle++ {
				rested.RecalculateStats()
				if rested.Stats != (Stats{11, 11, 11, 11, 11}) || rested.BaseStats != plain.BaseStats ||
					rested.MaxHealth != boost(plain.MaxHealth) || rested.MaxMana != boost(plain.MaxMana) ||
					rested.Damage != boost(plain.Damage) || rested.Defense != boost(plain.Defense) || !reflect.DeepEqual(rested.Equipment, plain.Equipment) {
					t.Fatalf("integer/build stats compounded or omitted at cycle%d", cycle)
				}
				for name, values := range map[string][2]float64{
					"speed": {plain.Speed, rested.Speed}, "cast": {plain.CastSpeed, rested.CastSpeed},
					"hpRegen": {plain.HpRegen, rested.HpRegen}, "manaRegen": {plain.ManaRegen, rested.ManaRegen},
					"cdr": {plain.CooldownReduction, rested.CooldownReduction}, "fire": {plain.FireDamageBonus, rested.FireDamageBonus},
					"poison": {plain.PoisonDamageBonus, rested.PoisonDamageBonus}, "holy": {plain.HolyDamageBonus, rested.HolyDamageBonus},
					"healing": {plain.HealingDoneBonus, rested.HealingDoneBonus}, "leech": {plain.LifestealBonus, rested.LifestealBonus},
					"resist": {plain.AllResistBonus, rested.AllResistBonus}, "critical": {effectiveCriticalChance(plain, ""), effectiveCriticalChance(rested, "")},
				} {
					if math.Abs(values[1]-values[0]*1.1) > 1e-9 {
						t.Fatalf("%s omitted/compounded: %v", name, values)
					}
				}
				if math.Abs(rested.AttackSpeed-plain.AttackSpeed/1.1) > 1e-9 || rested.AttackCooldown != time.Duration(rested.AttackSpeed*float64(time.Second)) {
					t.Fatal("attack throughput incorrect")
				}
			}
		})
	}
}

func TestWellRestedCriticalAndCooldownCapsAndKillXP(t *testing.T) {
	e := restTestPlayer("Wizard")
	e.WellRestedSeconds, e.BaseStats.Intelligence = 2, 100
	e.RecalculateStats()
	if e.CooldownReduction != .5 {
		t.Fatal("ordinary cooldown cap exceeded")
	}
	e.TimeWarpActive = true
	e.RecalculateStats()
	if e.CooldownReduction > .8 {
		t.Fatal("Time Warp cooldown cap exceeded")
	}
	e.CritChanceBonus = .99
	if effectiveCriticalChance(e, "Fireball") != 1 {
		t.Fatal("critical cap exceeded")
	}
	if wellRestedKillXP(e, 40) != 50 || wellRestedKillXP(e, 0) != 0 {
		t.Fatal("kill bonus is not25%")
	}
	e.WellRestedSeconds = 0
	if wellRestedKillXP(e, 40) != 40 {
		t.Fatal("unrested kill boosted")
	}
}

func TestWellRestedFutureZoneUsesSameProtectionAndRecovery(t *testing.T) {
	w := &World{SafeZones: NewSafeZoneRegistry(), PvP: NewPvPSystem()}
	zone := SafeZone{ID: "future", MinX: 1000, MaxX: 1100, MinZ: 200, MaxZ: 300}
	if err := w.SafeZones.Register(zone); err != nil {
		t.Fatal(err)
	}
	e, other := restTestPlayer("Cleric"), restTestPlayer("Fighter")
	e.X, e.Z, other.X, other.Z, other.ID = 1050, 250, 1110, 250, "other"
	w.PvP.OpenWorldFlag[e.ID], w.PvP.OpenWorldFlag[other.ID] = true, true
	if w.CanDamage(e, other) || w.CanDamage(other, e) {
		t.Fatal("future safe zone permits flagged PvP")
	}
	enemy := &Entity{ID: "enemy", Type: TypeEnemy, X: 1110, Z: 250}
	if w.CanDamage(enemy, e) || w.CanDamage(e, enemy) {
		t.Fatal("safe zone permits PvE camping/damage")
	}
	e.updateSafeZoneRestLocked(1, w.SafeZoneAt(e.InstanceID, e.X, e.Z), time.Now())
	if e.SafeZoneID != "future" || e.Mana != 11 || e.WellRestedSeconds != 1 {
		t.Fatal("future zone not used for rest/recovery")
	}
	e.X = 1111
	if !w.CanDamage(enemy, e) || !w.CanDamage(other, e) {
		t.Fatal("outside protection did not end")
	}
}

func TestWellRestedManualQuestAndMaxLevelRewardsStayUnmultiplied(t *testing.T) {
	for _, level := range []int{1, 100} {
		w := newTestWorld()
		p := newTestPlayer("rested-quest", "Wizard")
		p.Level, p.MaxExperience, p.WellRestedSeconds = level, experienceRequiredForLevel(level), 7200
		p.X, p.Z, p.Gold = -20, 200, 123
		if level == MaxPlayerLevel {
			p.Experience = p.MaxExperience
		}
		w.AddEntity(p)
		w.GenerateDailyQuests(p.ID)
		if _, ok := w.PerformAcceptQuest(p.ID, "daily_skeleton"); !ok {
			t.Fatal("could not accept daily")
		}
		q := questByID(t, p, "daily_skeleton")
		for i := 0; i < q.MaxCount; i++ {
			w.UpdateQuestProgress(p, "Skeleton")
		}
		xp, gold := q.RewardXP, q.RewardGold
		if _, ok := w.PerformCompleteQuest(p.ID, q.ID); !ok {
			t.Fatal("manual turn-in failed")
		}
		q = questByID(t, p, q.ID)
		if q.GrantedXP+q.GrantedResonanceXP != xp || q.GrantedGold != gold || p.Gold != 123+gold {
			t.Fatal("quest payout received kill-only multiplier")
		}
		if level == MaxPlayerLevel && q.GrantedResonanceXP != xp {
			t.Fatal("existing cap conversion changed")
		}
	}
}

func TestWellRestedPartyBossKillBoostsOnlyRestedRecipient(t *testing.T) {
	for _, level := range []int{30, 100} {
		w := newTestWorld()
		instanceID := "rest-reward-contract"
		layout := DungeonLayout{Rooms: []DungeonRoom{{X: 0, Z: 0, Width: 40, Height: 40, Type: "boss"}}}
		w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, Layout: layout, Difficulty: DifficultyNormal,
			DungeonType: "verdant_bastion_catacombs", RunLevel: level, RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
		players := []*Entity{newTestPlayer("rested-member", "Wizard"), newTestPlayer("plain-member", "Wizard")}
		for i, p := range players {
			p.Level, p.MaxExperience, p.InstanceID = level, experienceRequiredForLevel(level), instanceID
			p.Inventory = make([]Item, MaxInventorySize)
			p.BaseStats = applyLevelGrowth(InitialPlayerStats(), level)
			if level == MaxPlayerLevel {
				p.Experience = p.MaxExperience
			}
			if i == 0 {
				p.WellRestedSeconds = 7200
			}
			p.RecalculateStats()
			w.AddEntity(p)
		}
		party := w.CreateParty(players[0].ID)
		if party == nil {
			t.Fatal("party creation failed")
		}
		if err := w.JoinParty(party.ID, players[1].ID); err != nil {
			t.Fatal(err)
		}
		rewards := make(chan RewardSummaryEvent, 2)
		w.OnEvent = func(kind string, value interface{}) {
			if kind == "reward_summary" {
				rewards <- value.(RewardSummaryEvent)
			}
		}
		boss := &Entity{ID: "rest-boss", Type: TypeEnemy, SubType: "RootboundWarden", Level: level, Health: 1, MaxHealth: 1, State: "IDLE", InstanceID: instanceID}
		w.AddEntity(boss)
		boss.Mu.Lock()
		w.handleDeath(boss, players[0], nil)
		boss.Mu.Unlock()
		byPlayer := map[string]RewardSummaryEvent{}
		for range players {
			select {
			case reward := <-rewards:
				byPlayer[reward.PlayerID] = reward
			case <-time.After(5 * time.Second):
				t.Fatal("missing actual boss reward")
			}
		}
		boosted, plain := byPlayer[players[0].ID], byPlayer[players[1].ID]
		if boosted.XP != int(float64(plain.XP)*1.25) || boosted.Gold != plain.Gold {
			t.Fatalf("wrong recipient boost or gold changed: boosted=%+v plain=%+v", boosted, plain)
		}
		if level == MaxPlayerLevel {
			players[0].Mu.RLock()
			total := players[0].ResonanceLevel*ResonanceXPPerLevel + players[0].ResonanceXP
			players[0].Mu.RUnlock()
			if total != boosted.XP {
				t.Fatal("kill bonus did not follow existing cap conversion")
			}
		}
	}
}
