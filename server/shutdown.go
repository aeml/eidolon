package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"eidolon-server/internal/lifecycle"
)

var serverAdmission = &lifecycle.Group{}
var serverStopping atomic.Bool
var hubQuiesce = make(chan chan []*Client)

// Fixed local drain milestones only: no users, request values or storage paths.
// Diagnostic progress does not authorize a timeout extension or partial save.
var shutdownDrainStages = [...]string{"refund_delivery", "admission", "loops", "world_background", "pvp", "hub", "character_work", "activity_journal", "final_characters", "complete"}

func logShutdownDrainStage(stage string) {
	for _, known := range shutdownDrainStages {
		if stage == known {
			log.Printf("Shutdown drain phase: %s", known)
			return
		}
	}
}

func lastKnownShutdownDrainStage(contents []byte) string {
	stage, latest := "unknown", -1
	text := string(contents)
	for _, known := range shutdownDrainStages {
		if offset := strings.LastIndex(text, "Shutdown drain phase: "+known+"\n"); offset > latest {
			stage, latest = known, offset
		}
	}
	return stage
}

// Only startup adds loops; shutdown cancels and joins them before world drain.
type serverLoops struct {
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

func newServerLoops() *serverLoops {
	ctx, cancel := context.WithCancel(context.Background())
	return &serverLoops{ctx: ctx, cancel: cancel}
}

func (loops *serverLoops) Every(interval time.Duration, tick func()) {
	loops.wg.Add(1)
	go func() {
		defer loops.wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-loops.ctx.Done():
				return
			case <-ticker.C:
				if loops.ctx.Err() != nil {
					return
				}
				tick()
			}
		}
	}()
}

func (loops *serverLoops) Stop() { loops.cancel(); loops.wg.Wait() }

// Every player is included, not just active sockets: completed background
// refunds/rewards may have changed a disconnected character after its last save.
func saveFinalCharacters() error {
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		return errors.New("character persistence is not initialized")
	}
	world.Mu.RLock()
	users := make([]string, 0)
	for id, entity := range world.Entities {
		if entity.Type == game.TypePlayer && strings.HasPrefix(id, "player-") {
			users = append(users, strings.TrimPrefix(id, "player-"))
		}
	}
	world.Mu.RUnlock()
	sort.Strings(users)
	var failures []error
	pending := make(map[string]*database.PendingCharacterSave, len(users))
	for _, user := range users {
		unlock := lockCharacterWork(user)
		entity := world.GetEntityCopy("player-" + user)
		if entity != nil {
			save, err := journalCharacterSnapshot(user, characterSnapshotForSave(user, entity))
			noteCharacterSaveFailure(user, err != nil)
			if err != nil {
				failures = append(failures, err)
			} else {
				pending[user] = save
			}
		}
		unlock()
	}
	if len(failures) > 0 {
		return errors.Join(failures...)
	}
	// Every final character is durable now. Stop after the first Mongo failure
	// rather than repeating its timeout for every user; replay remaining files
	// at the next startup before opening admission.
	for _, user := range users {
		if pending[user] == nil {
			continue
		}
		unlock := lockCharacterWork(user)
		err := commitPendingCharacterSave(pending[user])
		noteCharacterSaveFailure(user, err != nil)
		unlock()
		if err != nil {
			log.Printf("Final character saves retained for startup recovery: %v", err)
			break
		}
	}
	return nil
}

func drainServer(loops *serverLoops) {
	serverStopping.Store(true)
	logShutdownDrainStage("refund_delivery")
	world.Trading.StopRefundDelivery()
	logShutdownDrainStage("admission")
	serverAdmission.CloseAndWait()
	logShutdownDrainStage("loops")
	loops.Stop()
	logShutdownDrainStage("world_background")
	world.StopBackground()
	// A maintenance stop is not a player forfeit. Preserve already-decided
	// results; cancel unfinished matches using the existing exit recovery.
	logShutdownDrainStage("pvp")
	world.FinishPvPForShutdown()
	response := make(chan []*Client)
	logShutdownDrainStage("hub")
	hubQuiesce <- response
	for _, client := range <-response {
		scheduleClientCleanup(client)
	}
	logShutdownDrainStage("character_work")
	backgroundCharacterWork.SealWhenIdle()
	logShutdownDrainStage("activity_journal")
	for {
		if err := persistUnjournaledActivity(); err == nil {
			break
		}
		log.Print("Shutdown waiting for durable session activity storage")
		time.Sleep(time.Second)
	}
	logShutdownDrainStage("final_characters")
	for {
		if err := saveFinalCharacters(); err == nil {
			break
		} else {
			// Never knowingly exit successfully with the newest state only in RAM.
			// Admission stays closed; an operator can restore writable storage.
			log.Printf("Shutdown waiting for durable character storage: %v", err)
		}
		time.Sleep(time.Second)
	}
	logShutdownDrainStage("complete")
	log.Println("Character shutdown drain complete")
}

func shutdownHTTPServer(server *http.Server) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return server.Shutdown(ctx)
}
