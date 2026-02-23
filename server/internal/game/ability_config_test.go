package game

import (
	"testing"
	"time"
)

func TestGetAbilitySpec(t *testing.T) {
	spec, ok := getAbilitySpec("Wizard", "Teleport")
	if !ok {
		t.Fatal("expected wizard teleport spec to exist")
	}
	if spec.ManaCost != 40 {
		t.Fatalf("expected mana 40, got %d", spec.ManaCost)
	}
	if spec.Cooldown != 12*time.Second {
		t.Fatalf("expected cooldown 12s, got %s", spec.Cooldown)
	}
}

func TestResolveAbilityManaCostUsesSpec(t *testing.T) {
	player := &Entity{SubType: "Wizard"}
	cost := resolveAbilityManaCost(player, "Teleport", 1)
	if cost != 40 {
		t.Fatalf("expected spec mana cost 40, got %d", cost)
	}
}

func TestResolveAbilityCooldownUsesSpec(t *testing.T) {
	cd := resolveAbilityCooldown("Cleric", "Divine Intervention", 1*time.Second)
	if cd != 120*time.Second {
		t.Fatalf("expected cooldown 120s, got %s", cd)
	}
}
