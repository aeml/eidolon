package main

import (
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestPokerRestartGraceIncludesWalkBackAfterLogin(t *testing.T) {
	previousWorld, previousGrace := world, pokerRecoveryUntil
	t.Cleanup(func() { world, pokerRecoveryUntil = previousWorld, previousGrace })
	now := time.Now()
	pokerRecoveryUntil = now.Add(game.CasinoReconnectGrace)
	world = &game.World{Entities: map[string]*game.Entity{}}
	participant := pokerParticipant{PlayerID: "player-vip", Seat: 1}
	if !pokerHandRecovering(participant, now) {
		t.Fatal("offline funded participant lost restart grace")
	}
	player := &game.Entity{ID: participant.PlayerID, Type: game.TypePlayer, Health: 100, InstanceID: game.CasinoInstanceID}
	world.Entities[player.ID] = player
	if !pokerHandRecovering(participant, now) {
		t.Fatal("logging in downstairs folded participant before they could walk to their seat")
	}
	if pokerHandRecovering(participant, pokerRecoveryUntil) {
		t.Fatal("login extended the original restart grace")
	}
	player.CasinoSeat = &game.CasinoSeatSession{TableID: "public-blackjack"}
	if pokerHandRecovering(participant, now) {
		t.Fatal("occupying a different table retained poker recovery grace")
	}
	player.CasinoSeat = nil
	player.InstanceID = ""
	if pokerHandRecovering(participant, now) {
		t.Fatal("leaving the casino retained recovery grace")
	}
	player.InstanceID, player.Health = game.CasinoInstanceID, 0
	if pokerHandRecovering(participant, now) {
		t.Fatal("dead participant retained recovery grace")
	}
}
