package game

type fighterBranchPlan struct {
	damage, radius, reach, cooldown, duration, root, slow, marked float64
	pull, share, resetShattering                                  bool
}

func planFighterBranch(skill, rune string) fighterBranchPlan {
	p := fighterBranchPlan{damage: 1, radius: 1, reach: 1, cooldown: 1, duration: 1, root: 1, slow: .6, marked: 1.5, pull: true, share: true}
	switch skill {
	case "Guardian Roar":
		switch rune {
		case "guardianroar_rally":
			p.radius = 1.6
			p.duration = 0.6
		case "guardianroar_vigil":
			p.radius = 0.6
			p.duration = 1.5
		case "guardianroar_cadence":
			p.cooldown = 0.65
			p.duration = 0.6
		}
	case "Sweeping Strike":
		switch rune {
		case "sweepingstrike_wide":
			p.radius = 1.4
			p.damage = 0.8
		case "sweepingstrike_close":
			p.radius = 0.75
			p.damage = 1.3
		case "sweepingstrike_quick":
			p.cooldown = 0.65
			p.damage = 0.75
		}
	case "Unbreakable Grip":
		switch rune {
		case "grip_harpoon":
			p.reach = 1.5
			p.damage = 0.75
		case "grip_binding":
			p.root = 3
			p.damage = 0.7
		case "grip_impact":
			p.damage = 1.4
			p.root = 0
			p.pull = false
		}
	case "Juggernaut Charge":
		switch rune {
		case "juggernaut_avalanche":
			p.radius = 1.5
			p.damage = 0.75
		case "juggernaut_rush":
			p.reach = 1.5
			p.radius = 0.75
		case "juggernaut_breach":
			p.damage = 1.4
			p.slow = 0
		}
	case "Berserker Edge":
		switch rune {
		case "berserker_rally":
			p.radius = 1.5
			p.duration = 0.6666666666666666
		case "berserker_solitary":
			p.share = false
			p.duration = 1.3333333333333333
		case "berserker_cadence":
			p.cooldown = 0.5
			p.duration = 0.5333333333333333
		}
	case "Shattering Charge":
		switch rune {
		case "shattering_lasting":
			p.duration = 2
			p.damage = 0.7
		case "shattering_shock":
			p.radius = 1.4
			p.damage = 0.7
		case "shattering_quick":
			p.cooldown = 0.65
			p.radius = 0.7
		}
	case "Executioner Spin":
		switch rune {
		case "executionerspin_wide":
			p.radius = 1.5
			p.damage = 0.75
		case "executionerspin_marked":
			p.marked = 2
			p.damage = 0.8
		case "executionerspin_quick":
			p.cooldown = 0.65
			p.damage = 0.7
		}
	case "Last Stand Rampage":
		switch rune {
		case "rampage_endurance":
			p.duration = 1.5
			p.cooldown = 1.5
		case "rampage_burst":
			p.duration = 0.6
			p.cooldown = 0.6
		case "rampage_reprise":
			p.duration = 0.5
			p.resetShattering = true
		}
	}
	return p
}
