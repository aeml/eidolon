package game

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"slices"
	"strconv"
	"strings"
)

const RouletteRulesVersion = "lanternhold-single-zero-v1"

// The client selects catalog identities, never odds or winning numbers.
// Returns include the original stake; the combined slip has one table limit.
type CasinoWager struct {
	Spot   string `json:"spot"`
	Amount int    `json:"amount"`
}

type RouletteSpot struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	Numbers    []int  `json:"numbers"`
	Multiplier int    `json:"multiplier"`
}

func RouletteColor(number int) string {
	if number == 0 {
		return "green"
	}
	if number < 0 || number > 36 {
		return ""
	}
	if slices.Contains([]int{1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}, number) {
		return "red"
	}
	return "black"
}

// Standard European board: inside combinations, first four, and all outside bets.
// Every call owns its slices so a renderer or caller cannot mutate the rules.
func RouletteSpots() []RouletteSpot {
	var spots []RouletteSpot
	add := func(kind string, numbers ...int) {
		parts := make([]string, len(numbers))
		for i, number := range numbers {
			parts[i] = strconv.Itoa(number)
		}
		id := kind + ":" + strings.Join(parts, "-")
		spots = append(spots, RouletteSpot{id, strings.Title(kind) + " " + strings.Join(parts, "/"), numbers, 36 / len(numbers)})
	}
	for n := 0; n <= 36; n++ {
		add("number", n)
	}
	for n := 1; n <= 36; n++ {
		if n%3 != 0 {
			add("split", n, n+1)
		}
		if n <= 33 {
			add("split", n, n+3)
		}
		if n%3 == 1 {
			add("street", n, n+1, n+2)
		}
		if n <= 33 && n%3 != 0 {
			add("corner", n, n+1, n+3, n+4)
		}
		if n <= 31 && n%3 == 1 {
			add("line", n, n+1, n+2, n+3, n+4, n+5)
		}
	}
	for n := 1; n <= 3; n++ {
		add("split", 0, n)
	}
	add("trio", 0, 1, 2)
	add("trio", 0, 2, 3)
	add("first-four", 0, 1, 2, 3)
	outside := []string{"red", "black", "odd", "even", "low", "high", "dozen-1", "dozen-2", "dozen-3", "column-1", "column-2", "column-3"}
	for _, kind := range outside {
		var numbers []int
		for n := 1; n <= 36; n++ {
			matches := kind == RouletteColor(n) || (kind == "odd" && n%2 == 1) || (kind == "even" && n%2 == 0) ||
				(kind == "low" && n <= 18) || (kind == "high" && n >= 19) ||
				kind == fmt.Sprintf("dozen-%d", (n-1)/12+1) || kind == fmt.Sprintf("column-%d", (n-1)%3+1)
			if matches {
				numbers = append(numbers, n)
			}
		}
		spots = append(spots, RouletteSpot{kind, strings.ReplaceAll(kind, "-", " "), numbers, 36 / len(numbers)})
	}
	return spots
}

func RouletteSpin() (int, error) {
	number, err := rand.Int(rand.Reader, big.NewInt(37))
	if err != nil {
		return 0, err
	}
	return int(number.Int64()), nil
}

func ValidateHouseWagers(kind, currency string, wagers []CasinoWager) (int, error) {
	if len(wagers) == 0 || len(wagers) > 160 {
		return 0, errors.New("choose at least one valid betting spot")
	}
	_, maximum, _ := CasinoBetLimits(kind, currency)
	valid := map[string]bool{}
	switch kind {
	case "roulette":
		for _, spot := range RouletteSpots() {
			valid[spot.ID] = true
		}
	case "baccarat":
		valid = map[string]bool{"player": true, "banker": true, "tie": true}
	default:
		return 0, errors.New("unknown house game")
	}
	total := 0
	for _, wager := range wagers {
		if !valid[wager.Spot] || !ValidCasinoBet(kind, currency, wager.Amount) || wager.Amount > maximum-total {
			return 0, errors.New("invalid, duplicate or over-limit wager")
		}
		delete(valid, wager.Spot)
		total += wager.Amount
	}
	return total, nil
}

func RoulettePayout(currency string, wagers []CasinoWager, number int) (int, error) {
	if RouletteColor(number) == "" {
		return 0, errors.New("invalid roulette outcome")
	}
	if _, err := ValidateHouseWagers("roulette", currency, wagers); err != nil {
		return 0, err
	}
	wins := map[string]int{}
	for _, spot := range RouletteSpots() {
		if slices.Contains(spot.Numbers, number) {
			wins[spot.ID] = spot.Multiplier
		}
	}
	amount := 0
	for _, wager := range wagers {
		amount += wager.Amount * wins[wager.Spot]
	}
	return amount, nil
}
