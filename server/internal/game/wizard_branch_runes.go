package game

// Rune effects are captured when the server admits and pays for the cast.
type wizardBranchPlan struct {
	damage, radius, cooldown, stun, speed, duration float64
	resetTeleport, resetGravity                     bool
}

func planWizardBranch(skill, rune string) wizardBranchPlan {
	p := wizardBranchPlan{damage: 1, radius: 1, cooldown: 1, stun: 3, speed: 10,
		duration: 8, resetTeleport: true, resetGravity: true}
	switch skill {
	case "Flame Whip":
		switch rune {
		case "flamewhip_reach":
			p.radius, p.damage = 1.5, .75
		case "flamewhip_binding":
			p.stun, p.damage = 5, .65
		case "flamewhip_flash":
			p.cooldown, p.stun, p.damage = .6, 1, .8
		}
	case "Flame Tornado":
		switch rune {
		case "flametornado_broad":
			p.radius, p.speed, p.damage = 1.5, 6, .75
		case "flametornado_swift":
			p.radius, p.speed = 2.0/3, 18
		case "flametornado_focused":
			p.radius, p.damage = .5, 1.4
		}
	case "Inferno Cataclysm":
		switch rune {
		case "inferno_lingering":
			p.duration, p.damage = 12, .65
		case "inferno_concentrated":
			p.radius, p.damage = .65, 1.4
		case "inferno_flashburn":
			p.duration, p.damage, p.cooldown = 4, 1.5, 2.0/3
		}
	case "Time Warp":
		switch rune {
		case "timewarp_communion":
			p.radius, p.duration = 1.6, 6
		case "timewarp_lingering":
			p.duration, p.resetTeleport, p.resetGravity = 12, false, false
		case "timewarp_quickening":
			p.duration, p.cooldown, p.resetGravity = 5, 2.0/3, false
		}
	}
	return p
}
