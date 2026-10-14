package game

// SkillRuneDef defines one rune option for a skill.
type SkillRuneDef struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Skill       string `json:"skill"`
	UnlockLevel int    `json:"unlockLevel"`
	Description string `json:"description"`
}

// GetAllRunesForClass returns the canonical rune catalog for a class.
func GetAllRunesForClass(classType string) []SkillRuneDef {
	switch classType {
	case "Fighter":
		return fighterRunes
	case "Rogue":
		return rogueRunes
	case "Wizard":
		return wizardRunes
	case "Cleric":
		return clericRunes
	default:
		return nil
	}
}

// GetRunesForSkill returns the class runes belonging to a specific skill.
func GetRunesForSkill(classType, skillName string) []SkillRuneDef {
	allRunes := GetAllRunesForClass(classType)
	result := make([]SkillRuneDef, 0, 3)
	for _, runeDef := range allRunes {
		if runeDef.Skill == skillName {
			result = append(result, runeDef)
		}
	}
	return result
}

// GetRuneDef returns the rune definition for a canonical rune ID.
func GetRuneDef(runeID string) (SkillRuneDef, bool) {
	for _, catalog := range [][]SkillRuneDef{fighterRunes, rogueRunes, wizardRunes, clericRunes} {
		for _, runeDef := range catalog {
			if runeDef.ID == runeID {
				return runeDef, true
			}
		}
	}
	return SkillRuneDef{}, false
}

// GetUnlockedRunes returns all class runes available at the supplied level.
func GetUnlockedRunes(classType string, level int) []SkillRuneDef {
	allRunes := GetAllRunesForClass(classType)
	result := make([]SkillRuneDef, 0, len(allRunes))
	for _, runeDef := range allRunes {
		if level >= runeDef.UnlockLevel {
			result = append(result, runeDef)
		}
	}
	return result
}

