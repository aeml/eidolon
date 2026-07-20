package game

import (
	"reflect"
	"testing"
	"time"
)

func TestStateForPlayerPreservesAnimationAndEffectAuthority(t *testing.T) {
	now := time.Now()
	end := now.Add(10 * time.Second)
	viewer := &Entity{ID: "viewer", Type: TypePlayer, X: 0, Z: 0}
	source := &Entity{
		ID:                        "animated-cleric",
		Type:                      TypePlayer,
		SubType:                   "Cleric",
		X:                         5,
		Z:                         5,
		State:                     "ATTACKING",
		SkillRunes:                map[string]string{"Spirit Guardians": "spirits_expanded"},
		SpiritsActive:             true,
		SpiritsBoosted:            true,
		SpiritEndTime:             end,
		GuardianEmbraceActive:     true,
		GuardianEmbraceEndTime:    end,
		BlessingResolveActive:     true,
		BlessingResolveEndTime:    end,
		DivineInterventionActive:  true,
		DivineInterventionEndTime: end,
		ArcaneShieldActive:        true,
		ArcaneShieldHP:            123,
		ArcaneShieldEndTime:       end,
		TimeWarpActive:            true,
		TimeWarpEndTime:           end,
		SpellFocusActive:          true,
		SpellFocusEndTime:         end,
		SwiftActive:               true,
		SwiftEndTime:              end,
		IronFortressActive:        true,
		IronFortressEndTime:       end,
		GuardianRoarActive:        true,
		GuardianRoarEndTime:       end,
		BerserkerModeActive:       true,
		BerserkerModeEndTime:      end,
		LastStandActive:           true,
		LastStandEndTime:          end,
		SerratedEdgesActive:       true,
		SerratedEdgesEndTime:      end,
		PoisonCoatingActive:       true,
		PoisonCoatingEndTime:      end,
		StealthActive:             true,
		StealthEndTime:            end,
		ZealActive:                true,
		ZealEndTime:               end,
		Stunned:                   true,
		StunEndTime:               end,
		Slowed:                    true,
		SlowEndTime:               end,
		SlowFactor:                0.35,
		Rooted:                    true,
		RootEndTime:               end,
		WeakPointMarked:           true,
		WeakPointEndTime:          end,
		MarkWeakness:              true,
		MarkWeaknessEndTime:       end,
		Bleeding:                  true,
		BleedEndTime:              end,
		BleedDamage:               17,
		Poisoned:                  true,
		PoisonEndTime:             end,
		PoisonDamage:              19,
	}

	w := NewWorld(nil)
	w.AddEntity(viewer)
	w.AddEntity(source)

	got := w.GetStateForPlayer(viewer.ID, 200)[source.ID]
	if got == nil {
		t.Fatal("expected nearby animated player in replicated state")
	}

	fields := []string{
		"SpiritsActive", "SpiritsBoosted", "SpiritEndTime",
		"GuardianEmbraceActive", "GuardianEmbraceEndTime",
		"BlessingResolveActive", "BlessingResolveEndTime",
		"DivineInterventionActive", "DivineInterventionEndTime",
		"ArcaneShieldActive", "ArcaneShieldHP", "ArcaneShieldEndTime",
		"TimeWarpActive", "TimeWarpEndTime", "SpellFocusActive", "SpellFocusEndTime",
		"SwiftActive", "SwiftEndTime", "IronFortressActive", "IronFortressEndTime",
		"GuardianRoarActive", "GuardianRoarEndTime", "BerserkerModeActive", "BerserkerModeEndTime",
		"LastStandActive", "LastStandEndTime", "SerratedEdgesActive", "SerratedEdgesEndTime",
		"PoisonCoatingActive", "PoisonCoatingEndTime", "StealthActive", "StealthEndTime",
		"ZealActive", "ZealEndTime", "Stunned", "StunEndTime", "Slowed", "SlowEndTime",
		"SlowFactor", "Rooted", "RootEndTime", "WeakPointMarked", "WeakPointEndTime",
		"MarkWeakness", "MarkWeaknessEndTime", "Bleeding", "BleedEndTime", "BleedDamage",
		"Poisoned", "PoisonEndTime", "PoisonDamage",
	}
	wantValue := reflect.ValueOf(source).Elem()
	gotValue := reflect.ValueOf(got).Elem()
	for _, field := range fields {
		if !reflect.DeepEqual(gotValue.FieldByName(field).Interface(), wantValue.FieldByName(field).Interface()) {
			t.Errorf("replicated state lost %s: got %v want %v", field,
				gotValue.FieldByName(field).Interface(), wantValue.FieldByName(field).Interface())
		}
	}
	if !reflect.DeepEqual(got.SkillRunes, source.SkillRunes) {
		t.Fatalf("replicated state lost skill runes: got %v want %v", got.SkillRunes, source.SkillRunes)
	}
	source.SkillRunes["Spirit Guardians"] = "spirits_vengeful"
	if got.SkillRunes["Spirit Guardians"] != "spirits_expanded" {
		t.Fatal("replicated skill rune map aliases mutable world state")
	}
}

func TestStateForPlayerPreservesSummonOwner(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(&Entity{ID: "viewer", Type: TypePlayer})
	w.AddEntity(&Entity{
		ID:      "summon-seraph",
		Type:    TypeNPC,
		SubType: "AvengingSeraph",
		OwnerID: "player-cleric",
		X:       2,
		Z:       2,
	})

	got := w.GetStateForPlayer("viewer", 200)["summon-seraph"]
	if got == nil || got.OwnerID != "player-cleric" {
		t.Fatalf("replicated summon owner missing: %#v", got)
	}
}

func TestPersistentAnimationQADurationIsOneShot(t *testing.T) {
	player := &Entity{QAPersistentDuration: 45 * time.Second}
	if got := consumePersistentDuration(player, 10*time.Second); got != 45*time.Second {
		t.Fatalf("expected QA duration override, got %s", got)
	}
	if player.QAPersistentDuration != 0 {
		t.Fatal("expected QA duration override to be consumed")
	}
	if got := consumePersistentDuration(player, 10*time.Second); got != 10*time.Second {
		t.Fatalf("expected normal duration after one use, got %s", got)
	}
}
