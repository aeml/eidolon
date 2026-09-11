package game

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func paidRenewalRecipient(t *testing.T, kind EntityType) (*World, *Entity, *Entity) {
	t.Helper()
	w, caster, _, target := clericDurationFixture(t, "Healing Light")
	target.Type = kind
	caster.SkillRunes = map[string]string{"Healing Light": "healinglight_renewal"}
	caster.TalentRanks = map[string]int{"CLR_04": 5, "CLR_30": 5, "CLR_33": 5, "CLR_39": 5}
	mana := caster.Mana
	if result := w.PerformAbility(caster.ID, target.X, target.Z, target.ID, "Healing Light"); !result.Accepted || caster.Mana >= mana {
		t.Fatalf("paid Renewal rejected: %+v", result)
	}
	if !target.HealingLightHoTActive || target.HealingLightHoTAmount <= 0 || target.HealingLightHoTTicksRemaining != 7 {
		t.Fatal("paid trained Renewal not applied")
	}
	return w, caster, target
}

func TestPaidRenewalParallelWorldRecipients(t *testing.T) {
	w, firstCaster, first := paidRenewalRecipient(t, TypePlayer)
	secondCaster := newTestPlayer("parallel-renewal-caster", "Cleric")
	secondCaster.X, secondCaster.Z, secondCaster.InstanceID = firstCaster.X, firstCaster.Z, firstCaster.InstanceID
	secondCaster.UnlockedSkills = []string{"Healing Light"}
	secondCaster.SkillRunes = map[string]string{"Healing Light": "healinglight_renewal"}
	w.AddEntity(secondCaster)
	second := newTestPlayer("parallel-renewal-npc", "Fighter")
	second.X, second.Z, second.InstanceID = first.X, first.Z+1, first.InstanceID
	second.Type, second.Health, second.MaxHealth = TypeNPC, 100, 10000
	w.AddEntity(second)
	if result := w.PerformAbility(secondCaster.ID, second.X, second.Z, second.ID, "Healing Light"); !result.Accepted || !second.HealingLightHoTActive {
		t.Fatal("second ordinary paid Renewal rejected")
	}
	for _, actor := range w.Entities {
		actor.Stunned, actor.StunEndTime = true, time.Now().Add(time.Minute)
	}
	first.LastHealingLightHoTTick, second.LastHealingLightHoTTick = time.Now().Add(-time.Second), time.Now().Add(-time.Second)
	firstBefore, secondBefore := first.Health, second.Health
	firstAmount, secondAmount := first.HealingLightHoTAmount, second.HealingLightHoTAmount
	var mu sync.Mutex
	events := make(map[string]int)
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "heal" {
			mu.Lock()
			event := data.(HealEvent)
			events[event.TargetID] += event.Amount
			mu.Unlock()
		}
	}
	w.Update(.01)
	if first.Health != firstBefore+firstAmount || second.Health != secondBefore+secondAmount || events[first.ID] != firstAmount || events[second.ID] != secondAmount {
		t.Fatal("parallel world update skipped or duplicated recipient healing/events")
	}
}