var fighterRunes = []SkillRuneDef{
	{ID: "charge_momentum", Name: "Momentum", Skill: "Charge", UnlockLevel: 50, Description: "+50% range, damage scales with distance traveled"},
	{ID: "charge_shockwave", Name: "Shockwave", Skill: "Charge", UnlockLevel: 70, Description: "Ends with knockback AoE (5 unit radius)"},
	{ID: "charge_unstoppable", Name: "Unstoppable", Skill: "Charge", UnlockLevel: 90, Description: "CC immune during charge, +20% armor for 5s after"},
	{ID: "whirlwind_extended", Name: "Extended", Skill: "Whirlwind", UnlockLevel: 50, Description: "+100% duration, -50% damage per pulse"},
	{ID: "whirlwind_bladestorm", Name: "Bladestorm", Skill: "Whirlwind", UnlockLevel: 70, Description: "Pulls enemies toward you"},
	{ID: "whirlwind_bloodwhirl", Name: "Bloodwhirl", Skill: "Whirlwind", UnlockLevel: 90, Description: "Heals 2% HP per enemy hit"},
	{ID: "shieldslam_concussion", Name: "Concussion", Skill: "Shield Slam", UnlockLevel: 50, Description: "Stun duration +1s"},
	{ID: "shieldslam_reverberation", Name: "Reverberation", Skill: "Shield Slam", UnlockLevel: 70, Description: "Hits twice"},
	{ID: "shieldslam_fortify", Name: "Fortify", Skill: "Shield Slam", UnlockLevel: 90, Description: "Grants shield equal to damage dealt"},
	{ID: "ironfortress_extended", Name: "Extended", Skill: "Iron Fortress", UnlockLevel: 50, Description: "+50% duration"},
	{ID: "ironfortress_thorns", Name: "Thorns", Skill: "Iron Fortress", UnlockLevel: 70, Description: "Reflect 20% damage while active"},
	{ID: "ironfortress_immovable", Name: "Immovable", Skill: "Iron Fortress", UnlockLevel: 90, Description: "Cannot be knocked back or pulled"},
	{ID: "earthshaker_fissure", Name: "Fissure", Skill: "Earthshaker", UnlockLevel: 50, Description: "Creates line AoE instead of circle"},
	{ID: "earthshaker_aftershock", Name: "Aftershock", Skill: "Earthshaker", UnlockLevel: 70, Description: "Second smaller quake after 1s"},
	{ID: "earthshaker_seismic", Name: "Seismic", Skill: "Earthshaker", UnlockLevel: 90, Description: "+100% knockdown duration"},
	{ID: "guardianroar_rally", Name: "Rally", Skill: "Guardian Roar", UnlockLevel: 50, Description: "Reach 60% farther, but protection lasts 6s instead of 10s."},
	{ID: "guardianroar_vigil", Name: "Vigil", Skill: "Guardian Roar", UnlockLevel: 70, Description: "Protection lasts 15s, but the radius is 40% smaller."},
	{ID: "guardianroar_cadence", Name: "Cadence", Skill: "Guardian Roar", UnlockLevel: 90, Description: "Recast 35% sooner, but protection lasts 6s."},
	{ID: "sweepingstrike_wide", Name: "Wide Sweep", Skill: "Sweeping Strike", UnlockLevel: 50, Description: "40% wider reach, with 20% less damage."},
	{ID: "sweepingstrike_close", Name: "Close Cut", Skill: "Sweeping Strike", UnlockLevel: 70, Description: "30% more damage, with 25% less reach."},
	{ID: "sweepingstrike_quick", Name: "Quick Cut", Skill: "Sweeping Strike", UnlockLevel: 90, Description: "Recast 35% sooner, with 25% less damage."},
	{ID: "grip_harpoon", Name: "Harpoon", Skill: "Unbreakable Grip", UnlockLevel: 50, Description: "50% more targeting range, with 25% less damage."},
	{ID: "grip_binding", Name: "Binding Grip", Skill: "Unbreakable Grip", UnlockLevel: 70, Description: "Root lasts 3s instead of 1s, with 30% less damage."},
	{ID: "grip_impact", Name: "Crushing Grip", Skill: "Unbreakable Grip", UnlockLevel: 90, Description: "40% more damage; no pull or root. Useful against control-immune foes."},
	{ID: "juggernaut_avalanche", Name: "Avalanche", Skill: "Juggernaut Charge", UnlockLevel: 50, Description: "50% wider shockwave, with 25% less damage."},
	{ID: "juggernaut_rush", Name: "Long Rush", Skill: "Juggernaut Charge", UnlockLevel: 70, Description: "Charge 50% farther, with a 25% smaller shockwave."},
	{ID: "juggernaut_breach", Name: "Breach", Skill: "Juggernaut Charge", UnlockLevel: 90, Description: "40% more shockwave damage, but it no longer slows."},
	{ID: "berserker_rally", Name: "War Rally", Skill: "Berserker Edge", UnlockLevel: 50, Description: "Reach party members 50% farther away, but the buff lasts 10s."},
	{ID: "berserker_solitary", Name: "Solitary Fury", Skill: "Berserker Edge", UnlockLevel: 70, Description: "Buff lasts 20s and affects only you. The defense cost remains."},
	{ID: "berserker_cadence", Name: "Battle Cadence", Skill: "Berserker Edge", UnlockLevel: 90, Description: "Recast twice as often, but the buff lasts 8s."},
	{ID: "shattering_lasting", Name: "Lasting Fracture", Skill: "Shattering Charge", UnlockLevel: 50, Description: "Armor break lasts 10s instead of 5s, with 30% less impact damage."},
	{ID: "shattering_shock", Name: "Shattering Wave", Skill: "Shattering Charge", UnlockLevel: 70, Description: "40% wider impact, with 30% less damage."},
	{ID: "shattering_quick", Name: "Quick Breach", Skill: "Shattering Charge", UnlockLevel: 90, Description: "Recast 35% sooner, with a 30% smaller impact."},
	{ID: "executionerspin_wide", Name: "Wide Reaping", Skill: "Executioner Spin", UnlockLevel: 50, Description: "50% wider spin, with 25% less damage."},
	{ID: "executionerspin_marked", Name: "Marked for Death", Skill: "Executioner Spin", UnlockLevel: 70, Description: "Marked or threatened targets take double base damage instead of 1.5x; base damage is 20% lower."},
	{ID: "executionerspin_quick", Name: "Quick Reaping", Skill: "Executioner Spin", UnlockLevel: 90, Description: "Recast 35% sooner, with 30% less damage."},
	{ID: "rampage_endurance", Name: "Enduring Rampage", Skill: "Last Stand Rampage", UnlockLevel: 50, Description: "Lasts 15s instead of 10s, with a 180s base cooldown."},
	{ID: "rampage_burst", Name: "Measured Rampage", Skill: "Last Stand Rampage", UnlockLevel: 70, Description: "Lasts 6s, with a 72s base cooldown. Keeps the low-health damage bonus."},
	{ID: "rampage_reprise", Name: "Breach Reprise", Skill: "Last Stand Rampage", UnlockLevel: 90, Description: "Refresh Shattering Charge on cast, but Rampage lasts only 5s. Mana and the global cooldown still apply."},
}

