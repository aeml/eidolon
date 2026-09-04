package main

import (
	"testing"

	"eidolon-server/internal/game"

	"google.golang.org/protobuf/proto"
)

func BenchmarkEntityProtoSerialization(b *testing.B) {
	entity := &game.Entity{
		ID:                "player-benchmark",
		Type:              game.TypePlayer,
		SubType:           "Wizard",
		Level:             100,
		Health:            1000,
		MaxHealth:         1000,
		Mana:              800,
		MaxMana:           800,
		UnlockedSkills:    []string{"Fireball", "Meteor Drop", "Scorch Beam"},
		TalentRanks:       map[string]int{"WIZ_01": 5, "WIZ_02": 5},
		SkillRunes:        map[string]string{"Fireball": "Wizard_Fireball_Rune_A"},
		Equipment:         map[string]game.Item{"mainHand": {ID: "staff", Name: "Staff", Type: game.ItemWeapon, Stats: map[string]int{"damage": 20}}},
		EquipmentRevision: 3,
	}

	b.ReportAllocs()
	b.ResetTimer()
	for index := 0; index < b.N; index++ {
		if _, err := proto.Marshal(entityToProto(entity)); err != nil {
			b.Fatal(err)
		}
	}
}
