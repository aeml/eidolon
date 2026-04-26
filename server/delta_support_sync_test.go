package main

import (
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestEntitySnapshotTracksSpiritGuardiansForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:           "cleric-1",
		Type:         game.TypePlayer,
		SubType:      "Cleric",
		State:        "IDLE",
		TalentRanks:  map[string]int{},
		SpiritsActive: true,
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if !snapshot.SpiritsActive {
		t.Fatal("expected snapshot to track spiritsActive")
	}

	entity.SpiritsActive = false
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected spirit guardians delta change to be detected")
	}

	entity.SpiritsActive = true
	snapshot = entityToSnapshot(entity)
	entity.SpiritsActive = true
	if hasEntityChanged(entity, snapshot) {
		t.Fatal("expected unchanged spirit guardians state to stay delta-stable")
	}
}

func TestEntitySnapshotTracksBoostedSpiritGuardiansForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:             "cleric-boosted",
		Type:           game.TypePlayer,
		SubType:        "Cleric",
		State:          "IDLE",
		TalentRanks:    map[string]int{},
		SpiritsActive:  true,
		SpiritsBoosted: false,
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.SpiritsBoosted {
		t.Fatal("expected initial snapshot to preserve non-boosted spirit state")
	}

	entity.SpiritsBoosted = true
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected spirit guardians boost delta change to be detected")
	}

	snapshot = entityToSnapshot(entity)
	if !snapshot.SpiritsBoosted {
		t.Fatal("expected snapshot to track boosted spirit guardians")
	}
	if hasEntityChanged(entity, snapshot) {
		t.Fatal("expected unchanged boosted spirit guardians state to stay delta-stable")
	}
}

func TestEntitySnapshotTracksDebuffFlagsForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:       "player-debuffs",
		Type:     game.TypePlayer,
		SubType:  "Fighter",
		State:    "IDLE",
		TalentRanks: map[string]int{},
		Stunned:  false,
		Slowed:   false,
		Rooted:   false,
		Bleeding: false,
		Poisoned: false,
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}

	entity.Stunned = true
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected stunned delta change to be detected")
	}

	entity.Stunned = false
	entity.Slowed = true
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected slowed delta change to be detected")
	}

	entity.Slowed = false
	entity.Rooted = true
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected rooted delta change to be detected")
	}

	entity.Rooted = false
	entity.Bleeding = true
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected bleeding delta change to be detected")
	}

	entity.Bleeding = false
	entity.Poisoned = true
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected poisoned delta change to be detected")
	}

	snapshot = entityToSnapshot(entity)
	if !snapshot.Poisoned {
		t.Fatal("expected snapshot to track poisoned state")
	}
	if hasEntityChanged(entity, snapshot) {
		t.Fatal("expected unchanged debuff flags to stay delta-stable")
	}
}

func TestEntitySnapshotTracksRootDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:          "player-rooted",
		Type:        game.TypePlayer,
		SubType:     "Rogue",
		State:       "IDLE",
		TalentRanks: map[string]int{},
		Rooted:      true,
		RootEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.RootDuration <= 0 {
		t.Fatal("expected snapshot to track root duration")
	}

	entity.RootEndTime = time.Now().Add(1500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected root duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksStunDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:          "player-stunned",
		Type:        game.TypePlayer,
		SubType:     "Wizard",
		State:       "IDLE",
		TalentRanks: map[string]int{},
		Stunned:     true,
		StunEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.StunDuration <= 0 {
		t.Fatal("expected snapshot to track stun duration")
	}

	entity.StunEndTime = time.Now().Add(1500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected stun duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksBleedDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:           "player-bleeding",
		Type:         game.TypePlayer,
		SubType:      "Rogue",
		State:        "IDLE",
		TalentRanks:  map[string]int{},
		Bleeding:     true,
		BleedEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.BleedDuration <= 0 {
		t.Fatal("expected snapshot to track bleed duration")
	}

	entity.BleedEndTime = time.Now().Add(1500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected bleed duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksPoisonDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:            "player-poisoned",
		Type:          game.TypePlayer,
		SubType:       "Rogue",
		State:         "IDLE",
		TalentRanks:   map[string]int{},
		Poisoned:      true,
		PoisonEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.PoisonDuration <= 0 {
		t.Fatal("expected snapshot to track poison duration")
	}

	entity.PoisonEndTime = time.Now().Add(1500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected poison duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksBleedDamageForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:           "player-bleed-damage",
		Type:         game.TypePlayer,
		SubType:      "Rogue",
		State:        "IDLE",
		TalentRanks:  map[string]int{},
		Bleeding:     true,
		BleedEndTime: time.Now().Add(2500 * time.Millisecond),
		BleedDamage:  14,
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.BleedDamage != 14 {
		t.Fatal("expected snapshot to track bleed damage")
	}

	entity.BleedDamage = 9
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected bleed damage delta change to be detected")
	}
}

func TestEntitySnapshotTracksPoisonDamageForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:            "player-poison-damage",
		Type:          game.TypePlayer,
		SubType:       "Rogue",
		State:         "IDLE",
		TalentRanks:   map[string]int{},
		Poisoned:      true,
		PoisonEndTime: time.Now().Add(2500 * time.Millisecond),
		PoisonDamage:  11,
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.PoisonDamage != 11 {
		t.Fatal("expected snapshot to track poison damage")
	}

	entity.PoisonDamage = 7
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected poison damage delta change to be detected")
	}
}

func TestEntitySnapshotTracksSlowDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:          "player-slowed",
		Type:        game.TypePlayer,
		SubType:     "Rogue",
		State:       "IDLE",
		TalentRanks: map[string]int{},
		Slowed:      true,
		SlowFactor:  0.35,
		SlowEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.SlowDuration <= 0 {
		t.Fatal("expected snapshot to track slow duration")
	}

	entity.SlowEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected slow duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksWeakPointMarkedForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:              "player-weak-pointed",
		Type:            game.TypePlayer,
		SubType:         "Rogue",
		State:           "IDLE",
		TalentRanks:     map[string]int{},
		WeakPointMarked: true,
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if !snapshot.WeakPointMarked {
		t.Fatal("expected snapshot to track weak point marked state")
	}

	entity.WeakPointMarked = false
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected weak point marked delta change to be detected")
	}
}

func TestEntitySnapshotTracksWeakPointDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:               "player-weak-point-duration",
		Type:             game.TypePlayer,
		SubType:          "Rogue",
		State:            "IDLE",
		TalentRanks:      map[string]int{},
		WeakPointMarked:  true,
		WeakPointEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.WeakPointDuration <= 0 {
		t.Fatal("expected snapshot to track weak point duration")
	}

	entity.WeakPointEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected weak point duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksMarkWeaknessForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:            "player-mark-weakness",
		Type:          game.TypePlayer,
		SubType:       "Cleric",
		State:         "IDLE",
		TalentRanks:   map[string]int{},
		MarkWeakness:  true,
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if !snapshot.MarkWeakness {
		t.Fatal("expected snapshot to track mark weakness state")
	}

	entity.MarkWeakness = false
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected mark weakness delta change to be detected")
	}
}

func TestEntitySnapshotTracksMarkWeaknessDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:                  "player-mark-weakness-duration",
		Type:                game.TypePlayer,
		SubType:             "Cleric",
		State:               "IDLE",
		TalentRanks:         map[string]int{},
		MarkWeakness:        true,
		MarkWeaknessEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.MarkWeaknessDuration <= 0 {
		t.Fatal("expected snapshot to track mark weakness duration")
	}

	entity.MarkWeaknessEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected mark weakness duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksSpiritDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:             "player-spirit-duration",
		Type:           game.TypePlayer,
		SubType:        "Cleric",
		State:          "IDLE",
		TalentRanks:    map[string]int{},
		SpiritsActive:  true,
		SpiritEndTime:  time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.SpiritDuration <= 0 {
		t.Fatal("expected snapshot to track spirit duration")
	}

	entity.SpiritEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected spirit duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksBlessingResolveDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:                     "player-blessing-resolve-duration",
		Type:                   game.TypePlayer,
		SubType:                "Cleric",
		State:                  "IDLE",
		TalentRanks:            map[string]int{},
		BlessingResolveActive:  true,
		BlessingResolveEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.BlessingResolveDuration <= 0 {
		t.Fatal("expected snapshot to track blessing resolve duration")
	}

	entity.BlessingResolveEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected blessing resolve duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksTimeWarpDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:            "player-time-warp-duration",
		Type:          game.TypePlayer,
		SubType:       "Wizard",
		State:         "IDLE",
		TalentRanks:   map[string]int{},
		TimeWarpActive: true,
		TimeWarpEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.TimeWarpDuration <= 0 {
		t.Fatal("expected snapshot to track time warp duration")
	}

	entity.TimeWarpEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected time warp duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksGuardianEmbraceDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:                  "player-guardian-embrace-duration",
		Type:                game.TypePlayer,
		SubType:             "Cleric",
		State:               "IDLE",
		TalentRanks:         map[string]int{},
		GuardianEmbraceActive: true,
		GuardianEmbraceEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.GuardianEmbraceDuration <= 0 {
		t.Fatal("expected snapshot to track guardian embrace duration")
	}

	entity.GuardianEmbraceEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected guardian embrace duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksArcaneShieldDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:                "player-arcane-shield-duration",
		Type:              game.TypePlayer,
		SubType:           "Wizard",
		State:             "IDLE",
		TalentRanks:       map[string]int{},
		ArcaneShieldActive: true,
		ArcaneShieldHP:    180,
		ArcaneShieldEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.ArcaneShieldDuration <= 0 {
		t.Fatal("expected snapshot to track arcane shield duration")
	}

	entity.ArcaneShieldEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected arcane shield duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksDivineInterventionDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:                       "player-divine-intervention-duration",
		Type:                     game.TypePlayer,
		SubType:                  "Cleric",
		State:                    "IDLE",
		TalentRanks:              map[string]int{},
		DivineInterventionActive: true,
		DivineInterventionEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.DivineInterventionDuration <= 0 {
		t.Fatal("expected snapshot to track divine intervention duration")
	}

	entity.DivineInterventionEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected divine intervention duration delta change to be detected")
	}
}

func TestEntitySnapshotTracksSpellFocusDurationForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:               "player-spell-focus-duration",
		Type:             game.TypePlayer,
		SubType:          "Wizard",
		State:            "IDLE",
		TalentRanks:      map[string]int{},
		SpellFocusActive: true,
		SpellFocusEndTime: time.Now().Add(2500 * time.Millisecond),
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if snapshot.SpellFocusDuration <= 0 {
		t.Fatal("expected snapshot to track spell focus duration")
	}

	entity.SpellFocusEndTime = time.Now().Add(500 * time.Millisecond)
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected spell focus duration delta change to be detected")
	}
}
