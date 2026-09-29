package game

import "time"

// ComboDef describes a class-specific two-skill sequence and its bonus effect.
type ComboDef struct {
	ID          string
	Name        string
	Class       string
	FirstSkill  string
	SecondSkill string
	Effect      string
	Description string
}

// ComboWindow is the time window for combo detection.
const ComboWindow = 3 * time.Second

var fighterCombos = []ComboDef{
	{ID: "fortress_counter", Name: "Fortress Counter", Class: "Fighter", FirstSkill: "Iron Fortress", SecondSkill: "Shield Slam", Effect: "shield_slam_counter", Description: "Shield Slam deals 50% more damage. Normal mana and global cooldown apply."},
	{ID: "momentum_strike", Name: "Momentum Strike", Class: "Fighter", FirstSkill: "Charge", SecondSkill: "Whirlwind", Effect: "whirlwind_damage_boost", Description: "+50% Whirlwind damage"},
	{ID: "tremor_rush", Name: "Tremor Rush", Class: "Fighter", FirstSkill: "Earthshaker", SecondSkill: "Charge", Effect: "charge_extended_knockdown", Description: "+2s knockdown on Charge"},
	{ID: "guardian_combo", Name: "Guardian Combo", Class: "Fighter", FirstSkill: "Shield Slam", SecondSkill: "Guardian Roar", Effect: "guardian_roar_extended", Description: "Guardian Roar protection lasts 50% longer; taunt is still a one-time threat boost."},
	{ID: "iron_will", Name: "Iron Will", Class: "Fighter", FirstSkill: "Berserker Edge", SecondSkill: "Last Stand Rampage", Effect: "rampage_ward", Description: "Gain an absorb ward equal to 20% of maximum health for Rampage's duration. Does not replace or stack with an active ward."},
}

var rogueCombos = []ComboDef{
	{ID: "ambush", Name: "Ambush", Class: "Rogue", FirstSkill: "Weak Point Mark", SecondSkill: "Backstab", Effect: "backstab_guaranteed_crit", Description: "Guaranteed critical hit"},
	{ID: "venom_burst", Name: "Venom Burst", Class: "Rogue", FirstSkill: "Poison Coating", SecondSkill: "Tripwire", Effect: "tripwire_damage_boost", Description: "Tripwire deals 100% more impact damage."},
	{ID: "blade_tornado", Name: "Blade Tornado", Class: "Rogue", FirstSkill: "Fan of Knives", SecondSkill: "Phantom Volley", Effect: "volley_pierce", Description: "Volley pierces all targets"},
	{ID: "shadow_dance", Name: "Shadow Dance", Class: "Rogue", FirstSkill: "Cloak & Vanish", SecondSkill: "Smoke Bomb", Effect: "smoke_rearm_tripwire", Description: "Smoke Bomb refreshes Tripwire. Normal mana and cooldowns apply."},
}

var wizardCombos = []ComboDef{
	{ID: "implosion", Name: "Implosion", Class: "Wizard", FirstSkill: "Gravity Well", SecondSkill: "Fireball", Effect: "fireball_well_boost", Description: "This Fireball deals +100% damage to slowed or control-immune targets. Does not bypass control immunity."},
	{ID: "arcane_barrage", Name: "Arcane Barrage", Class: "Wizard", FirstSkill: "Scorch Beam", SecondSkill: "Arcane Missiles", Effect: "arcane_missile_barrage", Description: "Arcane Missiles launches five missiles instead of three. Normal mana and cooldown apply."},
	{ID: "time_burn", Name: "Time Burn", Class: "Wizard", FirstSkill: "Flame Tornado", SecondSkill: "Inferno Cataclysm", Effect: "cataclysm_double_tick", Description: "Cataclysm ticks twice as fast"},
	{ID: "nova_cascade", Name: "Nova Cascade", Class: "Wizard", FirstSkill: "Fireball", SecondSkill: "Flame Whip", Effect: "flame_whip_360", Description: "360° Flame Whip"},
}

var clericCombos = []ComboDef{
	{ID: "divine_storm", Name: "Divine Storm", Class: "Cleric", FirstSkill: "Blessing of Zeal", SecondSkill: "Spirit Guardians", Effect: "spirits_holy_damage", Description: "Activates boosted Spirit Guardians damage and radius."},
	{ID: "sanctuary_combo", Name: "Sanctuary", Class: "Cleric", FirstSkill: "Healing Light", SecondSkill: "Guardian Embrace", Effect: "ground_damage_immunity", Description: "Guardian Embrace also protects the caster from damage for 3s base. Does not make allies immune."},
	{ID: "holy_fury", Name: "Holy Fury", Class: "Cleric", FirstSkill: "Consecrated Ground", SecondSkill: "Radiant Strike", Effect: "radiant_strike_boost", Description: "Radiant Strike deals 100% more damage. No enemy mark required."},
	{ID: "mass_revival", Name: "Mass Revival", Class: "Cleric", FirstSkill: "Divine Intervention", SecondSkill: "Healing Light", Effect: "healing_light_party", Description: "Healing Light heals living nearby allies around you (base 20-unit radius). Does not resurrect."},
}

// GetComboForSkills returns the combo completed by the supplied ordered skill pair.
func GetComboForSkills(class, firstSkill, secondSkill string) *ComboDef {
	var combos []ComboDef
	switch class {
	case "Fighter":
		combos = fighterCombos
	case "Rogue":
		combos = rogueCombos
	case "Wizard":
		combos = wizardCombos
	case "Cleric":
		combos = clericCombos
	default:
		return nil
	}

	for i := range combos {
		if combos[i].FirstSkill == firstSkill && combos[i].SecondSkill == secondSkill {
			return &combos[i]
		}
	}
	return nil
}
