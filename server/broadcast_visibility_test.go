package main

import (
	"testing"

	"eidolon-server/internal/game"
)

func TestCombatBroadcastScopeTreatsOverworldAsScene(t *testing.T) {
	for _, kind := range []string{MsgAbility, MsgAttack, MsgDamage, MsgHeal, MsgProjectileImpact,
		MsgTelegraph, "raid_phase", "crystal_repair", "future_scene_event"} {
		for _, sourceScene := range []string{"", "dungeon_party_a", "dungeon_party_b", "casino"} {
			for _, recipientScene := range []string{"", "dungeon_party_a", "dungeon_party_b", "casino"} {
				message := BroadcastMessage{Type: kind, InstanceID: sourceScene}
				if broadcastMatchesInstance(message, recipientScene) != (sourceScene == recipientScene) {
					t.Fatalf("%s event leaks between scenes %q -> %q", kind, sourceScene, recipientScene)
				}
			}
		}
	}
}

func TestBroadcastDeliveryRequiresJoinedSceneButPreservesGlobalMessages(t *testing.T) {
	previousWorld, previousClients := world, clients
	defer func() { world, clients = previousWorld, previousClients }()
	world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
	clients = make(map[*Client]bool)
	type recipient struct {
		client *Client
		scene  string
		joined bool
	}
	var recipients []recipient
	for _, scene := range []string{"", "dungeon_party_a", "dungeon_party_b", game.CasinoInstanceID} {
		id := "observer-" + scene
		client := newAutoStatusClient(id)
		world.AddEntity(&game.Entity{ID: id, Type: game.TypePlayer, InstanceID: scene})
		clients[client] = true
		// Synthetic queued snapshot audience for the actor-based event cases.
		client.seenScene = scene
		client.seenIDs = map[string]bool{"visible-actor": true}
		recipients = append(recipients, recipient{client, scene, true})
	}
	for _, id := range []string{"", "missing-player", "enemy-binding", "disconnected-player", "retired-player", "closed-player"} {
		client := newAutoStatusClient(id)
		if id == "enemy-binding" {
			world.AddEntity(&game.Entity{ID: id, Type: game.TypeEnemy})
		} else if id == "disconnected-player" || id == "retired-player" || id == "closed-player" {
			world.AddEntity(&game.Entity{ID: id, Type: game.TypePlayer, Disconnected: id == "disconnected-player"})
		}
		client.retired.Store(id == "retired-player")
		if id == "closed-player" {
			client.markTransportClosed()
		}
		clients[client] = true
		recipients = append(recipients, recipient{client: client})
	}
	for _, kind := range []string{MsgAbility, MsgAttack, MsgDamage, MsgHeal, MsgProjectileImpact,
		MsgTelegraph, "raid_phase", "crystal_repair", "future_scene_event"} {
		for _, scene := range []string{"", "dungeon_party_a", "dungeon_party_b", game.CasinoInstanceID} {
			data := createMessage(kind, []byte(`{}`))
			deliverBroadcast(BroadcastMessage{Type: kind, InstanceID: scene, Data: data,
				Footprint: BroadcastFootprint{Present: true}, ActorID: "visible-actor"})
			for _, observer := range recipients {
				messages := drainSentMessages(observer.client.send)
				want := 0
				if observer.joined && observer.scene == scene {
					want = 1
				}
				if len(messages) != want || (want == 1 && messages[0].Type != kind) {
					t.Fatalf("%s/%q delivered %d messages to %q (joined=%v), want %d", kind, scene, len(messages), observer.client.playerID, observer.joined, want)
				}
			}
		}
	}
	// Closed/retired synthetic recipients are removed without invoking cleanup;
	// this test owns no real transport or character save to retire.
	for _, observer := range recipients {
		if observer.client.transportClosed.Load() || observer.client.retired.Load() {
			delete(clients, observer.client)
		}
	}
	for _, kind := range []string{MsgChat, "time", "public_event"} {
		deliverBroadcast(BroadcastMessage{Type: kind, Data: createMessage(kind, []byte(`{}`))})
		for client := range clients {
			if messages := drainSentMessages(client.send); len(messages) != 1 || messages[0].Type != kind {
				t.Fatalf("intentionally global %s was lost for %q: %+v", kind, client.playerID, messages)
			}
		}
	}
}
