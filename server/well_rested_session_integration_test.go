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

func TestWellRestedActualLiveResumeAndHandoff(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	address, stop := compatStartServer(t, binary, uri, 182, "-save-journal-dir", t.TempDir())
	defer stop()
	name := fmt.Sprintf("rest-resume-%d", time.Now().UnixNano())
	password := name + "-prepared-only"
	fixture := &database.Character{Name: name, Class: "Wizard", Level: 30,
		ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200,
		LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10},
		Resources:  &database.CharacterResources{Version: 1, Health: 17, Mana: 0},
		WellRested: &database.CharacterWellRested{Version: 1, RemainingSeconds: 100}}
	if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	if err := repo.SetFirstCharacter(name, fixture); err != nil {
		t.Fatal(err)
	}
	first, token := resourceLoginCharacter(t, address, name, password, fixture.Class)
	wellRestedReadActor(t, first, name, func(e *statepb.Entity) bool { return e.WellRestedSeconds >= 100.5 })
	saved := resourceCloseAndWait(t, repo, first, name)
	if saved.WellRested == nil {
		t.Fatal("disconnect omitted rest bank")
	}
	// The world keeps this disconnected entity alive for resume. A real idle
	// interval must earn/spend/heal nothing, even while simulation keeps ticking.
	time.Sleep(1500 * time.Millisecond)
	resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { resumed.Close() })
	resumeStarted := time.Now()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
	var reply struct {
		PlayerID    string `json:"playerID"`
		ResumeToken string `json:"resumeToken"`
	}
	resourceReadMessage(t, resumed, MsgResumeSession, &reply)
	if reply.PlayerID != "player-"+name || reply.ResumeToken == "" || reply.ResumeToken == token {
		t.Fatal("resume did not rotate/bind token")
	}
	restored := wellRestedReadActor(t, resumed, name, func(e *statepb.Entity) bool { return e.SafeZoneId == "lanternhold" })
	earned := restored.WellRestedSeconds - saved.WellRested.RemainingSeconds
	if earned < 0 || earned > time.Since(resumeStarted).Seconds()+.1 {
		t.Fatalf("resume earned disconnected time: %f", earned)
	}
	// Resume clears transient fractional regeneration. Derive exact bars from
	// the persisted bank delta rather than tolerating unexplained refills.
	wantHP := min(int(restored.MaxHealth), saved.Resources.Health+int(math.Floor(float64(restored.MaxHealth)*.1*earned+1e-9)))
	wantMP := min(int(restored.MaxMana), saved.Resources.Mana+int(math.Floor(float64(restored.MaxMana)*.1*earned+1e-9)))
	if int(restored.Health) != wantHP || int(restored.Mana) != wantMP {
		t.Fatalf("resume resources %d/%d, expected %d/%d from online rest only", restored.Health, restored.Mana, wantHP, wantMP)
	}

	// A second authenticated connection takes over the same live character.
	// Its bank must continue, not reload an older saved bank or accrue twice.
	handoffStarted := time.Now()
	replacement, _ := resourceLoginCharacter(t, address, name, password, fixture.Class)
	handed := wellRestedReadActor(t, replacement, name, func(e *statepb.Entity) bool { return e.SafeZoneId == "lanternhold" })
	if handed.WellRestedSeconds < restored.WellRestedSeconds || handed.WellRestedSeconds-restored.WellRestedSeconds > time.Since(handoffStarted).Seconds()+.1 {
		t.Fatal("live handoff rewound or doubled rest bank")
	}
	finalSave := resourceCloseAndWait(t, repo, replacement, name)
	if finalSave.WellRested == nil || finalSave.WellRested.RemainingSeconds < handed.WellRestedSeconds {
		t.Fatal("replacement disconnect lost live bank")
	}
	t.Log("real disconnected interval, token resume, exact regenerated bars and authenticated live handoff preserve the bank without offline or double credit")
}

