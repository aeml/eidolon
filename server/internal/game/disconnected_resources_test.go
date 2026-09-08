package game

import (
	"testing"
	"time"
)

func TestDisconnectedResourcesRemainFrozenAndDead(t *testing.T) {
	for _, dead := range []bool{false, true} {
		w := newTestWorld()
		p := newTestPlayer("disconnected-resource", "Wizard")
		p.Health, p.Mana = 50, 0
		if dead {
			p.Health, p.State = 0, "DEAD"
		}
		p.hpRegenRemainder, p.manaRegenRemainder = .99, .99
		w.AddEntity(p)
		if !w.SetEntityDisconnected(p.ID, time.Now()) {
			t.Fatal("disconnect failed")
		}
		hp := p.Health
		for i := 0; i < 30; i++ {
			w.Update(1)
		}
		if p.Health != hp || p.Mana != 0 || p.hpRegenRemainder != 0 || p.manaRegenRemainder != 0 {
			t.Fatal("offline resources changed or fractions survived disconnect")
		}
		resumed, ok := w.ClearEntityDisconnected(p.ID)
		if !ok || resumed != p || p.Disconnected || (p.State == "DEAD") != dead {
			t.Fatal("resume lost resource/death state")
		}
	}
}
