package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestConsecratedGroundTrainedZoneAtActualTick(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, runeID := range []string{"", "consecratedground_expanded", "consecratedground_lingering", "consecratedground_sanctuary"} {
			for _, scale := range []float64{1, 4} {
				t.Run(fmt.Sprintf("rank%d/%s/body%v", rank, runeID, scale), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("holy-caster", "Cleric")
					p.InstanceID, p.X, p.Y, p.Z = "qa-holy-area", 60000, 40, 60000
					p.Level, p.Stats.Wisdom = 100, 10
					p.TalentRanks, p.UnlockedSkills = map[string]int{"CLR_34": rank}, []string{"Consecrated Ground"}
					p.SkillRunes = map[string]string{"Consecrated Ground": runeID}
					w.AddEntity(p)
					radius := 5.0
					if runeID == "consecratedground_expanded" {
						radius = 7.5
					}
					radius *= 1 + .03*float64(rank)
					for _, id := range []string{"ally-in", "ally-out", "enemy-in", "enemy-out"} {
						e := newTestPlayer(id, "Wizard")
						e.InstanceID, e.X, e.Z, e.Scale, e.Health = p.InstanceID, p.X+radius+1.25*scale-.01, p.Z, scale, 100
						if id == "ally-out" || id == "enemy-out" {
							e.X += .02
						}
						if id == "enemy-in" || id == "enemy-out" {
							e.Type = TypeEnemy
						}
						w.AddEntity(e)
					}
					var accepted *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
							accepted = &event
						}
					}
					before := p.Mana
					if !w.PerformAbility(p.ID, p.X+100, p.Z+100, "", "Consecrated Ground").Accepted || p.Mana != before-40 {
						t.Fatal("cast/cost failed")
					}
					var zone *Entity
					for _, e := range w.Entities {
						if e.OwnerID == p.ID && e.SubType == "ZoneHoly" {
							zone = e
							break
						}
					}
					if zone == nil {
						t.Fatal("missing zone")
					}
					if math.Abs(zone.Radius-radius) > 1e-8 || math.Abs(zone.Scale-radius/5) > 1e-8 {
						t.Errorf("zone radius=%v scale=%v want radius=%v", zone.Radius, zone.Scale, radius)
					}
					if accepted == nil || math.Abs(accepted.Radius-radius) > 1e-8 || accepted.Arc != 2*math.Pi || accepted.TargetX != p.X || accepted.TargetZ != p.Z {
						t.Errorf("incorrect accepted center/shape: %+v", accepted)
					}
					wantDuration := 8.0
					if runeID == "consecratedground_lingering" {
						wantDuration = 16
					}
					if math.Abs(zone.ConsecratedGroundEndTime.Sub(zone.CreatedAt).Seconds()-wantDuration) > .1 {
						t.Fatal("rune duration changed")
					}
					p.TalentRanks = nil
					for _, copy := range []*Entity{w.GetEntityCopy(zone.ID), w.copyEntity(zone)} {
						if math.Abs(copy.Scale-radius/5) > 1e-8 {
							t.Error("snapshot lost scale")
						}
					}
					w.updateEntity(zone, 0, nil, &deferredActions{})
					if w.GetEntity("ally-in").Health != 120 || w.GetEntity("ally-out").Health != 100 {
						t.Errorf("wrong healing boundary: inside=%d outside=%d", w.GetEntity("ally-in").Health, w.GetEntity("ally-out").Health)
					}
					if w.GetEntity("enemy-in").Health >= 100 || w.GetEntity("enemy-out").Health != 100 {
						t.Error("wrong damage boundary")
					}
					if w.GetEntity("ally-in").ConsecratedSanctuaryEndTime.IsZero() != (runeID != "consecratedground_sanctuary") {
						t.Error("sanctuary did not match rune")
					}
					zone.ConsecratedGroundEndTime = time.Now().Add(-time.Second)
					zone.LastAttackTime = time.Now().Add(-time.Second)
					w.updateEntity(zone, 0, nil, &deferredActions{})
					if w.GetEntity("ally-in").Health != 120 {
						t.Error("expired zone healed")
					}
				})
			}
		}
	}
}
