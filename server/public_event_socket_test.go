package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/protobuf/proto"
)

type eventSocketActor struct {
	id, kind, state string
	x, z            float64
	health          int32
}

type eventSocketProbe struct {
	mu           sync.Mutex
	view         game.PublicEventView
	actors       map[string]eventSocketActor
	waves        map[int]bool
	movement     string
	movementSeen bool
	invite       string
	party        string
	updated      time.Time
	hits         int
	dead         bool
	err          error
}

func watchPublicEventSocket(conn *websocket.Conn, id string) *eventSocketProbe {
	_ = conn.SetReadDeadline(time.Time{})
	p := &eventSocketProbe{actors: map[string]eventSocketActor{}, waves: map[int]bool{}}
	go func() {
		for {
			kind, data, err := conn.ReadMessage()
			p.mu.Lock()
			if err != nil {
				p.err = err
				p.mu.Unlock()
				return
			}
			if kind == websocket.BinaryMessage {
				var envelope statepb.StateEnvelope
				if len(data) < 5 || string(data[:4]) != "EDPB" {
					p.err = fmt.Errorf("unexpected state encoding")
				} else if err := proto.Unmarshal(data[5:], &envelope); err != nil {
					p.err = err
				} else {
					p.updated = time.Now()
					entities := envelope.GetFull().GetEntities()
					if envelope.GetFull() != nil {
						p.actors = map[string]eventSocketActor{}
					} else {
						entities = envelope.GetDelta().GetEntities()
						for _, removed := range envelope.GetDelta().GetRemovedIds() {
							delete(p.actors, removed)
						}
					}
					for _, e := range entities {
						p.actors[e.Id] = eventSocketActor{e.Id, e.Type, e.State, float64(e.X), float64(e.Z), e.Health}
						if e.Id == id && (e.Health <= 0 || e.State == "DEAD") {
							p.dead = true
						}
					}
				}
			} else if kind == websocket.TextMessage {
				var message Message
				if json.Unmarshal(data, &message) == nil {
					switch message.Type {
					case MsgPartyRequest:
						p.invite = string(message.Payload)
					case MsgPartyUpdate:
						p.party = string(message.Payload)
					case "public_event":
						if err := json.Unmarshal(message.Payload, &p.view); err != nil {
							p.err = err
						}
						if p.view.Wave > 0 {
							p.waves[p.view.Wave] = true
						}
					case MsgMovementContext:
						var m struct {
							Context string `json:"movementContext"`
						}
						if json.Unmarshal(message.Payload, &m) == nil {
							p.movement = m.Context
							p.movementSeen = true
						}
					case "damage":
						var hit struct {
							SourceID string `json:"sourceId"`
							TargetID string `json:"targetId"`
							Amount   int    `json:"amount"`
						}
						if json.Unmarshal(message.Payload, &hit) == nil && hit.SourceID == id &&
							strings.HasPrefix(hit.TargetID, "world-event-") && hit.Amount > 0 {
							p.hits++
						}
					case MsgError:
						p.err = fmt.Errorf("public event input rejected: %s", message.Payload)
					}
				}
			}
			p.mu.Unlock()
		}
	}()
	return p
}

func TestPublicEventProbeRetainsEmptyInitialMovementContext(t *testing.T) {
	stop := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		conn.WriteJSON(map[string]any{"type": MsgMovementContext, "payload": map[string]string{"movementContext": ""}})
		frame, _ := proto.Marshal(&statepb.StateEnvelope{Payload: &statepb.StateEnvelope_Full{Full: &statepb.StateFull{
			Entities: []*statepb.Entity{{Id: "player-observer", Type: "Player", Health: 100, State: "IDLE"}},
		}}})
		conn.WriteMessage(websocket.BinaryMessage, append([]byte{'E', 'D', 'P', 'B', 1}, frame...))
		<-stop
	}))
	defer func() { close(stop); server.Close() }()
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	p := watchPublicEventSocket(conn, "player-observer")
	arenaAwait(t, time.Second, func() bool {
		p.mu.Lock()
		defer p.mu.Unlock()
		return p.movementSeen && p.actors["player-observer"].id != ""
	})
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.movement != "" || p.dead || p.err != nil {
		t.Fatal("initial overworld context or actor was changed")
	}
}