var rogueRunes = []SkillRuneDef{
	{ID: "piercingthrow_ricochet", Name: "Ricochet", Skill: "Piercing Throw", UnlockLevel: 50, Description: "Bounces to 2 additional targets"},
	{ID: "piercingthrow_serrated", Name: "Serrated", Skill: "Piercing Throw", UnlockLevel: 70, Description: "Applies bleed (5s DoT)"},
	{ID: "piercingthrow_executioner", Name: "Executioner", Skill: "Piercing Throw", UnlockLevel: 90, Description: "+100% damage to targets below 30% HP"},
	{ID: "backstab_ambush", Name: "Ambush", Skill: "Backstab", UnlockLevel: 50, Description: "+50% crit chance"},
	{ID: "backstab_eviscerate", Name: "Eviscerate", Skill: "Backstab", UnlockLevel: 70, Description: "Ignores 50% armor"},
	{ID: "backstab_shadowstep", Name: "Shadowstep", Skill: "Backstab", UnlockLevel: 90, Description: "Teleport behind target before striking"},
	{ID: "fanofknives_weighted", Name: "Weighted", Skill: "Fan of Knives", UnlockLevel: 50, Description: "Slows enemies hit by 30% for 3s"},
	{ID: "fanofknives_poisoned", Name: "Poisoned", Skill: "Fan of Knives", UnlockLevel: 70, Description: "Applies poison DoT"},
	{ID: "fanofknives_fury", Name: "Bladed Fury", Skill: "Fan of Knives", UnlockLevel: 90, Description: "Double the number of knives"},
	{ID: "shadowlunge_extended", Name: "Extended", Skill: "Shadow Lunge", UnlockLevel: 50, Description: "+50% range"},
	{ID: "shadowlunge_cripple", Name: "Cripple", Skill: "Shadow Lunge", UnlockLevel: 70, Description: "Slows target by 50% for 3s"},
	{ID: "shadowlunge_shadow", Name: "Shadow Clone", Skill: "Shadow Lunge", UnlockLevel: 90, Description: "Creates illusion that attacks once"},
	{ID: "cloak_swift", Name: "Swift", Skill: "Cloak & Vanish", UnlockLevel: 50, Description: "+30% movement speed while invisible"},
	{ID: "cloak_longer", Name: "Lasting Shadow", Skill: "Cloak & Vanish", UnlockLevel: 70, Description: "+100% invisibility duration"},
	{ID: "cloak_ambush", Name: "Prepared Ambush", Skill: "Cloak & Vanish", UnlockLevel: 90, Description: "Next attack deals +100% damage"},
}

