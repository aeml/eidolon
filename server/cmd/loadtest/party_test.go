package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

func partyFixture() (*partyLoad, []BotCredentials) {
	creds := make([]BotCredentials, 4)
	for i := range creds {
		creds[i] = BotCredentials{Username: fmt.Sprintf("synthetic-party-%d", i), Password: "synthetic-private-password"}
	}
	p := newPartyLoad(creds, 2, 0)
	for i := range p.members {
		p.state(i, Entity{ID: p.members[i].id, Name: "Public " + partyLoadClasses[i], SubType: partyLoadClasses[i], Type: "Player", Health: 100, MaxHealth: 100, Level: 30, Speed: 5,
			UnlockedSkills: []string{[4]string{"Charge", "Radiant Strike", "Piercing Throw", "Fireball"}[i]}}, time.Unix(100, 0))
	}
	return p, creds
}

func partyMessage(kind string, payload interface{}) Message {
	encoded, _ := json.Marshal(payload)
	return Message{Type: kind, Payload: encoded}
}

func partyRoster(p *partyLoad, count int) Message {
	members := []map[string]string{}
	for i := 0; i < count; i++ {
		members = append(members, map[string]string{"id": p.members[i].id, "class": partyLoadClasses[i]})
	}
	return partyMessage("party_update", map[string]interface{}{"partyId": "party-synthetic", "leaderId": p.members[0].id, "members": members})
}

func TestPartyLoadMembershipNeedsEveryOwnViewAndDoesNotReinvite(t *testing.T) {
	p, _ := partyFixture()
	now := time.Unix(100, 0)
	requests := 0
	request := func(kind string, payload interface{}) error {
		requests++
		if kind != "party_invite" || payload.(map[string]string)["targetName"] != "Public Cleric" {
			t.Fatal("invitation ignored authoritative public name")
		}
		return nil
	}
	move := func(float64, float64) { t.Fatal("unformed party moved into combat") }
	p.step(0, p.members[0].state, nil, now, time.Second, request, move)
	p.step(0, p.members[0].state, nil, now.Add(time.Millisecond), time.Second, request, move)
	if requests != 1 {
		t.Fatal("pending invitation retried")
	}
	p.receive(0, partyRoster(p, 2), now)
	requests = 0
	p.step(0, p.members[0].state, nil, now, time.Second, func(kind string, payload interface{}) error {
		requests++
		if kind != "party_invite" || payload.(map[string]string)["targetName"] != "Public Rogue" {
			t.Fatal("reinvited joined member while its view was delayed")
		}
		return nil
	}, move)
	if requests != 1 {
		t.Fatal("second normal invite missing")
	}
	for i := 0; i < 3; i++ {
		p.receive(i, partyRoster(p, 4), now)
	}
	if p.counts().formed || p.counts().members != 3 {
		t.Fatal("three views passed four-client formation")
	}
	p.receive(3, partyRoster(p, 4), now)
	if got := p.counts(); !got.formed || got.failed || got.minImpacts != 0 {
		t.Fatal("formation/impact gates incorrect")
	}
}

func TestPartyLoadRefusesForeignInvitesExistingGroupsAndMissingAcknowledgements(t *testing.T) {
	for _, scenario := range []string{"foreign", "empty-nonce", "preexisting", "wrong-class", "invalid-position", "invite-timeout", "cast-timeout"} {
		t.Run(scenario, func(t *testing.T) {
			p, _ := partyFixture()
			now := time.Unix(100, 0)
			me := p.members[0].state
			requests := 0
			request := func(string, interface{}) error { requests++; return nil }
			move := func(float64, float64) {}
			switch scenario {
			case "foreign", "empty-nonce":
				inviter, nonce := p.members[0].username, "synthetic-invitation"
				if scenario == "foreign" {
					inviter = "outside-cohort"
				} else {
					nonce = ""
				}
				p.receive(1, partyMessage("party_request", map[string]string{"targetName": inviter, "invitationId": nonce}), now)
			case "preexisting", "wrong-class", "invalid-position":
				p.members[0].admitted = false
				if scenario == "preexisting" {
					me.PartyID = "other-party"
				}
				if scenario == "wrong-class" {
					me.SubType = "Wizard"
				}
				if scenario == "invalid-position" {
					me.X = math.NaN()
				}
				p.state(0, me, now)
			case "invite-timeout":
				p.step(0, me, nil, now, time.Second, request, move)
				p.step(0, me, nil, now.Add(time.Second), time.Second, request, move)
			case "cast-timeout":
				for i := 0; i < 4; i++ {
					p.receive(i, partyRoster(p, 4), now)
				}
				state := map[string]Entity{"synthetic-enemy": {ID: "synthetic-enemy", Type: "Enemy", Health: 100, X: 2}}
				p.step(0, me, state, now, time.Second, request, move)
				p.step(0, me, state, now.Add(time.Second), time.Second, request, move)
			}
			if got := p.counts(); !got.failed || requests > 1 || got.damage != 0 || got.casts != 0 {
				t.Fatal("unsafe/uncertain action accepted or retried")
			}
		})
	}
}

