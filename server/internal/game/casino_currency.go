package game

// Currency is chosen by the server's physical table, never a wager payload.
// Empty denotes pre-EP Gold saves. Unknown currencies have no legal stakes.
func CasinoBetLimits(game, currency string) (minimum, maximum, step int) {
	if currency != "" && currency != "gold" && currency != "ep" {
		return 0, 0, 0
	}
	if currency == "ep" {
		switch game {
		case "blackjack":
			return 2, 100, 2 // Exact 3:2 natural profit, no rounding.
		case "poker":
			return 10, 100, 10
		case "slots":
			return 10, 100, 10 // Ten paylines each receive a whole EP.
		case "roulette":
			return 1, 100, 1
		case "baccarat":
			return 20, 100, 20 // Banker profit less 5% commission stays integral.
		}
		return 0, 0, 0
	}
	switch game {
	case "blackjack":
		return 20, BlackjackMaxBet, 20
	case "poker":
		return 100, PokerMaxBuyIn, 100
	case "slots":
		return SlotMinBet, SlotMaxBet, SlotBetStep
	case "roulette", "baccarat":
		return 20, 100000, 20
	}
	return 0, 0, 0
}

func ValidCasinoBet(game, currency string, amount int) bool {
	minimum, maximum, step := CasinoBetLimits(game, currency)
	return step > 0 && amount >= minimum && amount <= maximum && amount%step == 0
}

func PokerBlinds(currency string) (small, big int) {
	if currency == "ep" {
		return 1, 2
	}
	if currency == "gold" || currency == "" {
		return PokerSmallBlind, PokerBigBlind
	}
	return 0, 0
}
