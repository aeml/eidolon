package game

import (
	"math"
	"sort"
)

func lanceContactFraction(startX, startZ, endX, endZ, targetX, targetZ, radius float64) float64 {
	dx, dz := endX-startX, endZ-startZ
	length := math.Hypot(dx, dz)
	if length == 0 {
		if math.Hypot(targetX-startX, targetZ-startZ) < radius {
			return 0
		}
		return math.Inf(1)
	}
	projection := ((targetX-startX)*dx + (targetZ-startZ)*dz) / length
	perpendicularSquared := math.Max(0, (targetX-startX)*(targetX-startX)+(targetZ-startZ)*(targetZ-startZ)-projection*projection)
	if perpendicularSquared >= radius*radius {
		return math.Inf(1)
	}
	offset := math.Sqrt(radius*radius - perpendicularSquared)
	if projection+offset <= 0 || projection-offset >= length {
		return math.Inf(1)
	}
	return math.Max(0, (projection-offset)/length)
}

func orderLanceTargets(entities []*Entity, startX, startZ, endX, endZ, radius float64) []*Entity {
	type contact struct {
		target   *Entity
		fraction float64
	}
	contacts := make([]contact, len(entities))
	for i, target := range entities {
		target.Mu.RLock()
		fraction := lanceContactFraction(startX, startZ, endX, endZ, target.X, target.Z, radius)
		target.Mu.RUnlock()
		contacts[i] = contact{target, fraction}
	}
	sort.SliceStable(contacts, func(i, j int) bool {
		if contacts[i].fraction == contacts[j].fraction {
			return contacts[i].target.ID < contacts[j].target.ID
		}
		return contacts[i].fraction < contacts[j].fraction
	})
	ordered := make([]*Entity, len(entities))
	for i, c := range contacts {
		ordered[i] = c.target
	}
	return ordered
}

// Captured at payment, before asynchronous projectile flight or rune changes.
type wizardPrecisionPlan struct {
	damage, reach, radius, speed, cooldown, slow, slowSeconds float64
	missiles                                                  int
	homing, pierce                                            bool
}

func planWizardPrecision(skill, rune string, barrage bool) wizardPrecisionPlan {
	p := wizardPrecisionPlan{damage: 1, reach: 1, radius: 1, speed: 40, cooldown: 1,
		slow: .3, slowSeconds: 3, missiles: 3, homing: true}
	if barrage {
		p.missiles = 5
	}
	switch skill {
	case "Scorch Beam":
		switch rune {
		case "scorchbeam_longshot":
			p.reach, p.damage = 1.5, .8
		case "scorchbeam_incision":
			p.damage, p.slow = 1.25, 0
		case "scorchbeam_snare":
			p.damage, p.slow, p.slowSeconds = .75, .5, 5
		}
	case "Arcane Missiles":
		p.speed = 25
		switch rune {
		case "arcanemissiles_salvo":
			p.missiles += 2
			p.damage = .6
		case "arcanemissiles_compression":
			p.missiles--
			p.damage = 1.4
		case "arcanemissiles_convergence":
			p.homing, p.speed, p.damage = false, 40, 1.2
		}
	case "Dragonfire Lance":
		switch rune {
		case "dragonfire_needle":
			p.radius, p.damage = .5, 1.25
		case "dragonfire_broadside":
			p.radius, p.damage, p.pierce = 2.5, .75, true
		case "dragonfire_quickfire":
			p.damage, p.cooldown, p.speed = .65, .6, 60
		}
	}
	return p
}
