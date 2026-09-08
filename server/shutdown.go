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
	world.Trading.StopRefundDelivery()
	serverAdmission.CloseAndWait()
	loops.Stop()
	world.StopBackground()
	// A maintenance stop is not a player forfeit. Preserve already-decided
	// results; cancel unfinished matches using the existing exit recovery.
	world.FinishPvPForShutdown()
	response := make(chan []*Client)
	hubQuiesce <- response
	for _, client := range <-response {
		client := client
		scheduleCharacterWork(func() { cleanupClient(client) })
	}
	backgroundCharacterWork.SealWhenIdle()
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
	log.Println("Character shutdown drain complete")
}

func shutdownHTTPServer(server *http.Server) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return server.Shutdown(ctx)
}