func TestPartyLoadDelayedOwnHitSurvivesLeaderTargetChange(t *testing.T) {
	p, _ := partyFixture()
	now := time.Unix(100, 0)
	for i := range p.members {
		p.receive(i, partyRoster(p, 4), now)
	}
	p.target = Entity{ID: "synthetic-enemy-a", Type: "Enemy", Health: 100, X: 2}
	requests := 0
	p.step(3, p.members[3].state, nil, now, time.Second, func(kind string, payload any) error {
		if kind != "ability" || payload.(map[string]any)["targetId"] != "synthetic-enemy-a" {
			t.Fatal("missing ordinary targeted cast")
		}
		requests++
		return nil
	}, func(float64, float64) { t.Fatal("in-range fixture moved") })
	p.receive(3, partyMessage("ability_result", map[string]any{"skillName": "Fireball", "accepted": true, "cooldownRemaining": 2}), now)
	// The leader may choose another enemy before the projectile's damage
	// notification reaches this player's reader. The positive owned hit is
	// still against the enemy this player actually targeted in this scene.
	p.target = Entity{ID: "synthetic-enemy-b", Type: "Enemy", Health: 100, X: 3}
	p.receive(3, partyMessage("damage", map[string]any{"sourceId": p.members[3].id, "targetId": "synthetic-enemy-a", "amount": 10}), now.Add(time.Second))
	if got := p.counts(); requests != 1 || got.failed || got.casts != 1 || got.damage != 1 || got.minImpacts != 0 {
		t.Fatal("delayed own hit lost or unrelated members received synthetic credit")
	}
}

func TestPartyLoadWrittenTargetDoesNotGrantUnrelatedOrFailedCredit(t *testing.T) {
	for _, scenario := range []string{"foreign-source", "wrong-target", "zero", "wrong-scene", "other-member", "no-request", "scene-changed", "replaced-target", "write-failed"} {
		t.Run(scenario, func(t *testing.T) {
			p, _ := partyFixture()
			now := time.Unix(100, 0)
			for i := range p.members {
				p.receive(i, partyRoster(p, 4), now)
			}
			p.target = Entity{ID: "synthetic-enemy-a", Type: "Enemy", Health: 100, X: 2}
			request := func(string, any) error {
				if scenario == "write-failed" {
					return fmt.Errorf("opaque fixture write failure")
				}
				return nil
			}
			if scenario != "no-request" {
				p.step(3, p.members[3].state, nil, now, time.Second, request, func(float64, float64) { t.Fatal("fixture moved") })
				if scenario != "write-failed" {
					p.receive(3, partyMessage("ability_result", map[string]any{"skillName": "Fireball", "accepted": true, "cooldownRemaining": 2}), now)
				}
			}
			p.target = Entity{ID: "synthetic-enemy-b", Type: "Enemy", Health: 100, X: 3}
			index := 3
			payload := map[string]any{"sourceId": p.members[index].id, "targetId": "synthetic-enemy-a", "amount": 10}
			switch scenario {
			case "foreign-source":
				payload["sourceId"] = "outside-cohort"
			case "wrong-target":
				payload["targetId"] = "unwritten-enemy"
			case "zero":
				payload["amount"] = 0
			case "wrong-scene":
				payload["instanceId"] = "foreign-scene"
			case "other-member":
				index = 0
				payload["sourceId"] = p.members[index].id
			case "scene-changed":
				me := p.members[index].state
				me.InstanceID = "next-scene"
				p.state(index, me, now.Add(time.Second))
				payload["instanceId"] = "next-scene"
			case "replaced-target":
				p.step(3, p.members[3].state, nil, now.Add(3*time.Second), time.Second, request, func(float64, float64) { t.Fatal("fixture moved") })
			}
			p.receive(index, partyMessage("damage", payload), now.Add(4*time.Second))
			if got := p.counts(); got.damage != 0 || got.minImpacts != 0 || scenario == "write-failed" && !got.failed {
				t.Fatal("unrelated/old/failed request earned impact credit")
			}
		})
	}
}

