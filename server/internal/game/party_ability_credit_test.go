package game

import (
	"fmt"
	"testing"
)

// Prepared lethal targets exercise real class dispatch and its world-lock
// ownership. This proves reward plumbing, not dungeon combat balance.
func TestPartyAbilityKillsShareCreditAcrossTheDungeon(t *testing.T) {
	for _, spec := range []struct {
		class, skill string
		explosive    bool
	}{
		{"Fighter", "Whirlwind", false},
		{"Wizard", "Frost Nova", false},
		{"Rogue", "Rain of Arrows", false},
		{"Cleric", "Smite", false},
		{"Cleric", "Smite", true},
	} {
		t.Run(fmt.Sprintf("%s/explosive=%v", spec.skill, spec.explosive), func(t *testing.T) {
			w, caster, enemy := directSkillWallFixture(spec.class, true)
			defer w.StopBackground()
			w.InstanceLayouts[caster.InstanceID].DungeonType = "verdant_bastion_catacombs"
			caster.UnlockedSkills = []string{spec.skill}
			caster.Mana, caster.MaxMana = 1000, 1000
			enemy.SubType, enemy.Level, enemy.Health, enemy.MaxHealth = "Imp", 30, 1, 1
			members := []*Entity{caster}
			for index, class := range []string{"Fighter", "Wizard", "Cleric"} {
				member := newTestPlayer(fmt.Sprintf("remote-ally-%d", index), class)
				member.InstanceID = caster.InstanceID
				member.X, member.Z = caster.X+1000+float64(index), caster.Z
				if index == 2 {
					member.State, member.Health = "DEAD", 0
				}
				w.AddEntity(member)
				members = append(members, member)
			}
			for _, member := range members {
				member.Level, member.Experience, member.MaxExperience = 30, 0, experienceRequiredForLevel(30)
				member.Quests = []Quest{{ID: "ability-party-kills", Type: "KILL", Target: "Imp", MaxCount: 3, Accepted: true}}
			}
			party := w.CreateParty(caster.ID)
			for _, member := range members[1:] {
				if err := w.JoinParty(party.ID, member.ID); err != nil {
					t.Fatal(err)
				}
			}
			want := 1
			if spec.explosive {
				caster.ActiveUniqueEffects = []string{"explosive"}
				caster.Damage = 2000
				w.AddEntity(&Entity{ID: "explosion-only-imp", Type: TypeEnemy, SubType: "Imp",
					InstanceID: enemy.InstanceID, X: enemy.X + 2, Z: enemy.Z,
					State: "IDLE", Level: 30, Health: 1, MaxHealth: 1})
				want = 2
			}
			result := w.PerformAbility(caster.ID, enemy.X, enemy.Z, enemy.ID, spec.skill)
			if !result.Accepted || enemy.State != "DEAD" {
				t.Fatalf("ordinary dispatch did not kill the prepared target: %+v state=%s", result, enemy.State)
			}
			w.StopBackground()
			for _, member := range members {
				q := questByID(t, member, "ability-party-kills")
				if q.Count != want || q.Completed || member.Experience <= 0 || member.Gold <= 0 {
					t.Fatalf("%s missing shared, unclaimed rewards: count=%d want=%d complete=%v XP=%d gold=%d",
						member.ID, q.Count, want, q.Completed, member.Experience, member.Gold)
				}
			}
		})
	}
}