func TestWellRestedActualTownBoundaryMovement(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	address, stop := compatStartServer(t, binary, uri, 183, "-save-journal-dir", t.TempDir())
	defer stop()
	name := fmt.Sprintf("rest-boundary-%d", time.Now().UnixNano())
	password := name + "-prepared-only"
	// Prepared starting save near the real north gate. Subsequent crossings use
	// ordinary sequenced movement messages; no warp/QA command or world mutation.
	fixture := &database.Character{Name: name, Class: "Wizard", Level: 30,
		ProgressionVersion: game.CurrentProgressionVersion, X: 0, Z: 100.25,
		LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10},
		Resources:  &database.CharacterResources{Version: 1, Health: 200, Mana: 100},
		WellRested: &database.CharacterWellRested{Version: 1, RemainingSeconds: 2}}
	if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	if err := repo.SetFirstCharacter(name, fixture); err != nil {
		t.Fatal(err)
	}
	conn, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	resourceSend(t, conn, MsgLogin, map[string]string{"username": name, "password": password})
	resourceReadMessage(t, conn, "login_success", nil)
	resourceSend(t, conn, MsgJoin, JoinPayload{Type: fixture.Class})
	var movement struct {
		Context string `json:"movementContext"`
	}
	resourceReadMessage(t, conn, MsgMovementContext, &movement)
	resourceReadMessage(t, conn, MsgQuestUpdate, nil)
	initial := wellRestedReadActor(t, conn, name, func(e *statepb.Entity) bool { return e.SafeZoneId == "lanternhold" && e.WellRestedSeconds >= 2.5 })
	move := func(sequence uint64, z float64) {
		resourceSend(t, conn, MsgMove, MovePayload{MovementContext: movement.Context, X: 0, Z: z, State: "IDLE", Sequence: sequence})
	}
	move(1, 100)
	edge := wellRestedReadActor(t, conn, name, func(e *statepb.Entity) bool {
		return e.MoveSequence == 1 && e.WellRestedSeconds > initial.WellRestedSeconds
	})
	if edge.Z != 100 || edge.SafeZoneId != "lanternhold" {
		t.Fatal("inclusive north-gate edge lost sanctuary")
	}
	move(2, 99.75)
	outside := wellRestedReadActor(t, conn, name, func(e *statepb.Entity) bool { return e.MoveSequence == 2 && e.SafeZoneId == "" })
	if outside.Z != 99.75 || outside.WellRestedSeconds <= 0 {
		t.Fatal("ordinary outward movement lost bank or did not cross boundary")
	}
	later := wellRestedReadActor(t, conn, name, func(e *statepb.Entity) bool {
		return e.MoveSequence == 2 && e.WellRestedSeconds < outside.WellRestedSeconds-.5
	})
	spent := outside.WellRestedSeconds - later.WellRestedSeconds
	// At most one carried fractional point, plus the unchanged passive rate;
	// leaving sanctuary must stop the much faster max-pool recovery immediately.
	if later.Mana-outside.Mana > int32(math.Ceil(float64(outside.ManaRegen)*spent))+1 {
		t.Fatal("town mana recovery leaked outside its boundary")
	}
	expired := wellRestedReadActor(t, conn, name, func(e *statepb.Entity) bool { return e.WellRestedSeconds == 0 })
	if expired.SafeZoneId != "" || expired.Stats.Strength != 10 || expired.MaxMana >= outside.MaxMana {
		t.Fatal("living outside expiry failed to remove bonus")
	}
	move(3, 100)
	returned := wellRestedReadActor(t, conn, name, func(e *statepb.Entity) bool {
		return e.MoveSequence == 3 && e.SafeZoneId == "lanternhold" && e.WellRestedSeconds > 0
	})
	if returned.Stats.Strength != 11 || returned.MaxMana != outside.MaxMana {
		t.Fatal("return to safe edge did not restore exactly one stat modifier")
	}
	resting := wellRestedReadActor(t, conn, name, func(e *statepb.Entity) bool { return e.WellRestedSeconds >= returned.WellRestedSeconds+.5 })
	wantMana := math.Min(float64(resting.MaxMana), float64(returned.Mana)+float64(resting.MaxMana)*.1*(resting.WellRestedSeconds-returned.WellRestedSeconds))
	if math.Abs(float64(resting.Mana)-wantMana) > 1.01 {
		t.Fatal("return did not resume exactly 10% max mana per second")
	}
	resourceCloseAndWait(t, repo, conn, name)
	t.Log("real gate movement covers inclusive boundary, bank countdown outside, living expiry, unstacked stat reactivation and resumed recovery")
}
