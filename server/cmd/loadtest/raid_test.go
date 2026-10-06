package main

import (
	"fmt"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func raidFixture(count int, kind string) *partyLoad {
	credentials := make([]BotCredentials, count)
	for i := range credentials {
		credentials[i].Username = fmt.Sprintf("synthetic-raider-%d", i)
	}
	p := newRaidParty(credentials, kind)
	if p.failed {
		return p
	}
	for i := range p.members {
		p.state(i, Entity{ID: p.members[i].id, Name: fmt.Sprintf("Raider %d", i), Type: "Player", SubType: partyLoadClasses[i%4], Level: p.raid.level, Health: 100, MaxHealth: 100}, time.Unix(100, 0))
	}
	return p
}

func raidRoster(p *partyLoad, count int, active bool, ready []bool) Message {
	members := make([]map[string]interface{}, count)
	all := true
	for i := range members {
		members[i] = map[string]interface{}{"id": p.members[i].id, "class": partyLoadClasses[i%4], "ready": ready[i]}
		all = all && ready[i]
	}
	return partyMessage("party_update", map[string]interface{}{"partyId": "synthetic-raid", "leaderId": p.members[0].id, "members": members, "readyCheckActive": active, "allReady": all})
}

func conversionReply() Message {
	return partyMessage("chat", map[string]string{"sender": "System", "channel": "server", "message": raidConversionMessage})
}

func TestRaidPreparationNormalDomainConversionAndEveryConsent(t *testing.T) {
	for _, kind := range []string{"earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid", "weekly_raid"} {
		for _, count := range []int{5, 10} {
			t.Run(fmt.Sprintf("%s/%d", kind, count), func(t *testing.T) {
				p := raidFixture(count, kind)
				definition, _ := game.ElementalRaidDefinitionForType(kind)
				quest := definition.RequiredDungeonQuest
				if kind == "weekly_raid" {
					quest = game.ChronicleGateOpenedID
				}
				world := &game.World{Entities: map[string]*game.Entity{}, Parties: map[string]*game.Party{}}
				for _, member := range p.members {
					world.Entities[member.id] = &game.Entity{ID: member.id, Type: game.TypePlayer, SubType: member.state.SubType, Level: p.raid.level, Quests: []game.Quest{{ID: quest, Completed: true}}}
				}
				validate := func() (*game.Party, []string, error) {
					if kind == "weekly_raid" {
						return world.ValidateWeeklyRaidParty(p.members[0].id)
					}
					return world.ValidateElementalRaidParty(p.members[0].id, p.raid.kind)
				}
				var party *game.Party
				type reply struct {
					index   int
					message Message
				}
				var replies []reply
				broadcast := func() {
					members := make([]map[string]interface{}, len(party.Members))
					all := true
					for i, id := range party.Members {
						members[i] = map[string]interface{}{"id": id, "class": world.Entities[id].SubType, "ready": party.Ready[id]}
						all = all && party.Ready[id]
					}
					message := partyMessage("party_update", map[string]interface{}{"partyId": party.ID, "leaderId": party.LeaderID, "members": members, "readyCheckActive": party.ReadyCheckActive, "allReady": all})
					for i := range party.Members {
						replies = append(replies, reply{i, message})
					}
				}
				conversions, checks, consents := 0, 0, 0
				now := time.Unix(100, 0)
				for tick := 0; tick < 100 && !p.raid.prepared() && !p.failed; tick++ {
					for index := range p.members {
						p.step(index, p.members[index].state, nil, now, time.Second, func(kind string, payload interface{}) error {
							switch kind {
							case "party_invite":
								if party == nil {
									party = world.CreateParty(p.members[0].id)
									broadcast() // Actual handler publishes the solo roster before the invite.
								}
								target := p.inviteIndex
								if target >= 5 && !p.raid.converted {
									t.Fatal("sixth invite before acknowledged conversion")
								}
								if payload.(map[string]string)["targetName"] != p.members[target].state.Name {
									t.Fatal("wrong public invite target")
								}
								replies = append(replies, reply{target, partyMessage("party_request", map[string]string{"targetName": p.members[0].username, "invitationId": "synthetic-consent"})})
							case "party_response":
								if err := world.JoinParty(party.ID, p.members[index].id); err != nil {
									return err
								}
								broadcast()
							case "raid_convert":
								conversions++
								if index != 0 || payload.(map[string]string)["raidType"] != p.raid.kind {
									t.Fatal("invalid conversion issuer/type")
								}
								var err error
								party, err = world.ConvertPartyToRaidForType(p.members[0].id, p.raid.kind)
								if err != nil {
									return err
								}
								broadcast()
								replies = append(replies, reply{0, conversionReply()})
							case "party_ready_check":
								checks++
								if _, _, err := validate(); err == nil {
									t.Fatal("entry passed without consent")
								}
								var err error
								party, err = world.StartPartyReadyCheck(p.members[index].id)
								if err != nil {
									return err
								}
								broadcast()
							case "party_ready":
								consents++
								if !payload.(map[string]bool)["ready"] {
									t.Fatal("not an affirmative consent")
								}
								var err error
								party, err = world.SetPartyReady(p.members[index].id, true)
								if err != nil {
									return err
								}
								broadcast()
							default:
								t.Fatalf("preparation sent encounter/action %s", kind)
							}
							return nil
						}, func(float64, float64) { t.Fatal("preparation started walking/combat") })
					}
					for _, reply := range replies {
						if !p.receive(reply.index, reply.message, now) {
							t.Fatal("normal domain response rejected")
						}
					}
					replies = nil
					now = now.Add(time.Millisecond)
				}
				if p.failed || !p.raid.prepared() || !p.formed() || conversions != 1 || checks != 1 || consents != count {
					t.Fatal("incomplete/repeated preparation", conversions, checks, consents)
				}
				if _, members, err := validate(); err != nil || len(members) != count {
					t.Fatal("domain entry still denied", err)
				}
				if kind == "weekly_raid" {
					if err := world.RequirePartyChronicleQuest(p.partyID, game.ChronicleGateOpenedID); err != nil {
						t.Fatal("prepared chapter gate rejected", err)
					}
				}
				p.raid.members[count-1].allReadySeen = false
				if p.raid.prepared() {
					t.Fatal("other-client readiness substituted for last own view")
				}
			})
		}
	}
}

func TestRaidPreparationRefusesUnprovenOrChangedConsent(t *testing.T) {
	for _, scenario := range []string{"too-small", "too-large", "unknown", "under-level", "unsolicited-conversion", "wrong-recipient", "duplicate-conversion", "conversion-timeout", "ready-timeout", "missing-ready-fields", "unsolicited-check", "unrequested-consent", "contradictory-all-ready", "changed-roster", "revoked-ready"} {
		t.Run(scenario, func(t *testing.T) {
			p := raidFixture(5, "earth_crystal_raid")
			now := time.Unix(100, 0)
			ready := make([]bool, 5)
			requests := 0
			request := func(string, interface{}) error { requests++; return nil }
			switch scenario {
			case "too-small":
				p = raidFixture(4, p.raid.kind)
			case "too-large":
				p = raidFixture(11, p.raid.kind)
			case "unknown":
				p = raidFixture(5, "unrecognized_raid")
			case "under-level":
				me := p.members[4].state
				me.Level--
				p.state(4, me, now)
			case "unsolicited-conversion":
				p.receive(0, conversionReply(), now)
			case "wrong-recipient", "duplicate-conversion":
				p.partyID, p.raid.conversionSent = "synthetic-raid", true
				if scenario == "duplicate-conversion" {
					p.receive(0, conversionReply(), now)
				}
				index := 0
				if scenario == "wrong-recipient" {
					index = 1
				}
				p.receive(index, conversionReply(), now)
			case "conversion-timeout":
				p.partyID = "synthetic-raid"
				p.raid.convert(p, 0, now, time.Second, request)
				p.raid.convert(p, 0, now.Add(time.Second), time.Second, request)
			case "ready-timeout":
				p.raid.converted = true
				p.raid.prepare(p, 0, now, time.Second, request)
				p.raid.prepare(p, 0, now.Add(time.Second), time.Second, request)
			case "missing-ready-fields":
				p.receive(0, partyRoster(p, 4), now)
			case "unsolicited-check":
				p.receive(0, raidRoster(p, 5, true, ready), now)
			case "unrequested-consent", "contradictory-all-ready", "changed-roster", "revoked-ready":
				p.raid.converted, p.raid.checkSent = true, true
				if scenario == "unrequested-consent" {
					ready[0] = true
				}
				if scenario == "contradictory-all-ready" {
					for i := range ready {
						ready[i] = true
					}
					p.raid.members[0].readySent = true
				}
				if scenario == "changed-roster" {
					p.receive(0, raidRoster(p, 4, true, ready), now)
					break
				}
				if scenario == "revoked-ready" {
					p.raid.members[0].readySent, p.raid.members[0].readySeen = true, true
				}
				p.receive(0, raidRoster(p, 5, true, ready), now)
			}
			if !p.failed || requests > 1 {
				t.Fatal("unsafe/missing consent accepted or retried", requests)
			}
		})
	}
}

func TestRaidConversionCannotBeAcknowledgedByPublicOrHistoricalChat(t *testing.T) {
	p := raidFixture(5, "earth_crystal_raid")
	p.partyID, p.raid.conversionSent = "synthetic-raid", true
	for _, chat := range []map[string]interface{}{
		{"sender": "another-player", "channel": "server", "message": raidConversionMessage},
		{"sender": "System", "channel": "world", "message": raidConversionMessage},
		{"sender": "System", "channel": "server", "message": raidConversionMessage, "history": true},
	} {
		p.receive(0, partyMessage("chat", chat), time.Unix(100, 0))
	}
	if p.failed || p.raid.converted {
		t.Fatal("unrelated/historical chat changed conversion state")
	}
}
