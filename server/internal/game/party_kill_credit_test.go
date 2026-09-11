package game

import (
	"math"
	"testing"
)

func TestPartyKillCreditUsesDungeonPresenceAndTwoScreenOverworldRadius(t *testing.T) {
	for _, tc := range []struct {
		name, instance, memberInstance, state string
		dungeon, disconnected                 bool
		x, z                                  float64
		want                                  bool
	}{
		{name: "dungeon-near", instance: "run", memberInstance: "run", dungeon: true, want: true},
		{name: "dungeon-other-end", instance: "run", memberInstance: "run", dungeon: true, x: 9000, z: -9000, want: true},
		{name: "dungeon-downed", instance: "run", memberInstance: "run", dungeon: true, state: "DEAD", x: 9000, want: true},
		{name: "recalled-to-town", instance: "run", dungeon: true},
		{name: "different-run", instance: "run", memberInstance: "other", dungeon: true},
		{name: "disconnected", instance: "run", memberInstance: "run", dungeon: true, disconnected: true},
		{name: "overworld-same-position", want: true},
		{name: "overworld-boundary", x: OverworldPartyRewardRadius, want: true},
		{name: "overworld-outside", x: OverworldPartyRewardRadius + .01},
		{name: "overworld-diagonal-inside", x: 77, z: 77, want: true},
		{name: "overworld-diagonal-outside", x: 80, z: 80},
		{name: "overworld-downed-in-range", state: "DEAD", want: true},
		{name: "overworld-downed-outside", state: "DEAD", x: OverworldPartyRewardRadius + 1},
		{name: "overworld-disconnected", disconnected: true},
		{name: "overworld-wrong-instance", memberInstance: "run"},
		{name: "missing-instance-is-not-global", dungeon: true, x: 5000},
		{name: "invalid-coordinate", x: math.NaN()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			member := &Entity{Type: TypePlayer, X: tc.x, Z: tc.z,
				InstanceID: tc.memberInstance, State: tc.state, Disconnected: tc.disconnected}
			if got := eligibleForPartyKillCredit(member, tc.instance, tc.dungeon, 0, 0); got != tc.want {
				t.Fatalf("eligible=%v want=%v", got, tc.want)
			}
		})
	}
}

func TestPartyKillCreditRejectsMissingAndNonPlayerMembers(t *testing.T) {
	if eligibleForPartyKillCredit(nil, "run", true, 0, 0) ||
		eligibleForPartyKillCredit(&Entity{Type: TypeEnemy, InstanceID: "run"}, "run", true, 0, 0) {
		t.Fatal("non-player received party rewards")
	}
}

func TestPartyKillCreditOnlyRecognizesActualDungeonAndRaidTypes(t *testing.T) {
	for _, instanceType := range []string{"verdant_bastion_catacombs", "abyssal_well", "molten_core", "tempest_spire",
		"umbral_nexus", "weekly_raid", "earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid", "crypt"} {
		if !partyKillUsesDungeonPresence(instanceType) {
			t.Fatalf("missing dungeon type %q", instanceType)
		}
	}
	for _, instanceType := range []string{"", "overworld", "pvp_arena", "unknown"} {
		if partyKillUsesDungeonPresence(instanceType) {
			t.Fatalf("non-dungeon %q gained instance-wide rewards", instanceType)
		}
	}
}

func TestOverworldDeathPipelineSharesXPAndQuestCreditOnlyWithinTwoScreens(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	var members []*Entity
	for _, class := range []string{"Fighter", "Cleric", "Wizard", "Rogue"} {
		p := newTestPlayer("overworld-credit-"+class, class)
		p.Level, p.Experience, p.MaxExperience = 30, 0, experienceRequiredForLevel(30)
		p.BaseStats = applyLevelGrowth(InitialPlayerStats(), 30)
		p.Inventory = make([]Item, MaxInventorySize)
		p.Quests = []Quest{{ID: "nearby-kills", Type: "KILL", Target: "Imp", MaxCount: 1, Accepted: true}}
		w.AddEntity(p)
		members = append(members, p)
	}
	party := w.CreateParty(members[0].ID)
	for _, member := range members[1:] {
		if err := w.JoinParty(party.ID, member.ID); err != nil {
			t.Fatal(err)
		}
	}
	members[1].X = OverworldPartyRewardRadius
	members[2].X = OverworldPartyRewardRadius + .01
	members[3].InstanceID = "other-world"
	enemy := &Entity{ID: "overworld-credit-imp", Type: TypeEnemy, SubType: "Imp", Level: 30,
		Health: 1, MaxHealth: 1, State: "IDLE"}
	w.AddEntity(enemy)
	enemy.Mu.Lock()
	w.handleDeath(enemy, members[0], nil)
	enemy.Mu.Unlock()
	w.StopBackground() // Drain the real asynchronous reward pipeline before assertions.
	for index, member := range members {
		q := questByID(t, member, "nearby-kills")
		if index < 2 {
			if member.Experience <= 0 || member.Gold <= 0 || q.Count != 1 || q.Completed {
				t.Fatalf("nearby %s did not receive shared rewards and unclaimed credit", member.SubType)
			}
		} else if member.Experience != 0 || member.Gold != 0 || q.Count != 0 {
			t.Fatalf("outside/wrong-instance %s received rewards", member.SubType)
		}
	}
}
