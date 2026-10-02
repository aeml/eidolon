package main

import (
	"sync"
	"testing"

	"eidolon-server/internal/game"
)

func TestBroadcastActorInterestRequiresSameQueuedViewOrOwnActor(t *testing.T) {
	for _, kind := range []string{MsgAbility, MsgAttack, MsgDamage, MsgHeal} {
		client := newAutoStatusClient("self")
		for _, tc := range []struct {
			actor, eventScene, seenScene string
			seen, want                   bool
		}{
			{"self", "", "", false, true},
			{"near", "", "", true, true},
			{"far", "", "", false, false},
			{"near", "dungeon_a", "", true, false},
			{"near", "dungeon_a", "dungeon_a", true, true},
			{"near", "", "dungeon_a", true, false},
			{"", "", "", true, false},
		} {
			client.seenScene = tc.seenScene
			client.seenIDs = map[string]bool{tc.actor: tc.seen}
			message := BroadcastMessage{Type: kind, ActorID: tc.actor, InstanceID: tc.eventScene}
			if got := client.observesBroadcastActor(message, "self"); got != tc.want {
				t.Fatalf("%s %+v observed=%v, want%v", kind, tc, got, tc.want)
			}
		}
	}
}

func TestBroadcastActorInterestUsesActualQueuedSnapshotsAndRetiresRemovedActors(t *testing.T) {
	previousWorld, previousClients, previousSessions := world, clients, activeSessions
	defer func() { world, clients, activeSessions = previousWorld, previousClients, previousSessions }()
	world = game.NewWorld(nil)
	world.Entities = make(map[string]*game.Entity)
	world.Grid = game.NewSpatialMap(50)
	clients, activeSessions = make(map[*Client]bool), make(map[string]*Client)
	for _, actor := range []*game.Entity{
		{ID: "observer", Type: game.TypePlayer},
		{ID: "caster", Type: game.TypePlayer, X: 100},
		{ID: "recipient", Type: game.TypePlayer, X: 100},
		{ID: "far", Type: game.TypePlayer, X: 500},
		{ID: "other-scene", Type: game.TypePlayer, InstanceID: "party_b"},
	} {
		world.AddEntity(actor)
		client := newAutoStatusClient(actor.ID)
		client.prioritySend = make(chan []byte, 32)
		clients[client], activeSessions[actor.ID] = true, client
	}
	flushSnapshot := func() {
		broadcastState()
		for client := range clients {
			if len(client.send) == 0 {
				t.Fatal("test requires actual production queued snapshots")
			}
			for len(client.send) > 0 {
				<-client.send
			}
			drainSentMessages(client.prioritySend)
		}
	}
	flushSnapshot()
	for _, kind := range []string{MsgAbility, MsgAttack, MsgDamage, MsgHeal} {
		actorID := "caster"
		if kind == MsgDamage || kind == MsgHeal {
			actorID = "recipient"
		}
		deliverBroadcast(BroadcastMessage{Type: kind, ActorID: actorID, Data: createMessage(kind, []byte(`{}`))})
		for client := range clients {
			want := 1
			if client.playerID == "far" || client.playerID == "other-scene" {
				want = 0
			}
			if got := len(drainSentMessages(client.prioritySend)); got != want {
				t.Fatalf("%s delivered%d to%s, want%d", kind, got, client.playerID, want)
			}
		}
	}
	// Removal does not prematurely lose a final damage/heal visual referencing
	// the queued actor view. After the removal snapshot, that audience retires.
	world.RemoveEntity("caster")
	message := BroadcastMessage{Type: MsgAttack, ActorID: "caster", Data: createMessage(MsgAttack, []byte(`{}`))}
	deliverBroadcast(message)
	if got := len(drainSentMessages(activeSessions["observer"].prioritySend)); got != 1 {
		t.Fatal("already-queued actor view lost its final visual")
	}
	delete(activeSessions, "caster")
	for client := range clients {
		drainSentMessages(client.prioritySend)
	}
	// The removed caster's transport is no longer a joined recipient, so avoid
	// demanding a new self snapshot from it in this synthetic delivery fixture.
	for client := range clients {
		if client.playerID == "caster" {
			delete(clients, client)
		}
	}
	flushSnapshot()
	deliverBroadcast(message)
	for client := range clients {
		if len(drainSentMessages(client.prioritySend)) != 0 {
			t.Fatal("removed actor retained a presentation audience")
		}
	}
}

func TestBroadcastActorInterestDoesNotReuseOldSceneAfterRecipientMoves(t *testing.T) {
	previousWorld, previousClients := world, clients
	defer func() { world, clients = previousWorld, previousClients }()
	world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
	client := newAutoStatusClient("observer")
	world.AddEntity(&game.Entity{ID: client.playerID, Type: game.TypePlayer, InstanceID: "party_b"})
	clients = map[*Client]bool{client: true}
	client.seenIDs = map[string]bool{"caster": true}
	client.seenScene = "party_a"
	for _, kind := range []string{MsgAbility, MsgAttack, MsgDamage, MsgHeal} {
		message := BroadcastMessage{Type: kind, InstanceID: "party_b", ActorID: "caster", Data: createMessage(kind, []byte(`{}`))}
		deliverBroadcast(message)
		if len(drainSentMessages(client.send)) != 0 {
			t.Fatal("old scene's visible actor IDs granted a new scene audience")
		}
		client.seenScene = "party_b"
		deliverBroadcast(message)
		if len(drainSentMessages(client.send)) != 1 {
			t.Fatal("valid same-scene snapshot audience lost")
		}
		client.seenScene = "party_a"
	}
}

func TestBroadcastActorInterestPreservesOwnEventsBeforeInitialSync(t *testing.T) {
	previousWorld, previousClients := world, clients
	defer func() { world, clients = previousWorld, previousClients }()
	world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
	client := newAutoStatusClient("self")
	clients = map[*Client]bool{client: true}
	world.AddEntity(&game.Entity{ID: client.playerID, Type: game.TypePlayer, InstanceID: "party_a"})
	for _, kind := range []string{MsgAbility, MsgAttack, MsgDamage, MsgHeal} {
		for _, tc := range []struct {
			actor, scene string
			want         int
		}{
			{"self", "party_a", 1}, {"", "party_a", 0},
			{"self", "party_b", 0}, {"unknown-actor", "party_a", 0},
		} {
			deliverBroadcast(BroadcastMessage{Type: kind, ActorID: tc.actor, InstanceID: tc.scene, Data: createMessage(kind, []byte(`{}`))})
			if got := len(drainSentMessages(client.send)); got != tc.want {
				t.Fatalf("%s %+v got%d, want%d", kind, tc, got, tc.want)
			}
		}
	}
}

func TestBroadcastActorInterestSerializesWithSnapshotReset(t *testing.T) {
	client := newAutoStatusClient("self")
	message := BroadcastMessage{Type: MsgAbility, ActorID: "caster", InstanceID: "party_a"}
	var group sync.WaitGroup
	group.Add(1)
	go func() {
		defer group.Done()
		for i := 0; i < 1000; i++ {
			client.resetSnapshotHistory()
			client.stateMu.Lock()
			client.seenIDs["caster"], client.seenScene = true, "party_a"
			client.stateMu.Unlock()
		}
	}()
	for i := 0; i < 1000; i++ {
		client.observesBroadcastActor(message, "self")
	}
	group.Wait()
	client.resetSnapshotHistory()
	if client.observesBroadcastActor(message, "self") {
		t.Fatal("reset retained a previous character's actor audience")
	}
}