func TestPartyLoadImpactsAreOwnPartyOnlyAndXPIsNotKillAttribution(t *testing.T) {
	p, _ := partyFixture()
	now := time.Unix(100, 0)
	for i := 0; i < 4; i++ {
		p.receive(i, partyRoster(p, 4), now)
	}
	p.target = Entity{ID: "synthetic-enemy", Type: "Enemy", Health: 100}
	for _, payload := range []map[string]interface{}{
		{"sourceId": "foreign", "targetId": p.target.ID, "amount": 10},
		{"sourceId": p.members[0].id, "targetId": "other-enemy", "amount": 10},
		{"sourceId": p.members[0].id, "targetId": p.target.ID, "amount": 10, "instanceId": "other-scene"},
		{"sourceId": p.members[0].id, "targetId": p.target.ID, "amount": 0},
	} {
		p.receive(0, partyMessage("damage", payload), now)
	}
	if p.counts().damage != 0 {
		t.Fatal("foreign/zero/wrong-scene event counted")
	}
	p.receive(0, partyMessage("damage", map[string]interface{}{"sourceId": p.members[0].id, "targetId": p.target.ID, "amount": 10}), now)
	p.receive(1, partyMessage("heal", map[string]interface{}{"sourceId": p.members[1].id, "targetId": p.members[0].id, "amount": 10}), now)
	p.receive(1, partyMessage("heal", map[string]interface{}{"sourceId": p.members[1].id, "targetId": "outside-cohort", "amount": 10}), now)
	me := p.members[0].state
	me.Experience = 100
	p.state(0, me, now)
	p.state(0, me, now)
	if got := p.counts(); got.damage != 1 || got.heals != 1 || got.xpUpdates != 1 || got.deaths != 0 || got.minImpacts != 0 {
		t.Fatal("event/progression scopes conflated", got)
	}
	p.members[0].pendingSkill = "Charge"
	p.receive(0, partyMessage("ability_result", map[string]interface{}{"skillName": "Fireball", "accepted": true, "cooldownRemaining": 2}), now)
	if got := p.counts(); !got.failed || got.casts != 0 {
		t.Fatal("unrequested cast result counted")
	}
}

