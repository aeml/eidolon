package game

import (
	"crypto/rand"
	"errors"
	"math/big"
)

const SlotRulesVersion = "fourfold-slots-v1"

const SlotMinBet = 20
const SlotMaxBet = 100000
const SlotBetStep = 20
const SlotMaxPayout = SlotMaxBet * 200 // Fire free-spin jackpot; other themes stay below this bound.
const slotWild, slotScatter = 6, 7

// Five reels, three rows, ten fixed left-to-right paylines. Each landed cell is
// independently weighted; cosmetic reel animation never chooses an outcome.
type SlotGrid [5][3]int

var slotLines = [10][5]int{{1, 1, 1, 1, 1}, {0, 0, 0, 0, 0}, {2, 2, 2, 2, 2},
	{0, 1, 2, 1, 0}, {2, 1, 0, 1, 2}, {0, 0, 1, 2, 2}, {2, 2, 1, 0, 0},
	{1, 0, 0, 0, 1}, {1, 2, 2, 2, 1}, {0, 1, 1, 1, 0}}

func SlotPaylines() [10][5]int { return slotLines }

type SlotMachine struct {
	Theme        string    `json:"theme"`
	Name         string    `json:"name"`
	Lore         string    `json:"lore"`
	Mechanic     string    `json:"mechanic"`
	Symbols      [8]string `json:"symbols"`
	BonusTitle   string    `json:"bonusTitle"`
	BonusChoices [3]string `json:"bonusChoices"`
	FreeSpins    int       `json:"freeSpins"`
	Weights      [8]int    `json:"weights"`
	Pays         [6][3]int `json:"pays"` // Multiples of one line's stake for 3/4/5.
}

func SlotMachines() []SlotMachine {
	machines := []SlotMachine{
		{Theme: "earth", Name: "Orun's Living Vault", Lore: "The Rootheart remembers doors opened in kindness. Follow its roots beneath the old road.", Mechanic: "During free spins, wilds on the middle reel remain rooted until the feature ends.", Symbols: [8]string{"Seed", "Fern", "Amber", "Roadward", "Rootheart", "Orun", "Living root", "Vault key"}, BonusTitle: "The buried archive", BonusChoices: [3]string{"Unseal the seed chest", "Read the stone tablet", "Follow the silver root"}, FreeSpins: 5},
		{Theme: "fire", Name: "Pyralis's Ember Forge", Lore: "The Ember Crown was made to warm a thousand hearths, not a single throne.", Mechanic: "Free-spin wins, including jackpots, are doubled by the forge flame.", Symbols: [8]string{"Coal", "Cinder", "Anvil", "Phoenix", "Ember Crown", "Pyralis", "Forge flame", "Bellows"}, BonusTitle: "Relight a forgotten hearth", BonusChoices: [3]string{"Temper the old blade", "Mend the pilgrim's lamp", "Open the phoenix kiln"}, FreeSpins: 3},
		{Theme: "water", Name: "Neris's Returning Tide", Lore: "Tidestar carries each lost name home. Even a broken vessel may return with a story.", Mechanic: "Winning symbols fall away and refill for up to two additional cascades; a jackpot ends the cascade.", Symbols: [8]string{"Shell", "Pearl", "Coral", "Memory vessel", "Tidestar", "Neris", "Returning tide", "Drowned name"}, BonusTitle: "Names beneath the water", BonusChoices: [3]string{"Recover the ferry bell", "Raise the memory urn", "Open the coral shrine"}, FreeSpins: 3},
		{Theme: "air", Name: "Aeral's Unbound Horizon", Lore: "Skyglass offers a thousand roads. No king can decree which horizon a traveler must choose.", Mechanic: "Two or more landed wilds expand the leftmost wild-bearing reel. Free spins always expand a landed wild reel.", Symbols: [8]string{"Feather", "Cloud", "Wind chime", "Storm harpy", "Skyglass", "Aeral", "Free wind", "Horizon seal"}, BonusTitle: "Three roads through the sky", BonusChoices: [3]string{"Follow the dawn current", "Ring the silent bell", "Unbind the storm kite"}, FreeSpins: 4},
	}
	for i := range machines {
		machines[i].Weights = [8]int{24, 20, 16, 12, 10, 8, 5, 5}
		// Explicit public tables price each mechanic, including its free spins.
		// One-off full-feature sampling is documented in the slot handoff; these
		// are not a promised return for a player or an exact RTP certification.
		switch machines[i].Theme {
		case "earth":
			machines[i].Pays = [6][3]int{{5, 14, 26}, {7, 18, 30}, {9, 22, 34}, {11, 26, 38}, {13, 30, 42}, {17, 34, 48}}
		case "fire":
			machines[i].Pays = [6][3]int{{5, 16, 28}, {7, 20, 32}, {9, 24, 36}, {12, 28, 40}, {14, 32, 44}, {18, 36, 50}}
		case "water":
			machines[i].Pays = [6][3]int{{6, 12, 21}, {7, 15, 24}, {7, 18, 27}, {9, 21, 30}, {10, 24, 33}, {13, 27, 37}}
		case "air":
			machines[i].Pays = [6][3]int{{4, 12, 21}, {5, 15, 24}, {6, 18, 27}, {9, 21, 30}, {10, 24, 33}, {13, 27, 37}}
		}
	}
	return machines
}