func TestPaidRenewalTicksOnEveryFriendlyRecipient(t *testing.T) {
	for _, kind := range []EntityType{TypePlayer, TypeNPC} {
		for _, stunned := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/stunned=%t", kind, stunned), func(t *testing.T) {
				w, caster, target := paidRenewalRecipient(t, kind)
				amount, before := target.HealingLightHoTAmount, target.Health
				caster.TalentRanks = nil
				target.Stunned, target.StunEndTime = stunned, time.Now().Add(time.Minute)
				var events []HealEvent
				w.OnEvent = func(kind string, data interface{}) {
					if kind == "heal" {
						events = append(events, data.(HealEvent))
					}
				}
				for tick := 1; tick <= 7; tick++ {
					target.LastHealingLightHoTTick = time.Now().Add(-time.Second)
					w.updateEntity(target, 0, nil, &deferredActions{})
					if target.Health != before+tick*amount || target.HealingLightHoTTicksRemaining != 7-tick {
						t.Fatalf("recipient tick%d not delivered: hp=%d ticks=%d", tick, target.Health, target.HealingLightHoTTicksRemaining)
					}
					w.updateEntity(target, 0, nil, &deferredActions{})
					if target.Health != before+tick*amount {
						t.Fatal("recipient healed twice before next tick")
					}
				}
				if target.HealingLightHoTActive || target.HealingLightHoTSourceID != "" || len(events) != 7 {
					t.Fatal("completed Renewal retained state or lost events")
				}
				for _, event := range events {
					if event.SourceID != caster.ID || event.TargetID != target.ID || event.InstanceID != target.InstanceID || event.Amount != amount || event.Kind != "healing_light_hot" {
						t.Fatalf("incorrect recipient heal event: %+v", event)
					}
				}
			})
		}
	}
}

func TestPaidRenewalExpiredDeadlineCannotDeliverLateTicks(t *testing.T) {
	for _, kind := range []EntityType{TypePlayer, TypeNPC} {
		t.Run(string(kind), func(t *testing.T) {
			w, _, target := paidRenewalRecipient(t, kind)
			before := target.Health
			target.HealingLightHoTEndTime = time.Now().Add(-time.Second)
			target.LastHealingLightHoTTick = time.Now().Add(-2 * time.Second)
			w.updateEntity(target, 0, nil, &deferredActions{})
			if target.Health != before || target.HealingLightHoTActive || target.HealingLightHoTTicksRemaining != 0 || target.HealingLightHoTSourceID != "" {
				t.Fatal("expired Renewal healed or retained a tick budget")
			}
		})
	}
}

func TestPaidRenewalReceivingLimitsAndBoundary(t *testing.T) {
	for _, kind := range []EntityType{TypePlayer, TypeNPC} {
		for _, scenario := range []string{"poison", "clamp", "full", "dead", "exact", "missing"} {
			t.Run(string(kind)+"/"+scenario, func(t *testing.T) {
				w, _, target := paidRenewalRecipient(t, kind)
				now := time.Now()
				amount := target.HealingLightHoTAmount
				target.LastHealingLightHoTTick = now.Add(-time.Second)
				want := amount
				switch scenario {
				case "poison":
					target.Poisoned = true
					want = amount / 2
				case "clamp":
					target.Health = target.MaxHealth - 1
					want = 1
				case "full":
					target.Health = target.MaxHealth
					want = 0
				case "dead":
					target.State, target.Health = "DEAD", 0
					want = 0
				case "exact":
					target.HealingLightHoTEndTime = now
					target.HealingLightHoTTicksRemaining = 1
				case "missing":
					target.HealingLightHoTEndTime = time.Time{}
					want = 0
				}
				before, events, observedHeal := target.Health, 0, 0
				w.OnEvent = func(kind string, data interface{}) {
					if kind == "heal" {
						events++
						observedHeal += data.(HealEvent).Amount
					}
				}
				w.tickRenewalLocked(target, now)
				if target.Health-before != want || observedHeal != want {
					t.Fatal("Renewal receiving limit or event amount incorrect")
				}
				if want == 0 && events != 0 || want > 0 && events != 1 {
					t.Fatal("Renewal emitted wrong number of heal events")
				}
				if scenario == "dead" || scenario == "exact" || scenario == "missing" {
					if target.HealingLightHoTActive || target.HealingLightHoTTicksRemaining != 0 || target.HealingLightHoTAmount != 0 || !target.HealingLightHoTEndTime.IsZero() || target.HealingLightHoTSourceID != "" {
						t.Fatal("finished Renewal retained applied state")
					}
				} else if target.HealingLightHoTTicksRemaining != 6 {
					t.Fatal("a due tick did not consume exactly one budget entry")
				}
			})
		}
	}
}