func TestPartyLoadFourActualBotsNormalConsentAndCombatWithPreparedGear(t *testing.T) {
	metrics = loadMetrics{}
	p, creds := partyFixture()
	// Real bot admission must publish all four actors, not fixture seeding.
	for i := range p.members {
		p.members[i].admitted = false
	}
	world := &game.World{Entities: map[string]*game.Entity{}, Parties: map[string]*game.Party{}}
	actors := make([]Entity, 4)
	for i := range actors {
		actors[i] = p.members[i].state
		if i == 0 {
			actors[i].Health = 50
		}
		if i == 1 {
			actors[i].UnlockedSkills = []string{"Healing Light"}
		}
		world.Entities[actors[i].ID] = &game.Entity{ID: actors[i].ID, Name: creds[i].Username, PublicName: actors[i].Name, Type: game.TypePlayer, SubType: partyLoadClasses[i], Health: actors[i].Health}
	}
	type command struct {
		connection *websocket.Conn
		message    Message
	}
	commands := make(chan command, 32)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	upgrader := websocket.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		connection, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Error("party fixture upgrade failed")
			return
		}
		defer connection.Close()
		connection.SetReadLimit(8 << 20)
		_ = connection.SetReadDeadline(time.Now().Add(5 * time.Second))
		for {
			var message Message
			if connection.ReadJSON(&message) != nil {
				return
			}
			select {
			case commands <- command{connection, message}:
			case <-ctx.Done():
				return
			}
		}
	}))
	defer server.Close()
	fixtureDone := make(chan struct{})
	go func() {
		defer close(fixtureDone)
		var connections [4]*websocket.Conn
		var joined [4]bool
		indexByConnection := map[*websocket.Conn]int{}
		write := func(index int, message Message) {
			if connections[index] != nil {
				_ = connections[index].WriteJSON(message)
			}
		}
		roster := func() {
			party := world.Parties[world.Entities[actors[0].ID].PartyID]
			if party == nil {
				return
			}
			_, _, ids := party.GetSnapshot()
			members := []map[string]string{}
			for _, id := range ids {
				members = append(members, map[string]string{"id": id, "class": world.Entities[id].SubType})
			}
			message := partyMessage("party_update", map[string]interface{}{"partyId": party.ID, "leaderId": actors[0].ID, "members": members})
			for i := range actors {
				if world.Entities[actors[i].ID].PartyID == party.ID {
					write(i, message)
				}
			}
		}
		for {
			select {
			case <-ctx.Done():
				return
			case cmd := <-commands:
				index, known := indexByConnection[cmd.connection]
				if cmd.message.Type == "login" {
					var registration struct{ Username string }
					_ = json.Unmarshal(cmd.message.Payload, &registration)
					for i := range creds {
						if creds[i].Username == registration.Username {
							index, known = i, true
							connections[i] = cmd.connection
							indexByConnection[cmd.connection] = i
						}
					}
				}
				if !known {
					t.Error("unknown synthetic party account")
					return
				}
				switch cmd.message.Type {
				case "login":
					write(index, partyMessage("login_success", map[string]interface{}{"hasCharacter": true, "characterType": partyLoadClasses[index]}))
				case "join":
					joined[index] = true
					state := map[string]Entity{"synthetic-enemy": {ID: "synthetic-enemy", Type: "Enemy", Health: 100, X: 2}}
					for i := range actors {
						if joined[i] {
							state[actors[i].ID] = actors[i]
						}
					}
					write(index, partyMessage("movement_context", map[string]string{"movementContext": "synthetic-party-context"}))
					write(index, partyMessage("state", state))
					write(index, partyMessage("inventory", []Item{{ID: "synthetic-protected-gear", Slot: "weapon", Rarity: "Legendary", Level: 100}}))
				case "party_invite":
					var payload struct{ TargetName string }
					_ = json.Unmarshal(cmd.message.Payload, &payload)
					if index != 0 {
						t.Error("nonleader sent invitation")
						return
					}
					if world.Entities[actors[0].ID].PartyID == "" {
						world.CreateParty(actors[0].ID)
						roster()
					}
					target := -1
					for i := 1; i < 4; i++ {
						if actors[i].Name == payload.TargetName {
							target = i
						}
					}
					if target < 0 {
						t.Error("invitation ignored public name")
						return
					}
					invitation, err := world.IssuePartyInvitation(actors[0].ID, actors[target].ID, time.Now())
					if err != nil {
						t.Error("normal consent issue failed", err)
						return
					}
					write(target, partyMessage("party_request", map[string]string{"targetName": creds[0].Username, "invitationId": invitation.ID}))
				case "party_response":
					var payload struct {
						InviterName, InvitationID string
						Accepted                  bool
					}
					_ = json.Unmarshal(cmd.message.Payload, &payload)
					if payload.InviterName != creds[0].Username || !payload.Accepted {
						t.Error("wrong party response")
						return
					}
					if _, err := world.RespondPartyInvitation(actors[index].ID, actors[0].ID, payload.InvitationID, true, time.Now()); err != nil {
						t.Error("normal consent join failed", err)
						return
					}
					roster()
				case "ability":
					var payload struct{ SkillName, TargetID string }
					_ = json.Unmarshal(cmd.message.Payload, &payload)
					kind := "damage"
					if index == 1 {
						if payload.SkillName != "Healing Light" || payload.TargetID != actors[0].ID {
							t.Error("cleric did not heal wounded tank")
							return
						}
						kind = "heal"
					} else if payload.SkillName != [4]string{"Charge", "", "Piercing Throw", "Fireball"}[index] || payload.TargetID != "synthetic-enemy" {
						t.Error("wrong class combat intent")
						return
					}
					write(index, partyMessage("ability_result", map[string]interface{}{"skillName": payload.SkillName, "accepted": true, "cooldownRemaining": 10}))
					write(index, partyMessage(kind, map[string]interface{}{"sourceId": actors[index].ID, "targetId": payload.TargetID, "amount": 10}))
				case "attack", "move": // Ordinary continued combat; not forged evidence.
				default:
					t.Error("party workload mutated equipment/bag or issued unrelated command")
					return
				}
			}
		}
	}()
	stop := make(chan struct{})
	var bots sync.WaitGroup
	for i := range creds {
		bots.Add(1)
		go func(index int) {
			defer bots.Done()
			var observation loadObservation
			runBot(index, "ws"+strings.TrimPrefix(server.URL, "http"), creds[index], "party-combat", stop, &observation, p)
		}(i)
	}
	deadline := time.Now().Add(4 * time.Second)
	for !p.counts().failed && p.counts().minImpacts < 1 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	close(stop)
	bots.Wait()
	cancel()
	<-fixtureDone
	if got := p.counts(); got.failed || !got.formed || got.members != 4 || got.minImpacts != 1 || got.damage != 3 || got.heals != 1 || got.casts != 4 || got.xpUpdates != 0 || got.deaths != 0 || metrics.readErrors.Load() != 0 || metrics.decodeErrors.Load() != 0 || metrics.admissionErrors.Load() != 0 {
		t.Fatal("four-bot normal consent/combat/gear/shutdown evidence incorrect", got)
	}
}
