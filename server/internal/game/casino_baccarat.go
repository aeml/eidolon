package game

import (
	"crypto/rand"
	"errors"
	"math/big"
	"slices"
)

const BaccaratRulesVersion = "lanternhold-punto-banco-v1"

// No shoe or future cards are exposed. One result is shared by every funded
// seat; persistence must commit it once before exposing or settling the round.
type BaccaratResult struct {
	Player      []int  `json:"player"`
	Banker      []int  `json:"banker"`
	PlayerTotal int    `json:"playerTotal"`
	BankerTotal int    `json:"bankerTotal"`
	Winner      string `json:"winner"`
}

func baccaratValue(card int) int {
	value := card%13 + 1
	if value >= 10 {
		return 0
	}
	return value
}

func baccaratTotal(cards []int) int {
	total := 0
	for _, card := range cards {
		total += baccaratValue(card)
	}
	return total % 10
}

func baccaratBankerDraw(total, third int) bool {
	if third < 0 {
		return total <= 5
	}
	switch total {
	case 0, 1, 2:
		return true
	case 3:
		return third != 8
	case 4:
		return third >= 2 && third <= 7
	case 5:
		return third >= 4 && third <= 7
	case 6:
		return third == 6 || third == 7
	}
	return false
}

func NewBaccaratResult() (*BaccaratResult, error) {
	// Independently shuffled eight-deck shoe each round. Sample without
	// replacement; only six cards can be needed, so don't shuffle unused cards.
	shoe := make([]int, 8*52)
	for i := range shoe {
		shoe[i] = i % 52
	}
	cards := make([]int, 6)
	for i := range cards {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(shoe)-i)))
		if err != nil {
			return nil, err
		}
		j := i + int(n.Int64())
		shoe[i], shoe[j] = shoe[j], shoe[i]
		cards[i] = shoe[i]
	}
	result, _, err := dealBaccarat(cards)
	return result, err
}

func dealBaccarat(cards []int) (*BaccaratResult, int, error) {
	bad := errors.New("invalid baccarat cards")
	if len(cards) < 4 || len(cards) > 6 {
		return nil, 0, bad
	}
	for _, card := range cards {
		if card < 0 || card >= 52 {
			return nil, 0, bad
		}
	}
	r := &BaccaratResult{Player: []int{cards[0], cards[2]}, Banker: []int{cards[1], cards[3]}}
	used := 4
	draw := func(hand *[]int) bool {
		if used >= len(cards) {
			return false
		}
		*hand = append(*hand, cards[used])
		used++
		return true
	}
	p, b := baccaratTotal(r.Player), baccaratTotal(r.Banker)
	if p < 8 && b < 8 {
		third := -1
		if p <= 5 {
			if !draw(&r.Player) {
				return nil, 0, bad
			}
			third = baccaratValue(r.Player[2])
		}
		if baccaratBankerDraw(b, third) && !draw(&r.Banker) {
			return nil, 0, bad
		}
	}
	r.PlayerTotal, r.BankerTotal = baccaratTotal(r.Player), baccaratTotal(r.Banker)
	r.Winner = "tie"
	if r.PlayerTotal > r.BankerTotal {
		r.Winner = "player"
	}
	if r.BankerTotal > r.PlayerTotal {
		r.Winner = "banker"
	}
	return r, used, nil
}

func (r *BaccaratResult) Validate() error {
	bad := errors.New("invalid saved baccarat result")
	if r == nil || len(r.Player) < 2 || len(r.Player) > 3 || len(r.Banker) < 2 || len(r.Banker) > 3 {
		return bad
	}
	cards := []int{r.Player[0], r.Banker[0], r.Player[1], r.Banker[1]}
	if len(r.Player) == 3 {
		cards = append(cards, r.Player[2])
	}
	if len(r.Banker) == 3 {
		cards = append(cards, r.Banker[2])
	}
	expected, used, err := dealBaccarat(cards)
	if err != nil || used != len(cards) || !slices.Equal(expected.Player, r.Player) || !slices.Equal(expected.Banker, r.Banker) ||
		expected.PlayerTotal != r.PlayerTotal || expected.BankerTotal != r.BankerTotal || expected.Winner != r.Winner {
		return bad
	}
	return nil
}

func BaccaratPayout(currency string, wagers []CasinoWager, result *BaccaratResult) (int, error) {
	if err := result.Validate(); err != nil {
		return 0, err
	}
	if _, err := ValidateHouseWagers("baccarat", currency, wagers); err != nil {
		return 0, err
	}
	amount := 0
	for _, wager := range wagers {
		switch {
		case result.Winner == "tie" && wager.Spot != "tie":
			amount += wager.Amount
		case result.Winner == "tie" && wager.Spot == "tie":
			amount += wager.Amount * 9
		case result.Winner == "player" && wager.Spot == "player":
			amount += wager.Amount * 2
		case result.Winner == "banker" && wager.Spot == "banker":
			amount += wager.Amount * 39 / 20
		}
	}
	return amount, nil
}