var wizardRunes = []SkillRuneDef{
	{ID: "fireball_magma", Name: "Magma Orb", Skill: "Fireball", UnlockLevel: 50, Description: "Slower projectile; damaging hits leave a 5-unit fire field for 3s. Pulses inherit one-sixth of the first hit; leaving stops the burn."},
	{ID: "fireball_chain", Name: "Chain Reaction", Skill: "Fireball", UnlockLevel: 70, Description: "Bounces to 3 additional targets at 50% damage"},
	{ID: "fireball_empowered", Name: "Empowered", Skill: "Fireball", UnlockLevel: 90, Description: "+100% damage, +3s cooldown"},
	{ID: "meteor_cluster", Name: "Cluster", Skill: "Meteor Drop", UnlockLevel: 50, Description: "Three smaller meteors, each with two-thirds damage and 40% less radius."},
	{ID: "meteor_extinction", Name: "Extinction", Skill: "Meteor Drop", UnlockLevel: 70, Description: "+50% explosion radius"},
	{ID: "meteor_apocalypse", Name: "Apocalypse", Skill: "Meteor Drop", UnlockLevel: 90, Description: "Five extra meteors over 5s, each with half damage and 30% less radius."},
	{ID: "teleport_blink", Name: "Blink", Skill: "Teleport", UnlockLevel: 50, Description: "+50% range"},
	{ID: "teleport_phase", Name: "Phase", Skill: "Teleport", UnlockLevel: 70, Description: "Invulnerable for 1s after teleport"},
	{ID: "teleport_warp", Name: "Warp", Skill: "Teleport", UnlockLevel: 90, Description: "Damages enemies at start and end location"},
	{ID: "arcaneshield_extended", Name: "Extended", Skill: "Arcane Shield", UnlockLevel: 50, Description: "+50% duration"},
	{ID: "arcaneshield_reflective", Name: "Reflective", Skill: "Arcane Shield", UnlockLevel: 70, Description: "Reflects 30% of absorbed damage"},
	{ID: "arcaneshield_explosive", Name: "Explosive", Skill: "Arcane Shield", UnlockLevel: 90, Description: "Explodes when broken dealing absorbed amount"},
	{ID: "gravitywell_expanded", Name: "Expanded", Skill: "Gravity Well", UnlockLevel: 50, Description: "+50% radius"},
	{ID: "gravitywell_crushing", Name: "Crushing", Skill: "Gravity Well", UnlockLevel: 70, Description: "+100% damage"},
	{ID: "gravitywell_blackhole", Name: "Black Hole", Skill: "Gravity Well", UnlockLevel: 90, Description: "Enemies cannot escape while active"},
	{ID: "flamewhip_reach", Name: "Reach", Skill: "Flame Whip", UnlockLevel: 50, Description: "50% greater reach, but 25% less damage. Retains the trained stun."},
	{ID: "flamewhip_binding", Name: "Binding Flame", Skill: "Flame Whip", UnlockLevel: 70, Description: "5s base stun, but 35% less damage. Control-immune enemies still take damage."},
	{ID: "flamewhip_flash", Name: "Flash Lash", Skill: "Flame Whip", UnlockLevel: 90, Description: "6s base cooldown and 1s base stun, but 20% less damage. Mana cost is unchanged."},
	{ID: "flametornado_broad", Name: "Firefront", Skill: "Flame Tornado", UnlockLevel: 50, Description: "50% wider and travels at 6 instead of 10 speed, but deals 25% less damage. Each enemy is hit once."},
	{ID: "flametornado_swift", Name: "Firestorm", Skill: "Flame Tornado", UnlockLevel: 70, Description: "Travels at 18 instead of 10 speed, but is one-third narrower. Damage is unchanged."},
	{ID: "flametornado_focused", Name: "Fire Needle", Skill: "Flame Tornado", UnlockLevel: 90, Description: "40% more damage, but half the width. Each enemy is hit once."},
	{ID: "inferno_lingering", Name: "Lingering Embers", Skill: "Inferno Cataclysm", UnlockLevel: 50, Description: "Burns for 12s instead of 8s, but each pulse deals 35% less damage."},
	{ID: "inferno_concentrated", Name: "Crucible", Skill: "Inferno Cataclysm", UnlockLevel: 70, Description: "40% more damage per pulse, but 35% less radius. Duration is unchanged."},
	{ID: "inferno_flashburn", Name: "Flashburn", Skill: "Inferno Cataclysm", UnlockLevel: 90, Description: "Burns for 4s with 50% more damage per pulse and 40s base cooldown. Mana cost is unchanged."},
	{ID: "timewarp_communion", Name: "Communion", Skill: "Time Warp", UnlockLevel: 50, Description: "60% greater radius, but 6s base haste duration. Retains both personal cooldown resets."},
	{ID: "timewarp_lingering", Name: "Enduring Time", Skill: "Time Warp", UnlockLevel: 70, Description: "12s base haste duration, but does not reset Teleport or Gravity Well."},
	{ID: "timewarp_quickening", Name: "Quickening", Skill: "Time Warp", UnlockLevel: 90, Description: "40s base cooldown and 5s base haste. Resets Teleport only; Gravity Well keeps its cooldown."},
	{ID: "spellfocus_reservoir", Name: "Reservoir", Skill: "Spell Focus", UnlockLevel: 50, Description: "Split Focus's trained bonus damage between your next two paid damaging spells. Utility and rejected casts keep both charges."},
	{ID: "spellfocus_aegis", Name: "Aegis", Skill: "Spell Focus", UnlockLevel: 70, Description: "Double Focus's ward capacity, but retain only 60% of its bonus damage. Does not replace an active ward."},
	{ID: "spellfocus_overchannel", Name: "Overchannel", Skill: "Spell Focus", UnlockLevel: 90, Description: "Increase Focus's bonus damage by 25%, but gain no Focus ward. Existing shields remain."},
	{ID: "scorchbeam_longshot", Name: "Longshot", Skill: "Scorch Beam", UnlockLevel: 50, Description: "Reach 50% farther, but deal 20% less damage. Retains armor melt and the brief slow."},
	{ID: "scorchbeam_incision", Name: "Incision", Skill: "Scorch Beam", UnlockLevel: 70, Description: "Deal 25% more damage, but lose the beam slow. Armor melt remains."},
	{ID: "scorchbeam_snare", Name: "Snare", Skill: "Scorch Beam", UnlockLevel: 90, Description: "Slow susceptible enemies by 50% for 5s base, but deal 25% less damage. Preserves existing slows; immune enemies still take damage."},
	{ID: "arcanemissiles_salvo", Name: "Salvo", Skill: "Arcane Missiles", UnlockLevel: 50, Description: "Fire two extra missiles at 60% damage each: five normally, seven after Scorch Beam. Spends one Focus charge for the entire volley."},
	{ID: "arcanemissiles_compression", Name: "Compression", Skill: "Arcane Missiles", UnlockLevel: 70, Description: "Fire one fewer missile at 140% damage each: two normally, four after Scorch Beam. Trades ordinary volley damage for stronger prepared volleys."},
	{ID: "arcanemissiles_convergence", Name: "Convergence", Skill: "Arcane Missiles", UnlockLevel: 90, Description: "Missiles fly straight toward your aim at 40 speed and deal 20% more damage, but no longer home onto moving targets."},
	{ID: "dragonfire_needle", Name: "Needle", Skill: "Dragonfire Lance", UnlockLevel: 50, Description: "Deal 25% more damage with half the projectile width. Stops at the first enemy hit."},
	{ID: "dragonfire_broadside", Name: "Broadside", Skill: "Dragonfire Lance", UnlockLevel: 70, Description: "Pierce enemies with 2.5 times the projectile width, but deal 25% less damage to each. Each enemy can be hit once."},
	{ID: "dragonfire_quickfire", Name: "Quickfire", Skill: "Dragonfire Lance", UnlockLevel: 90, Description: "Reduce base cooldown from 20s to 12s and projectile speed rises from 40 to 60, but deal 35% less damage. Mana cost remains 50 before discounts."},
}

