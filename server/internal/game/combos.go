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
	{ID: "momentum_strike", Name: "Momentum Strike", Class: "Fighter", FirstSkill: "Charge", SecondSkill: "Whirlwind", Effect: "whirlwind_damage_boost", Description: "+50% Whirlwind damage"},
	{ID: "tremor_rush", Name: "Tremor Rush", Class: "Fighter", FirstSkill: "Earthshaker", SecondSkill: "Charge", Effect: "charge_extended_knockdown", Description: "+2s knockdown on Charge"},
	{ID: "guardian_combo", Name: "Guardian Combo", Class: "Fighter", FirstSkill: "Shield Slam", SecondSkill: "Guardian Roar", Effect: "guardian_roar_extended", Description: "+50% taunt duration"},
	{ID: "iron_will", Name: "Iron Will", Class: "Fighter", FirstSkill: "Iron Fortress", SecondSkill: "Last Stand Rampage", Effect: "rampage_damage_reduction", Description: "Damage reduction persists during rampage"},
}

var rogueCombos = []ComboDef{
	{ID: "ambush", Name: "Ambush", Class: "Rogue", FirstSkill: "Cloak & Vanish", SecondSkill: "Backstab", Effect: "backstab_guaranteed_crit", Description: "Guaranteed critical hit"},
	{ID: "venom_burst", Name: "Venom Burst", Class: "Rogue", FirstSkill: "Poison Coating", SecondSkill: "Death Spiral", Effect: "death_spiral_poison_boost", Description: "+100% poison damage"},
	{ID: "blade_tornado", Name: "Blade Tornado", Class: "Rogue", FirstSkill: "Fan of Knives", SecondSkill: "Phantom Volley", Effect: "volley_pierce", Description: "Volley pierces all targets"},
	{ID: "shadow_dance", Name: "Shadow Dance", Class: "Rogue", FirstSkill: "Shadow Lunge", SecondSkill: "Smoke Bomb", Effect: "smoke_bomb_instant", Description: "Smoke bomb instant cast"},
}

var wizardCombos = []ComboDef{
	{ID: "implosion", Name: "Implosion", Class: "Wizard", FirstSkill: "Gravity Well", SecondSkill: "Fireball", Effect: "fireball_well_boost", Description: "+100% Fireball damage in well"},
	{ID: "arcane_barrage", Name: "Arcane Barrage", Class: "Wizard", FirstSkill: "Arcane Shield", SecondSkill: "Meteor Drop", Effect: "shield_meteor_explosion", Description: "Shield explodes on meteor impact"},
	{ID: "time_burn", Name: "Time Burn", Class: "Wizard", FirstSkill: "Time Warp", SecondSkill: "Inferno Cataclysm", Effect: "cataclysm_double_tick", Description: "Cataclysm ticks twice as fast"},
	{ID: "nova_cascade", Name: "Nova Cascade", Class: "Wizard", FirstSkill: "Teleport", SecondSkill: "Flame Whip", Effect: "flame_whip_360", Description: "360° Flame Whip"},
}

var clericCombos = []ComboDef{
	{ID: "divine_storm", Name: "Divine Storm", Class: "Cleric", FirstSkill: "Heaven's Trumpet", SecondSkill: "Spirit Guardians", Effect: "spirits_holy_damage", Description: "Guardians deal holy damage"},
	{ID: "sanctuary_combo", Name: "Sanctuary", Class: "Cleric", FirstSkill: "Consecrated Ground", SecondSkill: "Guardian Embrace", Effect: "ground_damage_immunity", Description: "Ground also provides damage immunity"},
	{ID: "holy_fury", Name: "Holy Fury", Class: "Cleric", FirstSkill: "Mark of Weakness", SecondSkill: "Radiant Strike", Effect: "radiant_strike_boost", Description: "+100% Radiant Strike damage"},
	{ID: "mass_revival", Name: "Mass Revival", Class: "Cleric", FirstSkill: "Divine Intervention", SecondSkill: "Healing Light", Effect: "healing_light_party", Description: "Healing Light heals entire party"},
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
