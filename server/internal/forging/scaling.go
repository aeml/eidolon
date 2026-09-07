// Package forging retains earned upgrade precision without reconstructing or
// replacing existing gear. The basis is immutable once the first upgrade lands.
package forging

import "math"

type Basis struct {
	Level   int            `json:"level" bson:"level"`
	Potency int            `json:"potency" bson:"potency"`
	Stats   map[string]int `json:"stats" bson:"stats"`
	Value   int            `json:"value" bson:"value"`
}

func (basis *Basis) Clone() *Basis {
	if basis == nil {
		return nil
	}
	copy := *basis
	copy.Stats = make(map[string]int, len(basis.Stats))
	for key, value := range basis.Stats {
		copy.Stats[key] = value
	}
	return &copy
}

func (basis *Basis) Valid() bool {
	return basis != nil && basis.Level >= 1 && basis.Level <= 100 && basis.Potency >= 0 && basis.Potency <= 20
}

func (basis *Basis) Scale(level, potency int) (map[string]int, int) {
	level = max(1, min(100, level))
	potency = max(0, min(20, potency))
	// Integer-form multipliers avoid chained rounding. Only displayed stats
	// are truncated; the original basis retains the fractional progress.
	ratio := float64((20+3*level)*(10+potency)) / float64((20+3*basis.Level)*(10+basis.Potency))
	scale := func(value int) int {
		scaled := float64(value) * ratio
		return int(math.Trunc(scaled + math.Copysign(1e-9, scaled)))
	}
	stats := make(map[string]int, len(basis.Stats))
	for key, value := range basis.Stats {
		stats[key] = scale(value)
	}
	return stats, scale(basis.Value)
}

func UpgradeCost(level, amount int) (target, cost int) {
	if level < 1 || level >= 100 {
		return level, 0
	}
	amount = max(1, min(100-level, amount))
	target = level + amount
	for current := level; current < target; current++ {
		if current >= 90 {
			cost += 2
		} else {
			cost += max(1, (1<<(current/10))/100)
		}
	}
	return target, cost
}