func slotMachine(theme string) (SlotMachine, bool) {
	for _, machine := range SlotMachines() {
		if machine.Theme == theme {
			return machine, true
		}
	}
	return SlotMachine{}, false
}

type SlotLineWin struct {
	Line   int `json:"line"`
	Symbol int `json:"symbol"`
	Count  int `json:"count"`
	Payout int `json:"payout"`
}

type SlotStage struct {
	Grid    SlotGrid      `json:"grid"`
	Wins    []SlotLineWin `json:"wins"`
	Payout  int           `json:"payout"`
	Jackpot bool          `json:"jackpot"`
}

type SlotResult struct {
	Landed       SlotGrid    `json:"landed"`
	Stages       []SlotStage `json:"stages"`
	Payout       int         `json:"payout"`
	Scatters     int         `json:"scatters"`
	Free         bool        `json:"free"`
	FreeAwarded  int         `json:"freeAwarded"`
	ExpandedReel int         `json:"expandedReel"` // -1 unless Air expanded a reel.
	BonusPicked  int         `json:"bonusPicked"`  // -1 until the bonus is resolved.
	BonusPayout  int         `json:"bonusPayout"`
}

// Private save state. Never marshal this directly to a client: bonus offers are
// committed BEFORE the player chooses and remain hidden until that choice.
type SlotSession struct {
	Rules       string      `json:"rules"`
	Theme       string      `json:"theme"`
	Revision    uint64      `json:"revision"`
	Bet         int         `json:"bet"`
	FreeSpins   int         `json:"freeSpins"`
	StickyRows  [3]bool     `json:"stickyRows"`
	Bonus       bool        `json:"bonus"`
	BonusOffers [3]int      `json:"bonusOffers"`
	Last        *SlotResult `json:"last,omitempty"`
}

type SlotView struct {
	Theme      string      `json:"theme"`
	Revision   uint64      `json:"revision"`
	Bet        int         `json:"bet"`
	FreeSpins  int         `json:"freeSpins"`
	StickyRows [3]bool     `json:"stickyRows"`
	Bonus      bool        `json:"bonus"`
	Last       *SlotResult `json:"last,omitempty"`
}

func (s SlotSession) View() SlotView {
	return SlotView{s.Theme, s.Revision, s.Bet, s.FreeSpins, s.StickyRows, s.Bonus, s.Last}
}
func ValidSlotBet(bet int) bool {
	return bet >= SlotMinBet && bet <= SlotMaxBet && bet%SlotBetStep == 0
}
func NewSlotSession(theme string) (*SlotSession, error) {
	if _, ok := slotMachine(theme); !ok {
		return nil, errors.New("unknown elemental machine")
	}
	return &SlotSession{Rules: SlotRulesVersion, Theme: theme, Revision: 1, Bet: 20}, nil
}