// Opt-in connected combat acceptance, not rendered UI or an earned level100
// journey. Uses four legal prepared Wizards, ordinary party consent, movement,
// basic attacks and the real rotating event clock. Never changes live world data.
func TestPublicEventActualPartyFullClear(t *testing.T) {
	if os.Getenv("EIDOLON_PUBLIC_EVENT_FULL") != "1" {
		t.Skip("explicit full public-event acceptance only")
	}
	repo, uri, binary := resourceJournalIntegration(t)
	now := time.Now()
	phase := now.Unix() % int64(game.PublicEventPeriod/time.Second)
	if phase < 60 || phase > 120 {
		t.Skip("requires minute1-2 of the real event window; no accelerated clock")
	}
	site := game.PublicEventSites()[(now.Unix()/int64(game.PublicEventPeriod/time.Second))%4]
	storage, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer storage.Disconnect(context.Background())
	users := storage.Database("eidolon").Collection("users")
	if count, err := users.CountDocuments(context.Background(), bson.M{}); err != nil || count != 0 {
		t.Fatal("requires empty disposable accounts", err)
	}
	names, ids := make([]string, 4), make([]string, 4)
	defer func() {
		users.DeleteMany(context.Background(), bson.M{"username": bson.M{"$in": names}})
		storage.Database("eidolon").Collection("pvp_profiles").DeleteMany(context.Background(), bson.M{"player_id": bson.M{"$in": ids}})
	}()
	bases := map[string]string{"mainHand": "Wooden Staff", "offHand": "Spell Tome", "head": "Silk Hood",
		"chest": "Robes", "legs": "Silk Skirt", "feet": "Sandals", "gloves": "Silk Gloves", "shoulders": "Velvet Mantle",
		"belt": "Silk Sash", "ring1": "Gold Ring", "ring2": "Gold Ring", "neck": "Pendant",
		"trinket1": "Amulet of Power", "trinket2": "Orb of Mana"}
	for i := range names {
		names[i] = fmt.Sprintf("event-clear-%x-%d", now.UnixNano(), i)
		ids[i] = "player-" + names[i]
		gear := map[string]database.Item{}
		for slot, base := range bases {
			rarity := game.RarityUncommon
			if slot == "mainHand" || slot == "offHand" || slot == "chest" || slot == "legs" || slot == "trinket1" {
				rarity = game.RarityRare
			}
			rollSlot := slot
			if strings.HasPrefix(slot, "ring") {
				rollSlot = "ring"
			}
			if strings.HasPrefix(slot, "trinket") {
				rollSlot = "trinket"
			}
			for attempt := 0; attempt < 4096; attempt++ {
				item := game.GenerateLootForSlot(rollSlot, 100)
				if item != nil && item.Rarity == rarity && strings.Contains(item.Name, base) {
					gear[slot] = databaseItem(*item)
					break
				}
			}
			if gear[slot].ID == "" {
				t.Fatalf("could not roll legal %s %s", rarity, base)
			}
		}
		if err := repo.CreateUser(names[i], names[i]+"@example.invalid", names[i]+"-local-only"); err != nil {
			t.Fatal(err)
		}
		// Fifty base points plus495 earned level points; no stat scaling.
		fixture := &database.Character{Name: names[i], Class: "Wizard", Level: 100, Gold: 1000,
			ProgressionVersion: game.CurrentProgressionVersion, LastDailyQuest: now,
			X: site.X + float64(i)*3, Z: site.Z, Equipment: gear,
			Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 335, Vitality: 180, Wisdom: 10}}
		if err := repo.SetFirstCharacter(names[i], fixture); err != nil {
			t.Fatal(err)
		}
	}
	address, stop := compatStartServer(t, binary, uri, 64, "-save-journal-dir", t.TempDir())
	defer stop()
	conns := make([]*websocket.Conn, 4)
	probes := make([]*eventSocketProbe, 4)
	for i, name := range names {
		conn, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
		if err != nil {
			t.Fatal(err)
		}
		conns[i] = conn
		defer conns[i].Close()
		resourceSend(t, conn, MsgLogin, map[string]string{"username": name, "password": name + "-local-only"})
		resourceReadMessage(t, conn, "login_success", nil)
		// Start the sole reader before join so initial state and the movement
		// context cannot be discarded while waiting for an unrelated UI message.
		probes[i] = watchPublicEventSocket(conn, ids[i])
		resourceSend(t, conn, MsgJoin, JoinPayload{Type: "Wizard"})
		arenaAwait(t, 10*time.Second, func() bool {
			p := probes[i]
			p.mu.Lock()
			defer p.mu.Unlock()
			if p.err != nil {
				t.Fatal(p.err)
			}
			return p.actors[ids[i]].id != "" && p.movementSeen
		})
	}
	for i := 1; i < len(conns); i++ {
		resourceSend(t, conns[0], MsgPartyInvite, PartyInvitePayload{TargetName: names[i]})
		arenaAwait(t, 10*time.Second, func() bool {
			p := probes[i]
			p.mu.Lock()
			defer p.mu.Unlock()
			return strings.Contains(p.invite, names[0])
		})
		resourceSend(t, conns[i], MsgPartyResponse, PartyResponsePayload{InviterName: names[0], Accepted: true})
		arenaAwait(t, 10*time.Second, func() bool {
			p := probes[0]
			p.mu.Lock()
			defer p.mu.Unlock()
			return strings.Contains(p.party, ids[i])
		})
	}
	sequences := make([]uint64, 4)
	deadline, lastWave, eventID, finished := time.Now().Add(6*time.Minute), 0, "", false
	for time.Now().Before(deadline) {
		complete := 0
		for i, p := range probes {
			p.mu.Lock()
			view, self, movement, movementSeen, updated, dead, readErr := p.view, p.actors[ids[i]], p.movement, p.movementSeen, p.updated, p.dead, p.err
			actors := make([]eventSocketActor, 0, len(p.actors))
			for _, actor := range p.actors {
				actors = append(actors, actor)
			}
			p.mu.Unlock()
			if readErr != nil || dead {
				t.Fatalf("client%d died/disconnected: %v", i, readErr)
			}
			if self.id == "" || !movementSeen || view.ID == "" {
				continue
			}
			if time.Since(updated) > 10*time.Second {
				t.Fatal("public event state stopped updating")
			}
			if eventID == "" {
				eventID = view.ID
			}
			if view.ID != eventID || view.Site.ID != site.ID || view.Phase == "expired" {
				t.Fatal("event expired or changed before completion")
			}
			if view.Phase == "complete" {
				if view.Wave != 4 || view.Remaining != 0 || !view.CalmedUntil.After(time.Now()) {
					t.Fatal("invalid completed event receipt")
				}
				complete++
				continue
			}
			if i == 0 && view.Wave != lastWave {
				lastWave = view.Wave
				t.Logf("realm=%s wave=%d phase=%s remaining=%d", site.Realm, view.Wave, view.Phase, view.Remaining)
			}
			// Follow the replicated rune. Air needs real motion; fire needs its
			// annulus. Small per-client offsets keep the four heroes separated.
			angle := float64(i) * math.Pi / 2
			if site.ID == "gale" {
				angle += float64(time.Now().UnixMilli()%6000) / 6000 * 2 * math.Pi
			}
			radius := 4.0
			if view.InnerRadius > 0 {
				radius = (view.InnerRadius + view.Radius) / 2
			}
			x, z := view.RuneX+math.Cos(angle)*radius, view.RuneZ+math.Sin(angle)*radius
			dx, dz := x-self.x, z-self.z
			distance := math.Hypot(dx, dz)
			if distance > 0.5 {
				scale := math.Min(1, 2/distance)
				sequences[i]++
				resourceSend(t, conns[i], MsgMove, MovePayload{MovementContext: movement, X: self.x + dx*scale, Z: self.z + dz*scale, State: "RUNNING", Sequence: sequences[i]})
			}
			var target string
			closest := 15.5
			for _, actor := range actors {
				if actor.kind != "Enemy" || actor.health <= 0 || actor.state == "DEAD" {
					continue
				}
				if distance := math.Hypot(actor.x-self.x, actor.z-self.z); distance < closest {
					target, closest = actor.id, distance
				}
			}
			if target != "" {
				resourceSend(t, conns[i], MsgAttack, AttackPayload{TargetID: target})
			}
		}
		if complete == len(conns) {
			finished = true
			break
		}
		time.Sleep(250 * time.Millisecond)
	}
	if !finished {
		t.Fatal("full public event did not complete within six real minutes")
	}
	for i, p := range probes {
		p.mu.Lock()
		hits, waves := p.hits, len(p.waves)
		p.mu.Unlock()
		if hits == 0 || waves != 4 {
			t.Fatalf("client%d missed actual combat or a wave: hits%d waves%d", i, hits, waves)
		}
		saved := resourceCloseAndWait(t, repo, conns[i], names[i])
		if saved.Level != 100 || saved.EP != 0 || len(saved.GoldCreditReceipts) != 0 {
			t.Fatal("event changed level/EP or granted a special Gold purse")
		}
		if saved.ResonanceXP <= 0 && saved.ResonanceLevel <= 1 {
			t.Fatal("event combat gave no saved max-level kill progression")
		}
		t.Logf("client=%d eventHits=%d waves=%d gold=%d", i, hits, waves, saved.Gold)
	}
	t.Log("four connected party members completed all three defenses and the champion; real timer and saved rewards, no mid-run grants")
}