var clericRunes = []SkillRuneDef{
	{ID: "spirits_expanded", Name: "Expanded", Skill: "Spirit Guardians", UnlockLevel: 50, Description: "+50% radius"},
	{ID: "spirits_vengeful", Name: "Vengeful", Skill: "Spirit Guardians", UnlockLevel: 70, Description: "+50% damage, -25% healing"},
	{ID: "spirits_sanctuary", Name: "Sanctuary", Skill: "Spirit Guardians", UnlockLevel: 90, Description: "Also reduces damage taken by 20%"},
	{ID: "healinglight_beacon", Name: "Beacon", Skill: "Healing Light", UnlockLevel: 50, Description: "Heals in AoE around target (5 unit radius)"},
	{ID: "healinglight_renewal", Name: "Renewal", Skill: "Healing Light", UnlockLevel: 70, Description: "Adds HoT for 5s (20% of initial heal)"},
	{ID: "healinglight_divine", Name: "Divine", Skill: "Healing Light", UnlockLevel: 90, Description: "Also cleanses 1 debuff"},
	{ID: "divineintervention_quick", Name: "Quick Save", Skill: "Divine Intervention", UnlockLevel: 50, Description: "Cooldown reduced by 50%"},
	{ID: "divineintervention_guardian", Name: "Guardian Angel", Skill: "Divine Intervention", UnlockLevel: 70, Description: "Target gains 50% damage reduction for 5s"},
	{ID: "divineintervention_miracle", Name: "Miracle", Skill: "Divine Intervention", UnlockLevel: 90, Description: "Can affect 2 targets"},
	{ID: "radiantstrike_smite", Name: "Smite", Skill: "Radiant Strike", UnlockLevel: 50, Description: "+50% damage"},
	{ID: "radiantstrike_chains", Name: "Chains of Light", Skill: "Radiant Strike", UnlockLevel: 70, Description: "Roots target for 2s"},
	{ID: "radiantstrike_purge", Name: "Purge", Skill: "Radiant Strike", UnlockLevel: 90, Description: "Removes 1 buff from target"},
	{ID: "consecratedground_expanded", Name: "Expanded", Skill: "Consecrated Ground", UnlockLevel: 50, Description: "+50% radius"},
	{ID: "consecratedground_lingering", Name: "Lingering", Skill: "Consecrated Ground", UnlockLevel: 70, Description: "+100% duration"},
	{ID: "consecratedground_sanctuary", Name: "Holy Ground", Skill: "Consecrated Ground", UnlockLevel: 90, Description: "Allies in area take 30% less damage"},
}
