package game

type clericBranchPlan struct{ damage, healing, health, radius, reach, cooldown, duration, slow, slowDuration, stun float64 }

func planClericBranch(skill, rune string) clericBranchPlan {
	p := clericBranchPlan{damage: 1, healing: 1, health: 1, radius: 1, reach: 1, cooldown: 1, duration: 1, slow: .3, slowDuration: 2, stun: 3}
	switch skill {
	case "Guardian Embrace":
		switch rune {
		case "embrace_wide":
			p.radius = 1.5
			p.healing = 0.75
		case "embrace_shelter":
			p.duration = 1.5
			p.radius = 0.7
		case "embrace_quick":
			p.cooldown = 0.6
			p.duration = 0.6
		}
	case "Purifying Wave":
		switch rune {
		case "purifyingwave_wide":
			p.radius = 1.5
			p.damage = 0.7
		case "purifyingwave_binding":
			p.slowDuration = 4
			p.damage = 0.7
		case "purifyingwave_quick":
			p.cooldown = 0.6
			p.radius = 0.7
		}
	case "Spirit Guardians Boost":
		switch rune {
		case "spiritboost_wide":
			p.radius = 1.5
			p.damage = 0.75
		case "spiritboost_wrath":
			p.damage = 1.3
			p.slow = 0
		case "spiritboost_lasting":
			p.duration = 1.5
			p.cooldown = 1.5
		}
	case "Avenging Seraph":
		switch rune {
		case "seraph_vigil":
			p.duration = 1.5
			p.damage = 0.75
		case "seraph_wrath":
			p.damage = 1.4
			p.duration = 0.6666666666666666
		case "seraph_guardian":
			p.health = 1.5
			p.damage = 0.8
		}
	case "Blessing of Resolve":
		switch rune {
		case "resolve_rally":
			p.radius = 1.5
			p.duration = 0.6
		case "resolve_lasting":
			p.duration = 1.5
			p.radius = 0.6
		case "resolve_quick":
			p.cooldown = 0.6
			p.duration = 0.6
		}
	case "Blessing of Zeal":
		switch rune {
		case "zeal_rally":
			p.radius = 1.5
			p.duration = 0.625
		case "zeal_lasting":
			p.duration = 1.5
			p.radius = 0.6
		case "zeal_quick":
			p.cooldown = 0.6
			p.duration = 0.625
		}
	case "Mark of Weakness":
		switch rune {
		case "weakness_distant":
			p.reach = 1.5
			p.duration = 0.6
		case "weakness_lasting":
			p.duration = 1.5
			p.cooldown = 1.3
		case "weakness_quick":
			p.cooldown = 0.6
			p.duration = 0.6
		}
	case "Heaven's Trumpet":
		switch rune {
		case "trumpet_wide":
			p.radius = 1.5
			p.damage = 0.7
		case "trumpet_binding":
			p.stun = 5
			p.damage = 0.7
		case "trumpet_quick":
			p.cooldown = 0.6
			p.stun = 1.5
			p.duration = 0.6
		}
	}
	return p
}
