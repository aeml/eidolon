package game

import (
	"fmt"
	"sync"
	"testing"
)

// The release backport retains ordinary explosion damage, while releasing
// corpse locks before chains and capturing each death's party recipients.
func TestPartyExplosiveChainsReleaseCorpseLocksAndRewardEachDeathOnce(t *testing.T) {
	for _, simultaneous := range []bool{false, true} {
		t.Run(fmt.Sprint(simultaneous), func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			const instance = "party-chain"
			w.InstanceLayouts[instance] = &DungeonInstance{ID: instance, DungeonType: "crypt"}
			p := newTestPlayer("chain-source", "Fighter")
			p.InstanceID, p.Damage = instance, 2000
			p.ActiveUniqueEffects = []string{"explosive"}
			ally := newTestPlayer("chain-downed-ally", "Cleric")
			ally.InstanceID, ally.X, ally.State, ally.Health = instance, 1000, "DEAD", 0
			for _, member := range []*Entity{p, ally} {
				member.Quests = []Quest{{ID: "chain-credit", Type: "KILL", Target: "Skeleton", MaxCount: 8, Accepted: true}}
				w.AddEntity(member)
			}
			party := w.CreateParty(p.ID)
			if err := w.JoinParty(party.ID, ally.ID); err != nil {
				t.Fatal(err)
			}
			victims := make([]*Entity, 8)
			for i := range victims {
				victims[i] = &Entity{ID: fmt.Sprintf("chain-victim-%d", i), Type: TypeEnemy, SubType: "Skeleton",
					InstanceID: instance, X: 2, Health: 10, MaxHealth: 10, Level: 1, State: "IDLE"}
				w.AddEntity(victims[i])
			}
			bystander := &Entity{ID: "chain-bystander", Type: TypeEnemy, SubType: "Imp", InstanceID: instance,
				X: 3, Health: 10000, MaxHealth: 10000, State: "IDLE"}
			elsewhere := &Entity{ID: "chain-elsewhere", Type: TypeEnemy, SubType: "Imp", InstanceID: "other",
				X: 3, Health: 10000, MaxHealth: 10000, State: "IDLE"}
			w.AddEntity(bystander)
			w.AddEntity(elsewhere)
			var workers sync.WaitGroup
			start := make(chan struct{})
			count := 1
			if simultaneous {
				count = len(victims)
			}
			for _, victim := range victims[:count] {
				workers.Add(1)
				go func(id string) {
					defer workers.Done()
					<-start
					w.applyAttackImpact(p.ID, id, instance, nil, 0)
				}(victim.ID)
			}
			close(start)
			workers.Wait()
			w.StopBackground()
			for _, victim := range victims {
				if victim.State != "DEAD" || victim.Health != 0 {
					t.Fatalf("chain left a victim alive: %s/%d", victim.State, victim.Health)
				}
			}
			if bystander.Health != 2000 || elsewhere.Health != 10000 {
				t.Fatalf("expected eight unchanged in-instance explosions: health=%d other=%d", bystander.Health, elsewhere.Health)
			}
			for _, member := range []*Entity{p, ally} {
				if q := questByID(t, member, "chain-credit"); q.Count != 8 || q.Completed {
					t.Fatalf("each member needs exactly eight unclaimed kills: %+v", q)
				}
			}
		})
	}
}
