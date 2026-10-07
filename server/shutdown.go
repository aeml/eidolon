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
	// Independent account journals may overlap their local fsyncs. Keep the
	// account work lock, fixed four-worker bound and a full join before ANY
	// database commit. No final snapshot or durable acknowledgement is skipped.
	failures := make([]error, len(users))
	pending := make([]*database.PendingCharacterSave, len(users))
	jobs := make(chan int, len(users))
	workers := min(4, len(users))
	started := time.Now()
	log.Printf("Final character persistence: phase=journal started accounts=%d workers=%d", len(users), workers)
	var writers sync.WaitGroup
	writers.Add(workers)
	for range workers {
		go func() {
			defer writers.Done()
			for index := range jobs {
				user := users[index]
				unlock := lockCharacterWork(user)
				entity := world.GetEntityCopy("player-" + user)
				if entity != nil {
					pending[index], failures[index] = journalCharacterSnapshot(user, characterSnapshotForSave(user, entity))
					noteCharacterSaveFailure(user, failures[index] != nil)
				}
				unlock()
			}
		}()
	}
	for index := range users {
		jobs <- index
	}
	close(jobs)
	writers.Wait()
	prepared, journalFailures := 0, 0
	for index := range users {
		if pending[index] != nil {
			prepared++
		}
		if failures[index] != nil {
			journalFailures++
		}
	}
	log.Printf("Final character persistence: phase=journal completed accounts=%d prepared=%d failed=%d elapsed_ms=%d", len(users), prepared, journalFailures, time.Since(started).Milliseconds())
	if err := errors.Join(failures...); err != nil {
		return err
	}
	// Every final character is durable now. Stop after the first Mongo failure
	// rather than repeating its timeout for every user; replay remaining files
	// at the next startup before opening admission.
	started = time.Now()
	log.Printf("Final character persistence: phase=commit started accounts=%d", len(users))
	attempted, committed := 0, 0
	for index, user := range users {
		if pending[index] == nil {
			continue
		}
		unlock := lockCharacterWork(user)
		attempted++
		err := commitPendingCharacterSave(pending[index])
		noteCharacterSaveFailure(user, err != nil)
		unlock()
		if err != nil {
			log.Printf("Final character saves retained for startup recovery: %v", err)
			break
		}
		committed++
	}
	log.Printf("Final character persistence: phase=commit completed attempted=%d committed=%d retained=%t elapsed_ms=%d", attempted, committed, attempted > committed, time.Since(started).Milliseconds())
	return nil
}

func drainServer(loops *serverLoops) {
	serverStopping.Store(true)
	world.Trading.StopRefundDelivery()
	log.Print("Shutdown drain: phase=admission")
	serverAdmission.CloseAndWait()
	log.Print("Shutdown drain: phase=periodic_loops")
	loops.Stop()
	log.Print("Shutdown drain: phase=world_work")
	world.StopBackground()
	// A maintenance stop is not a player forfeit. Preserve already-decided
	// results; cancel unfinished matches using the existing exit recovery.
	log.Print("Shutdown drain: phase=pvp")
	world.FinishPvPForShutdown()
	log.Print("Shutdown drain: phase=connections")
	response := make(chan []*Client)
	hubQuiesce <- response
	for _, client := range <-response {
		scheduleClientCleanup(client)
	}
	log.Print("Shutdown drain: phase=character_work")
	backgroundCharacterWork.SealWhenIdle()
	log.Print("Shutdown drain: phase=session_activity")
	for {
		if err := persistUnjournaledActivity(); err == nil {
			break
		}
		log.Print("Shutdown waiting for durable session activity storage")
		time.Sleep(time.Second)
	}
	log.Print("Shutdown drain: phase=final_characters")
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
