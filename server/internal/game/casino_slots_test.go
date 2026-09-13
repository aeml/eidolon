package game

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func slotConstantDraw(int) (int, error) { return 0, nil }

func TestSlotPaylinesWildSubstitutionAndJackpot(t *testing.T) {
	machine, _ := slotMachine("earth")
	grid := SlotGrid{}
	stage, _ := evaluateSlotGrid(grid, machine, 20, 1)
	if len(stage.Wins) != 10 || stage.Payout != 520 {
		t.Fatal("ten fixed line stakes are not paid correctly", stage)
	}
	for reel := range grid {
		grid[reel][1] = 5
	}
	stage, _ = evaluateSlotGrid(grid, machine, 40, 2)
	if !stage.Jackpot || stage.Payout != 8000 || len(stage.Wins) != 0 {
		t.Fatal("natural center jackpot must replace line wins", stage)
	}
	grid[0][1], grid[1][1], grid[2][1], grid[3][1] = slotWild, slotWild, slotWild, slotScatter
	stage, _ = evaluateSlotGrid(grid, machine, 20, 1)
	if stage.Jackpot {
		t.Fatal("wilds cannot substitute for the fixed jackpot")
	}
	found := false
	for _, win := range stage.Wins {
		if win.Line == 0 {
			found = win.Symbol == 5 && win.Count == 3 && win.Payout == 34
		}
	}
	if !found {
		t.Fatal("three leading wilds before scatter lost their best substitution", stage)
	}
}

func TestSlotElementalMechanics(t *testing.T) {
	earth, _ := NewSlotSession("earth")
	earth.FreeSpins = 2
	earth.StickyRows[1] = true
	next, debit, err := proposeSlotSpin(*earth, 20, slotConstantDraw)
	if err != nil || debit != 0 || next.Last.Stages[0].Grid[2][1] != slotWild || !next.StickyRows[1] || next.FreeSpins != 1 {
		t.Fatal("Earth failed to retain its free-spin wild", next, err)
	}
	if _, _, err := proposeSlotSpin(*earth, 40, slotConstantDraw); err == nil {
		t.Fatal("free-spin stake changed")
	}
	fire, _ := NewSlotSession("fire")
	fire.FreeSpins = 1
	next, debit, err = proposeSlotSpin(*fire, 20, slotConstantDraw)
	if err != nil || debit != 0 || next.Last.Payout != 1120 || next.FreeSpins != 0 {
		t.Fatal("Fire multiplier/free-spin debit", next, err)
	}
	water, _ := NewSlotSession("water")
	next, debit, err = proposeSlotSpin(*water, 20, slotConstantDraw)
	if err != nil || debit != 20 || len(next.Last.Stages) != 3 || next.Last.Payout != 1260 {
		t.Fatal("Water cascade cap/payout", next, err)
	}
	air, _ := NewSlotSession("air")
	calls := 0
	next, _, err = proposeSlotSpin(*air, 20, func(int) (int, error) {
		calls++
		if calls == 1 || calls == 9 {
			return 90, nil
		}
		return 0, nil
	})
	if err != nil || next.Last.ExpandedReel != 0 || next.Last.Stages[0].Grid[0] != [3]int{slotWild, slotWild, slotWild} {
		t.Fatal("Air failed to expand leftmost wild reel", next, err)
	}
}

func TestSlotBonusSaveRedactionResolutionAndIntegrity(t *testing.T) {
	session, _ := NewSlotSession("earth")
	calls := 0
	next, debit, err := proposeSlotSpin(*session, 20, func(limit int) (int, error) {
		calls++
		if limit == 100 && calls <= 3 {
			return 99, nil
		}
		return 0, nil
	})
	if err != nil || debit != 20 || !next.Bonus || next.FreeSpins != 5 || next.Last.FreeAwarded != 5 {
		t.Fatal("missing earned bonus/free spins", next, err)
	}
	if session.Revision != 1 || session.Last != nil {
		t.Fatal("uncommitted proposal mutated original state")
	}
	public, _ := json.Marshal(next.View())
	if strings.Contains(string(public), "bonusOffers") {
		t.Fatal("sealed rewards leaked")
	}
	saved, _ := json.Marshal(next)
	var reopened SlotSession
	if err := json.Unmarshal(saved, &reopened); err != nil || reopened.Validate() != nil {
		t.Fatal("bonus did not survive save/reopen", err)
	}
	if _, _, err := proposeSlotSpin(reopened, 20, slotConstantDraw); err == nil {
		t.Fatal("spin skipped unclaimed bonus")
	}
	resolved, reward, err := ProposeSlotBonus(reopened, 1)
	if err != nil || reward != reopened.BonusOffers[1] || resolved.Bonus || resolved.FreeSpins != 5 || resolved.Revision != reopened.Revision+1 {
		t.Fatal("bonus resolution discarded free spins", resolved, err)
	}
	if _, _, err := ProposeSlotBonus(*resolved, 1); err == nil {
		t.Fatal("resolved bonus accepted another choice")
	}
	resolved.Last.Payout++
	if resolved.Validate() == nil {
		t.Fatal("corrupt stored payout accepted")
	}
}

func TestSlotRNGFailureDoesNotConsumeEntitlement(t *testing.T) {
	s, _ := NewSlotSession("earth")
	s.FreeSpins = 3
	if _, _, err := proposeSlotSpin(*s, 20, func(int) (int, error) { return 0, errors.New("rng unavailable") }); err == nil {
		t.Fatal("randomness failure ignored")
	}
	if s.FreeSpins != 3 || s.Revision != 1 {
		t.Fatal("failed proposal consumed entitlement")
	}
	for _, machine := range SlotMachines() {
		sum := 0
		for _, weight := range machine.Weights {
			sum += weight
		}
		if sum != 100 {
			t.Fatal("invalid public symbol weights")
		}
	}
}
