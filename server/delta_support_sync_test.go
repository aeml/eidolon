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