func (s SlotSession) Validate() error {
	machine, known := slotMachine(s.Theme)
	if !known || s.Rules != SlotRulesVersion || s.Revision == 0 || !ValidSlotBet(s.Bet) || s.FreeSpins < 0 || s.FreeSpins > 12 {
		return errors.New("invalid saved slot session")
	}
	if s.Bonus {
		seen := map[int]bool{}
		for _, offer := range s.BonusOffers {
			if offer != s.Bet && offer != s.Bet*2 && offer != s.Bet*5 {
				return errors.New("invalid saved bonus")
			}
			seen[offer] = true
		}
		if len(seen) != 3 || s.Last == nil || s.Last.BonusPicked != -1 {
			return errors.New("invalid unresolved bonus")
		}
	} else if s.BonusOffers != [3]int{} {
		return errors.New("stale hidden bonus offers")
	}
	if s.Theme != "earth" && s.StickyRows != [3]bool{} {
		return errors.New("invalid machine sticky wilds")
	}
	if s.Last != nil {
		if len(s.Last.Stages) < 1 || len(s.Last.Stages) > 3 || s.Last.Payout < 0 || s.Last.Payout > s.Bet*200 || s.Last.BonusPayout < 0 || s.Last.BonusPayout > s.Bet*5 {
			return errors.New("invalid saved slot result")
		}
		for _, grid := range append([]SlotGrid{s.Last.Landed}, slotResultGrids(s.Last.Stages)...) {
			for _, reel := range grid {
				for _, symbol := range reel {
					if symbol < 0 || symbol > slotScatter {
						return errors.New("invalid saved slot symbol")
					}
				}
			}
		}
		if s.Theme != "water" && len(s.Last.Stages) != 1 {
			return errors.New("unexpected saved cascade")
		}
		if s.Last.BonusPicked < -1 || s.Last.BonusPicked > 2 || s.Last.ExpandedReel < -1 || s.Last.ExpandedReel > 4 || (s.Theme != "air" && s.Last.ExpandedReel != -1) || s.Last.FreeAwarded < 0 || s.Last.FreeAwarded > machine.FreeSpins {
			return errors.New("invalid saved feature result")
		}
		if (s.Last.BonusPicked == -1 && s.Last.BonusPayout != 0) || (s.Last.BonusPicked >= 0 && s.Last.BonusPayout != s.Bet && s.Last.BonusPayout != s.Bet*2 && s.Last.BonusPayout != s.Bet*5) {
			return errors.New("invalid saved bonus payout")
		}
		scatters := 0
		for _, reel := range s.Last.Landed {
			for _, symbol := range reel {
				if symbol == slotScatter {
					scatters++
				}
			}
		}
		if scatters != s.Last.Scatters {
			return errors.New("invalid saved scatter count")
		}
		total, multiplier := 0, 1
		if s.Theme == "fire" && s.Last.Free {
			multiplier = 2
		}
		for i, stage := range s.Last.Stages {
			expected, _ := evaluateSlotGrid(stage.Grid, machine, s.Bet, multiplier)
			if expected.Payout != stage.Payout || expected.Jackpot != stage.Jackpot || len(expected.Wins) != len(stage.Wins) {
				return errors.New("saved slot payout disagrees with grid")
			}
			for line := range expected.Wins {
				if expected.Wins[line] != stage.Wins[line] {
					return errors.New("invalid saved payline")
				}
			}
			if i < len(s.Last.Stages)-1 && (stage.Jackpot || stage.Payout == 0) {
				return errors.New("invalid saved cascade continuation")
			}
			total += stage.Payout
		}
		if total != s.Last.Payout {
			return errors.New("invalid saved slot total")
		}
	}
	return nil
}

func slotResultGrids(stages []SlotStage) []SlotGrid {
	grids := make([]SlotGrid, len(stages))
	for i := range stages {
		grids[i] = stages[i].Grid
	}
	return grids
}

func secureSlotDraw(limit int) (int, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(limit)))
	if err != nil {
		return 0, err
	}
	return int(n.Int64()), nil
}

// Returns an uncommitted proposal and the required debit. Persistence must save
// the proposal/intent, debit exactly once, then settle Last.Payout before allowing
// another action. A free spin is never replaced by a paid spin on reconnect.
func ProposeSlotSpin(s SlotSession, bet int) (*SlotSession, int, error) {
	return proposeSlotSpin(s, bet, secureSlotDraw)
}

