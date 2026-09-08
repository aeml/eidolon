package main

import (
	"encoding/json"
	"fmt"
	"math"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

func wellRestedReadActor(t *testing.T, conn *websocket.Conn, name string, predicate func(*statepb.Entity) bool) *statepb.Entity {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(20 * time.Second))
	for {
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind == websocket.TextMessage {
			var msg Message
			if json.Unmarshal(data, &msg) == nil && msg.Type == MsgError {
				t.Fatalf("rest session rejected: %s", msg.Payload)
			}
			continue
		}
		if len(data) < 5 || string(data[:4]) != "EDPB" {
			t.Fatal("unexpected state encoding")
		}
		var envelope statepb.StateEnvelope
		if err := proto.Unmarshal(data[5:], &envelope); err != nil {
			t.Fatal(err)
		}
		entities := envelope.GetFull().GetEntities()
		if envelope.GetDelta() != nil {
			entities = envelope.GetDelta().GetEntities()
		}
		for _, entity := range entities {
			if entity.Id == "player-"+name && predicate(entity) {
				return entity
			}
		}
	}
}

// Prepared saves and real sockets/processes. No accelerated time, test commands,
// protected combat, or suppressed town recovery. This proves the lifecycle, not
// an earned encounter or balance approval.
func TestWellRestedActualSessionsAndRestart(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	dir := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 180, "-save-journal-dir", dir)
	makeFixture := func(class string, dead, outside bool, bank float64) (*database.Character, string) {
		name := fmt.Sprintf("rest-%s-%d", class, time.Now().UnixNano())
		password := name + "-prepared-only"
		hp := 1
		if dead {
			hp = 0
		}
		fixture := &database.Character{Name: name, Class: class, Level: 30, Gold: 1234,
			ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200,
			LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10},
			Resources:  &database.CharacterResources{Version: 1, Health: hp, Mana: 0, Dead: dead},
			WellRested: &database.CharacterWellRested{Version: 1, RemainingSeconds: bank}}
		if outside {
			fixture.X, fixture.Z = 5000, 5000
		}
		if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
			t.Fatal(err)
		}
		if err := repo.SetFirstCharacter(name, fixture); err != nil {
			t.Fatal(err)
		}
		return fixture, password
	}
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		fixture, password := makeFixture(class, false, false, 100)
		conn, _ := resourceLoginCharacter(t, address, fixture.Name, password, class)
		first := wellRestedReadActor(t, conn, fixture.Name, func(e *statepb.Entity) bool { return e.SafeZoneId == "lanternhold" })
		later := wellRestedReadActor(t, conn, fixture.Name, func(e *statepb.Entity) bool { return e.WellRestedSeconds >= first.WellRestedSeconds+1.2 })
		elapsed := later.WellRestedSeconds - first.WellRestedSeconds
		for _, resource := range [][3]float64{{float64(first.Health), float64(later.Health), float64(later.MaxHealth)}, {float64(first.Mana), float64(later.Mana), float64(later.MaxMana)}} {
			want := math.Min(resource[2], resource[0]+resource[2]*.1*elapsed)
			if math.Abs(resource[1]-want) > 1.01 {
				t.Fatalf("%s actual recovery=%v elapsed=%f want=%f", class, resource, elapsed, want)
			}
		}
		if later.Stats.Strength != 11 || later.Stats.Wisdom != 11 || later.Gold != 1234 {
			t.Fatal("rest stats or unrelated gold incorrect")
		}
		saved := resourceCloseAndWait(t, repo, conn, fixture.Name)
		if saved.WellRested == nil || saved.WellRested.RemainingSeconds < later.WellRestedSeconds || saved.Stats.Strength != 10 {
			t.Fatal("disconnect lost bank or persisted boosted base stats")
		}
	}
	full, fullPassword := makeFixture("Wizard", false, false, 7200)
	fullConn, _ := resourceLoginCharacter(t, address, full.Name, fullPassword, full.Class)
	fullState := wellRestedReadActor(t, fullConn, full.Name, func(e *statepb.Entity) bool { return e.Health == e.MaxHealth && e.Mana == e.MaxMana })
	if fullState.WellRestedSeconds != 7200 {
		t.Fatal("capped rest bank changed while healing to full")
	}
	resourceCloseAndWait(t, repo, fullConn, full.Name)
	dead, deadPassword := makeFixture("Rogue", true, false, 123.456789)
	deadConn, _ := resourceLoginCharacter(t, address, dead.Name, deadPassword, dead.Class)
	wellRestedReadActor(t, deadConn, dead.Name, func(e *statepb.Entity) bool { return e.SafeZoneId == "lanternhold" })
	outside, outsidePassword := makeFixture("Cleric", true, true, .5)
	outsideConn, _ := resourceLoginCharacter(t, address, outside.Name, outsidePassword, outside.Class)
	expired := wellRestedReadActor(t, outsideConn, outside.Name, func(e *statepb.Entity) bool { return e.WellRestedSeconds == 0 })
	if expired.Health != 0 || expired.Mana != 0 || expired.State != "DEAD" || expired.Stats.Strength != 10 || expired.SafeZoneId != "" {
		t.Fatal("outside expiry altered death/resources or kept boosted stats")
	}
	resourceCloseAndWait(t, repo, outsideConn, outside.Name)
	deadSaved := resourceCloseAndWait(t, repo, deadConn, dead.Name)
	if deadSaved.WellRested.RemainingSeconds != 123.456789 || !deadSaved.Resources.Dead || deadSaved.Resources.Health != 0 || deadSaved.Resources.Mana != 0 {
		t.Fatal("safe-zone corpse regenerated or earned/spent rest")
	}
	stop()
	address, stopRecovered := compatStartServer(t, binary, uri, 181, "-save-journal-dir", dir)
	defer stopRecovered()
	rejoined, _ := resourceLoginCharacter(t, address, dead.Name, deadPassword, dead.Class)
	restored := wellRestedReadActor(t, rejoined, dead.Name, func(e *statepb.Entity) bool { return e.SafeZoneId == "lanternhold" })
	if restored.WellRestedSeconds != 123.456789 || restored.Health != 0 || restored.Mana != 0 || restored.State != "DEAD" {
		t.Fatal("fresh process failed exact offline rest/death restoration")
	}
	resourceCloseAndWait(t, repo, rejoined, dead.Name)
	t.Log("four-class real-time recovery, cap, corpse pause/outside expiry, ordinary disconnect and fresh-process rest restoration passed")
}
