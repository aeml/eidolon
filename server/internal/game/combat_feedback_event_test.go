package game

import "testing"

func TestCombatFeedbackHelpersPreserveKindAndInstance(t *testing.T) {
	w := NewWorld(nil)
	var damage DamageEvent
	var heal HealEvent
	w.OnEvent = func(eventType string, data interface{}) {
		switch eventType {
		case "damage":
			damage = data.(DamageEvent)
		case "heal":
			heal = data.(HealEvent)
		}
	}

	w.fireDamageEvent("source", "target", 17, "holy", "instance-feedback")
	w.fireHealEvent("source", "target", 9, "guardian_embrace", "instance-feedback")

	if damage.Kind != "holy" || damage.InstanceID != "instance-feedback" {
		t.Fatalf("damage context mismatch: %+v", damage)
	}
	if heal.Kind != "guardian_embrace" || heal.InstanceID != "instance-feedback" {
		t.Fatalf("heal context mismatch: %+v", heal)
	}
}

func TestDamageFeedbackEmitsTypedLifestealInTheSameInstance(t *testing.T) {
	w := NewWorld(nil)
	source := newTestPlayer("source", "Fighter")
	source.InstanceID = "instance-feedback"
	source.MaxHealth = 100
	source.Health = 50
	source.LifestealBonus = 0.5
	w.AddEntity(source)
	var heal HealEvent
	w.OnEvent = func(eventType string, data interface{}) {
		if eventType == "heal" {
			heal = data.(HealEvent)
		}
	}

	w.fireDamageEvent(source.ID, "target", 20, "physical", source.InstanceID)

	if heal.Amount != 10 || heal.Kind != "lifesteal" || heal.InstanceID != source.InstanceID {
		t.Fatalf("lifesteal feedback mismatch: %+v", heal)
	}
}
