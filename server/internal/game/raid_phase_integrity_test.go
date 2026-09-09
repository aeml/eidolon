package game

import (
	"fmt"
	"reflect"
	"sync"
	"testing"
)

// This regression uses the ordinary outgoing-damage calculation. The fixture
// controls damage size, not quest credit, timestamps or phase state transitions.
func TestDarkKingBurstRetainsEveryEidolonIntervention(t *testing.T) {
	for _, burst := range []int{600, 800} {
		t.Run(fmt.Sprint(burst), func(t *testing.T) {
			w := &World{}
			boss := &Entity{ID: "king", Type: TypeEnemy, SubType: "UmbraPrime", InstanceID: "raid",
				State: "IDLE", Health: 1000, MaxHealth: 1000}
			player := &Entity{ID: "raider", Type: TypePlayer, InstanceID: "raid", State: "IDLE",
				Health: 40, MaxHealth: 100, Mana: 0, MaxMana: 100}
			var eidolons []string
			w.OnEvent = func(kind string, payload interface{}) {
				if kind == "raid_phase" {
					eidolons = append(eidolons, payload.(RaidPhaseEvent).Eidolon)
				}
			}
			w.updateDarkKingPhase(boss, []*Entity{player})
			damage, _ := CalculateFinalDamage(player, boss, burst, "physical")
			boss.Health -= damage
			for step := 0; step < 4; step++ {
				w.updateDarkKingPhase(boss, []*Entity{player})
			}
			want := []string{"Orun", "Neris", "Pyralis"}
			if burst == 800 {
				want = append(want, "Aeral")
			}
			if !reflect.DeepEqual(eidolons, want) {
				t.Fatalf("burst=%d skipped a required intervention: got %v want %v (HP=%d raidPhase=%d)",
					burst, eidolons, want, boss.Health, boss.RaidPhase)
			}
			if player.Health != 65 {
				t.Fatalf("Neris's actual quarter-health aid was lost: HP=%d", player.Health)
			}
			if boss.Health != 1000-burst-80 {
				t.Fatalf("Pyralis's sear was lost: HP=%d", boss.Health)
			}
		})
	}
}

func TestDarkKingActualDamageStopsAtEveryPhaseBeforeLethal(t *testing.T) {
	w := &World{}
	boss := &Entity{Type: TypeEnemy, SubType: "UmbraPrime", InstanceID: "raid", State: "IDLE", Health: 1000, MaxHealth: 1000}
	player := &Entity{Type: TypePlayer, InstanceID: "raid", State: "IDLE", Health: 40, MaxHealth: 100, MaxMana: 100}
	var phases []int
	w.OnEvent = func(kind string, payload interface{}) {
		if kind == "raid_phase" {
			phases = append(phases, payload.(RaidPhaseEvent).Phase)
		}
	}
	if got := applyFinalDamage(player, boss, 10000, "physical"); got != 0 || boss.Health != 1000 {
		t.Fatal("damage consumed the unannounced opening", got, boss.Health)
	}
	w.updateDarkKingPhase(boss, []*Entity{player})
	for phase, floor := range []int{750, 500, 250} {
		before := boss.Health
		got := applyFinalDamage(player, boss, 10000, "physical")
		if boss.Health != floor || got != before-floor || boss.RaidPhase != phase+1 {
			t.Fatalf("phase %d: damage=%d HP=%d floor=%d", phase+1, got, boss.Health, floor)
		}
		if got := applyFinalDamage(player, boss, 10000, "fire"); got != 0 {
			t.Fatal("second hit skipped the pending handoff", got)
		}
		w.updateDarkKingPhase(boss, []*Entity{player})
		if boss.RaidPhase != phase+2 {
			t.Fatal("phase did not open after its handoff", boss.RaidPhase)
		}
	}
	if !reflect.DeepEqual(phases, []int{1, 2, 3, 4}) || player.Health != 65 || player.Mana != 100 {
		t.Fatal("full aid chain did not complete", phases, player.Health, player.Mana)
	}
	if damage := applyFinalDamage(player, boss, 10000, "holy"); damage <= 0 || boss.Health > 0 {
		t.Fatal("phase four did not permit ordinary lethal damage", damage, boss.Health)
	}
}

