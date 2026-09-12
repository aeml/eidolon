package game

import (
	"testing"
	"time"
)

func TestPaidUnstoppableRecoveryClearsOnlyTravelState(t *testing.T) {
	for _, mode := range []string{"recall", "respawn", "death", "cleared flag"} {
		t.Run(mode, func(t *testing.T) {
			w, p, enemy, _ := rawWoundOutgoingFixture(t, "lunge")
			p.SubType, p.UnlockedSkills = "Fighter", []string{"Charge"}
			p.SkillRunes = map[string]string{"Charge": "charge_unstoppable"}
			p.TalentRanks = map[string]int{"FTR_30": 5}
			if result := w.PerformAbility(p.ID, p.X+20, p.Z, "", "Charge"); !result.Accepted {
				t.Fatalf("paid charge rejected: %+v", result)
			}
			if !p.IsCharging || !p.CCImmune || p.ChargeEffectDurationBonus <= 0 {
				t.Fatal("cast did not create travel state")
			}
			cooldown := p.Cooldowns["Charge"]
			// The in-flight rune, not a newly selected loadout, owns immunity.
			p.SkillRunes["Charge"] = "charge_momentum"
			if mode == "cleared flag" {
				p.IsCharging = false
			}
			switch mode {
			case "recall", "cleared flag":
				if err := w.PerformRecall(p.ID); err != nil {
					t.Fatal(err)
				}
			case "respawn":
				if err := w.PerformRespawn(p.ID); err != nil {
					t.Fatal(err)
				}
			case "death":
				p.Mu.Lock()
				w.handleDeath(p, nil, &deferredActions{})
				p.Mu.Unlock()
			}
			if p.IsCharging || p.CCImmune || !p.CCImmuneEndTime.IsZero() || p.ChargeRuneID != "" ||
				p.ChargeSkillName != "" || p.ChargeEffectDurationBonus != 0 {
				t.Fatalf("orphan travel state: charging=%v immunity=%v rune=%q", p.IsCharging, p.CCImmune, p.ChargeRuneID)
			}
			if p.Cooldowns["Charge"] != cooldown {
				t.Fatal("recovery reset the paid cooldown")
			}
			health := enemy.Health
			w.updateEntity(p, 1, nil, &deferredActions{})
			if enemy.Health != health || p.RuneArmorBuff != 0 {
				t.Fatal("canceled charge produced an impact or armor")
			}
		})
	}
}

func TestSceneRecoveryPreservesUnrelatedImmunityAndEarnedArmor(t *testing.T) {
	for _, rune := range []string{"", "charge_momentum", "charge_shockwave"} {
		p := &Entity{CCImmune: true, CCImmuneEndTime: time.Now().Add(time.Minute),
			RuneArmorBuff: .2, RuneArmorBuffEndTime: time.Now().Add(time.Second),
			IsCharging: true, ChargeRuneID: rune, ChargeSkillName: "Charge"}
		immunityEnd, armorEnd := p.CCImmuneEndTime, p.RuneArmorBuffEndTime
		resetSceneMovementLocked(p)
		if !p.CCImmune || p.CCImmuneEndTime != immunityEnd || p.RuneArmorBuff != .2 || p.RuneArmorBuffEndTime != armorEnd {
			t.Fatal("scene recovery removed state not owned by the canceled charge")
		}
	}
}

func TestPaidUnstoppableImpactClearsTravelDeadlineButKeepsArmor(t *testing.T) {
	w, p, _, _ := rawWoundOutgoingFixture(t, "lunge")
	p.SubType, p.UnlockedSkills = "Fighter", []string{"Charge"}
	p.SkillRunes = map[string]string{"Charge": "charge_unstoppable"}
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Charge"); !result.Accepted {
		t.Fatal(result)
	}
	w.updateEntity(p, .1, nil, &deferredActions{})
	if p.CCImmune || !p.CCImmuneEndTime.IsZero() || p.IsCharging || p.RuneArmorBuff != .2 ||
		!time.Now().Before(p.RuneArmorBuffEndTime) {
		t.Fatal("impact mixed travel immunity with earned armor")
	}
}

func TestNearDeathAnimationQAClearsPaidUnstoppableArmor(t *testing.T) {
	w, p, _, _ := rawWoundOutgoingFixture(t, "lunge")
	p.SubType, p.UnlockedSkills = "Fighter", []string{"Charge"}
	p.SkillRunes = map[string]string{"Charge": "charge_unstoppable"}
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Charge"); !result.Accepted {
		t.Fatal(result)
	}
	w.updateEntity(p, .1, nil, &deferredActions{})
	if p.RuneArmorBuff != .2 {
		t.Fatal("paid armor did not activate")
	}
	if !w.PreparePlayerForAnimationQA(p.ID, false, false, true) {
		t.Fatal("explicit death preparation rejected")
	}
	if p.RuneArmorBuff != 0 || !p.RuneArmorBuffEndTime.IsZero() || p.Health != 1 {
		t.Fatal("explicit near-death QA retained temporary armor")
	}
}