func proposeSlotSpin(s SlotSession, bet int, draw func(int) (int, error)) (*SlotSession, int, error) {
	if err := s.Validate(); err != nil {
		return nil, 0, err
	}
	if s.Bonus || !ValidSlotBet(bet) || (s.FreeSpins > 0 && bet != s.Bet) {
		return nil, 0, errors.New("resolve the bonus and keep its original stake for free spins")
	}
	machine, _ := slotMachine(s.Theme)
	free, debit := s.FreeSpins > 0, bet
	if free {
		debit = 0
		s.FreeSpins--
	} else {
		s.StickyRows = [3]bool{}
	}
	s.Bet = bet
	s.Revision++
	s.Last = &SlotResult{Free: free, ExpandedReel: -1, BonusPicked: -1}
	roll := func() (int, error) {
		n, err := draw(100)
		if err != nil {
			return 0, err
		}
		if n < 0 || n >= 100 {
			return 0, errors.New("invalid random draw")
		}
		for symbol, weight := range machine.Weights {
			if n < weight {
				return symbol, nil
			}
			n -= weight
		}
		return 0, errors.New("invalid machine weights")
	}
	var grid SlotGrid
	for reel := range grid {
		for row := range grid[reel] {
			symbol, err := roll()
			if err != nil {
				return nil, 0, err
			}
			grid[reel][row] = symbol
		}
	}
	s.Last.Landed = grid
	wilds, firstWild := 0, -1
	for reel := range grid {
		for _, symbol := range grid[reel] {
			if symbol == slotScatter {
				s.Last.Scatters++
			}
			if symbol == slotWild {
				wilds++
				if firstWild < 0 {
					firstWild = reel
				}
			}
		}
	}
	if s.Theme == "earth" && free {
		for row := range grid[2] {
			s.StickyRows[row] = s.StickyRows[row] || grid[2][row] == slotWild
			if s.StickyRows[row] {
				grid[2][row] = slotWild
			}
		}
	}
	if s.Theme == "air" && firstWild >= 0 && (wilds >= 2 || free) {
		grid[firstWild] = [3]int{slotWild, slotWild, slotWild}
		s.Last.ExpandedReel = firstWild
	}
	multiplier := 1
	if s.Theme == "fire" && free {
		multiplier = 2
	}
	for cascade := 0; ; cascade++ {
		stage, removed := evaluateSlotGrid(grid, machine, bet, multiplier)
		s.Last.Stages = append(s.Last.Stages, stage)
		s.Last.Payout += stage.Payout
		if s.Theme != "water" || cascade == 2 || stage.Payout == 0 || stage.Jackpot {
			break
		}
		for reel := range grid {
			write := 2
			for row := 2; row >= 0; row-- {
				if !removed[reel][row] {
					grid[reel][write] = grid[reel][row]
					write--
				}
			}
			for write >= 0 {
				symbol, err := roll()
				if err != nil {
					return nil, 0, err
				}
				grid[reel][write] = symbol
				write--
			}
		}
	}
	if s.Last.Scatters >= 3 {
		s.Last.FreeAwarded = min(machine.FreeSpins, 12-s.FreeSpins)
		s.FreeSpins += s.Last.FreeAwarded
		s.Bonus = true
		s.BonusOffers = [3]int{bet, bet * 2, bet * 5}
		for i := 2; i > 0; i-- {
			j, err := draw(i + 1)
			if err != nil {
				return nil, 0, err
			}
			if j < 0 || j > i {
				return nil, 0, errors.New("invalid bonus draw")
			}
			s.BonusOffers[i], s.BonusOffers[j] = s.BonusOffers[j], s.BonusOffers[i]
		}
	}
	return &s, debit, s.Validate()
}

func evaluateSlotGrid(grid SlotGrid, machine SlotMachine, bet, multiplier int) (SlotStage, [5][3]bool) {
	stage := SlotStage{Grid: grid, Wins: []SlotLineWin{}}
	var removed [5][3]bool
	jackpot := true
	for reel := range grid {
		jackpot = jackpot && grid[reel][1] == 5
	}
	if jackpot {
		stage.Jackpot = true
		stage.Payout = bet * 100 * multiplier
		return stage, removed
	}
	for line, rows := range slotLines {
		best := SlotLineWin{Line: line}
		for symbol := 0; symbol < slotWild; symbol++ {
			count := 0
			for reel, row := range rows {
				if grid[reel][row] != symbol && grid[reel][row] != slotWild {
					break
				}
				count++
			}
			if count < 3 {
				continue
			}
			payout := machine.Pays[symbol][count-3] * (bet / 10) * multiplier
			if payout > best.Payout || (payout == best.Payout && count > best.Count) {
				best = SlotLineWin{line, symbol, count, payout}
			}
		}
		if best.Payout == 0 {
			continue
		}
		stage.Wins = append(stage.Wins, best)
		stage.Payout += best.Payout
		for reel := 0; reel < best.Count; reel++ {
			removed[reel][rows[reel]] = true
		}
	}
	return stage, removed
}

func ProposeSlotBonus(s SlotSession, choice int) (*SlotSession, int, error) {
	if err := s.Validate(); err != nil {
		return nil, 0, err
	}
	if !s.Bonus || choice < 0 || choice > 2 {
		return nil, 0, errors.New("choose one of the three sealed bonus rewards")
	}
	reward := s.BonusOffers[choice]
	last := *s.Last
	last.BonusPicked, last.BonusPayout = choice, reward
	s.Last = &last
	s.Revision++
	s.Bonus = false
	s.BonusOffers = [3]int{}
	return &s, reward, s.Validate()
}