func TestDarkKingConcurrentHitsRespectOneBoundary(t *testing.T) {
	boss := &Entity{Type: TypeEnemy, SubType: "UmbraPrime", Health: 1000, MaxHealth: 1000, RaidPhase: 1}
	player := &Entity{Type: TypePlayer}
	var group sync.WaitGroup
	total := 0
	for range 32 {
		group.Add(1)
		go func() {
			defer group.Done()
			boss.Mu.Lock()
			total += applyFinalDamage(player, boss, 10000, "physical")
			boss.Mu.Unlock()
		}()
	}
	group.Wait()
	if boss.Health != 750 || total != 250 {
		t.Fatal("concurrent sources crossed an unopened phase", boss.Health, total)
	}
}

func TestDarkKingDamageOverTimeReportsOnlyAppliedDamage(t *testing.T) {
	w := &World{}
	boss := &Entity{Type: TypeEnemy, SubType: "UmbraPrime", Health: 1000, MaxHealth: 1000, RaidPhase: 1}
	var amounts []int
	w.OnEvent = func(kind string, payload interface{}) {
		if kind == "damage" {
			amounts = append(amounts, payload.(DamageEvent).Amount)
		}
	}
	boss.Mu.Lock()
	w.applyDamageOverTimeLocked(boss, "", 10000, "bleed", "physical", nil)
	w.applyDamageOverTimeLocked(boss, "", 10000, "poison", "poison", nil)
	boss.Mu.Unlock()
	if boss.Health != 750 || !reflect.DeepEqual(amounts, []int{250, 0}) {
		t.Fatal("DoT bypassed phase or reported unapplied damage", boss.Health, amounts)
	}
}

func TestDarkKingPhaseGateDoesNotChangeOtherDamage(t *testing.T) {
	for _, target := range []*Entity{nil, {Type: TypeEnemy, SubType: "Skeleton", Health: 1000, MaxHealth: 1000},
		{Type: TypePlayer, SubType: "UmbraPrime", Health: 1000, MaxHealth: 1000},
		{Type: TypeEnemy, SubType: "UmbraPrime", Health: 250, MaxHealth: 1000, RaidPhase: 4}} {
		if got := damageWithinDarkKingPhase(target, 2000); got != 2000 {
			t.Fatal("unrelated or final-phase damage changed", got)
		}
	}
}

func TestDarkKingAidRequiresALivingConnectedPlayer(t *testing.T) {
	for _, excluded := range []*Entity{
		{Type: TypePlayer, State: "DEAD", Health: 0},
		{Type: TypePlayer, State: "IDLE", Health: 0},
		{Type: TypePlayer, State: "IDLE", Health: 40, Disconnected: true},
		{Type: TypeNPC, State: "IDLE", Health: 40},
	} {
		excluded.InstanceID, excluded.MaxHealth = "raid", 100
		boss := &Entity{Type: TypeEnemy, SubType: "UmbraPrime", State: "IDLE", InstanceID: "raid", Health: 750, MaxHealth: 1000, RaidPhase: 1}
		w := &World{}
		w.updateDarkKingPhase(boss, []*Entity{excluded})
		if boss.RaidPhase != 1 {
			t.Fatal("ineligible actor consumed the phase", excluded.Type, excluded.State)
		}
		before := excluded.Health
		living := &Entity{Type: TypePlayer, State: "IDLE", InstanceID: "raid", Health: 40, MaxHealth: 100}
		w.updateDarkKingPhase(boss, []*Entity{excluded, living})
		if living.Health != 65 || excluded.Health != before {
			t.Fatal("aid revived or healed an ineligible actor", living.Health, excluded.Health)
		}
	}
}

func TestDarkKingDamageModifiersWaitForAnnouncedPhase(t *testing.T) {
	player := &Entity{Type: TypePlayer}
	boss := &Entity{Type: TypeEnemy, SubType: "UmbraPrime", Health: 250, MaxHealth: 1000, RaidPhase: 1}
	if damage, _ := CalculateFinalDamage(player, boss, 100, "physical"); damage != 100 {
		t.Fatal("unannounced phase amplified damage", damage)
	}
	boss.RaidPhase = 4
	if damage, _ := CalculateFinalDamage(player, boss, 100, "physical"); damage != 135 {
		t.Fatal("announced Aeral aid did not amplify damage", damage)
	}
}
