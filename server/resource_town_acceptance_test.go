package main

import (
	"math"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
)

// Independent arithmetic for the level30, unequipped, 0 Vitality/Wisdom and
// 10 Intelligence recovery fixtures. Their un-rested maxima are145/245. This
// does not call the production regeneration/stat code it is checking.
func townFixtureResources(t *testing.T, before *database.Character, bank float64, manaSpent int) database.CharacterResources {
	t.Helper()
	if before.Level != 30 || before.Stats.Vitality != 0 || before.Stats.Wisdom != 0 || before.Stats.Intelligence != 10 || len(before.Equipment) != 0 {
		t.Fatal("town resource oracle requires its declared bare level30 fixture; do not reuse it for other builds")
	}
	prior := 0.0
	if before.WellRested != nil {
		prior = before.WellRested.RemainingSeconds
	}
	elapsed := bank - prior
	if !isFiniteTestNumber(elapsed) || elapsed < 0 || bank >= 7200 {
		t.Fatalf("fixture rest interval cannot determine online recovery: %f -> %f", prior, bank)
	}
	want := *before.Resources
	if want.Dead {
		if elapsed != 0 || manaSpent != 0 {
			t.Fatal("corpse earned rest or spent mana")
		}
		return want
	}
	maxHP, maxMP := 145, 245
	if bank > 0 {
		maxHP, maxMP = 159, 269
	}
	want.Health = min(maxHP, want.Health+int(math.Floor(float64(maxHP)*.1*elapsed+1e-9)))
	want.Mana = min(maxMP, want.Mana-manaSpent+int(math.Floor(float64(maxMP)*.1*elapsed+1e-9)))
	return want
}

func isFiniteTestNumber(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

func townFixtureRead(t *testing.T, conn *websocket.Conn, before *database.Character, manaSpent int) *statepb.Entity {
	t.Helper()
	state := wellRestedReadActorAfter(t, conn, before.Name, time.Now(), func(*statepb.Entity) bool { return true })
	want := townFixtureResources(t, before, state.WellRestedSeconds, manaSpent)
	if int(state.Health) != want.Health || int(state.Mana) != want.Mana || (state.State == "DEAD") != want.Dead {
		t.Fatalf("fresh authoritative town state gotHP%d MP%d %s want%+v bank%.9f", state.Health, state.Mana, state.State, want, state.WellRestedSeconds)
	}
	return state
}

// The rejection response occurs between two independently validated state
// frames. Its mana must lie inside the exact regeneration interval, not equal
// a stale pre-healing value or an arbitrary full bar.
func townFixtureProbe(t *testing.T, conn *websocket.Conn, before *database.Character) {
	t.Helper()
	first := townFixtureRead(t, conn, before, 0)
	resourceSend(t, conn, MsgAbility, AbilityPayload{SkillName: "not-an-unlocked-skill"})
	var result game.AbilityResult
	resourceReadMessage(t, conn, MsgAbilityResult, &result)
	last := townFixtureRead(t, conn, before, 0)
	reason := "locked"
	if before.Resources.Dead {
		reason = "dead"
	}
	if result.Accepted || result.Reason != reason || result.Mana < int(first.Mana) || result.Mana > int(last.Mana) {
		t.Fatalf("town ability rejection outside valid interval: %+v expected%s mana[%d,%d]", result, reason, first.Mana, last.Mana)
	}
}

func assertTownFixtureSave(t *testing.T, before, saved *database.Character, manaSpent int) {
	t.Helper()
	bank := 0.0
	if saved.WellRested != nil {
		if saved.WellRested.Version != 1 {
			t.Fatal("wrong saved rest version")
		}
		bank = saved.WellRested.RemainingSeconds
	}
	want := townFixtureResources(t, before, bank, manaSpent)
	if !reflect.DeepEqual(saved.Resources, &want) || saved.Level != before.Level || saved.Gold != before.Gold || saved.Stats != before.Stats || saved.InstanceID != "" {
		t.Fatalf("town save lost exact resources or progression: got%+v want%+v level%d gold%d bank%.9f", saved.Resources, want, saved.Level, saved.Gold, bank)
	}
}

func TestTownResourceAcceptanceArithmetic(t *testing.T) {
	before := &database.Character{Level: 30, Stats: database.Stats{Intelligence: 10},
		Resources:  &database.CharacterResources{Version: 1, Health: 17, Mana: 100},
		WellRested: &database.CharacterWellRested{Version: 1, RemainingSeconds: 10}}
	if got := townFixtureResources(t, before, 11.25, 0); got.Health != 36 || got.Mana != 133 {
		t.Fatalf("fractional interval arithmetic: %+v", got)
	}
	if got := townFixtureResources(t, before, 11.25, 30); got.Health != 36 || got.Mana != 103 {
		t.Fatalf("cast cost arithmetic: %+v", got)
	}
	if got := townFixtureResources(t, before, 30, 30); got.Health != 159 || got.Mana != 269 {
		t.Fatalf("maxima arithmetic: %+v", got)
	}
	before.Resources = &database.CharacterResources{Version: 1, Dead: true}
	if got := townFixtureResources(t, before, 10, 0); got.Health != 0 || got.Mana != 0 || !got.Dead {
		t.Fatalf("corpse arithmetic: %+v", got)
	}
}
