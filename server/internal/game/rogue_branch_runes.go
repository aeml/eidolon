package game

type rogueBranchPlan struct {
	damage, radius, reach, cooldown, duration, spread, root, slow, accuracy, spacing float64
	count                                                                            int
	pierce, resetFan, resetTripwire                                                  bool
}

func planRogueBranch(skill, rune string) rogueBranchPlan {
	p := rogueBranchPlan{damage: 1, radius: 1, reach: 1, cooldown: 1, duration: 1, spread: 1, root: 3, slow: .5, accuracy: .3, spacing: .15, count: 3}
	switch skill {
	case "Weak Point Mark":
		switch rune {
		case "weakpoint_lasting":
			p.duration = 1.5
			p.cooldown = 1.25
		case "weakpoint_distant":
			p.reach = 1.5
			p.duration = 0.6
		case "weakpoint_fleeting":
			p.cooldown = 0.6
			p.duration = 0.6
		}
	case "Death Spiral":
		switch rune {
		case "deathspiral_wide":
			p.radius = 1.5
			p.damage = 0.75
		case "deathspiral_ruthless":
			p.damage = 1.3
			p.radius = 0.7
		case "deathspiral_quick":
			p.cooldown = 0.6
			p.damage = 0.7
		}
	case "Serrated Edges":
		switch rune {
		case "serratededges_lasting":
			p.duration = 1.5
			p.cooldown = 1.5
		case "serratededges_rapid":
			p.cooldown = 0.6
			p.duration = 0.6
		case "serratededges_reprise":
			p.duration = 0.5
			p.resetFan = true
		}
	case "Blade Storm":
		switch rune {
		case "bladestorm_focused":
			p.spread = 0.5
			p.damage = 1.25
		case "bladestorm_broad":
			p.spread = 1.5
			p.damage = 0.8
		case "bladestorm_long":
			p.radius = 1.5
			p.damage = 0.75
		}
	case "Phantom Volley":
		switch rune {
		case "phantomvolley_barrage":
			p.count = 5
			p.damage = 0.65
		case "phantomvolley_burst":
			p.spacing = 0.075
			p.cooldown = 1.2
		case "phantomvolley_piercing":
			p.pierce = true
			p.damage = 0.6
		}
	case "Poison Coating":
		switch rune {
		case "poisoncoating_lasting":
			p.duration = 1.6
			p.cooldown = 1.3
		case "poisoncoating_rapid":
			p.cooldown = 0.6
			p.duration = 0.6
		case "poisoncoating_rearm":
			p.duration = 0.5
			p.resetTripwire = true
		}
	case "Smoke Bomb":
		switch rune {
		case "smokebomb_wide":
			p.radius = 1.5
			p.duration = 0.6
		case "smokebomb_choking":
			p.accuracy = 0.5
			p.slow = 0.25
		case "smokebomb_dense":
			p.slow = 0.7
			p.radius = 0.65
		}
	case "Tripwire":
		switch rune {
		case "tripwire_distant":
			p.reach = 1.5
			p.damage = 0.7
		case "tripwire_grasp":
			p.root = 5
			p.damage = 0.65
		case "tripwire_quick":
			p.cooldown = 0.6
			p.root = 1.5
			p.damage = 0.8
		}
	}
	return p
}
