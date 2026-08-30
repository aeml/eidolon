package game

import "time"

type AbilitySpec struct {
	ManaCost int
	Cooldown time.Duration
	Range    float64
}

var abilitySpecs = map[string]map[string]AbilitySpec{
	"Fighter": {
		"Charge":             {ManaCost: 20, Cooldown: 5 * time.Second, Range: 14.0},
		"Whirlwind":          {ManaCost: 30, Cooldown: 8 * time.Second, Range: 5.0},
		"Shield Slam":        {ManaCost: 25, Cooldown: 6 * time.Second, Range: 4.0},
		"Iron Fortress":      {ManaCost: 40, Cooldown: 60 * time.Second, Range: 0.0},
		"Guardian Roar":      {ManaCost: 35, Cooldown: 30 * time.Second, Range: 15.0},
		"Sweeping Strike":    {ManaCost: 30, Cooldown: 4 * time.Second, Range: 5.0},
		"Earthshaker":        {ManaCost: 40, Cooldown: 12 * time.Second, Range: 6.0},
		"Unbreakable Grip":   {ManaCost: 35, Cooldown: 15 * time.Second, Range: 10.0},
		"Juggernaut Charge":  {ManaCost: 30, Cooldown: 20 * time.Second, Range: 10.0},
		"Berserker Edge":     {ManaCost: 0, Cooldown: 45 * time.Second, Range: 0.0},
		"Shattering Charge":  {ManaCost: 30, Cooldown: 12 * time.Second, Range: 14.0},
		"Executioner Spin":   {ManaCost: 40, Cooldown: 15 * time.Second, Range: 6.0},
		"Last Stand Rampage": {ManaCost: 0, Cooldown: 120 * time.Second, Range: 0.0},
	},
	"Rogue": {
		"Piercing Throw":  {ManaCost: 15, Cooldown: 1 * time.Second, Range: 12.0},
		"Backstab":        {ManaCost: 20, Cooldown: 6 * time.Second, Range: 2.5},
		"Weak Point Mark": {ManaCost: 25, Cooldown: 12 * time.Second, Range: 10.0},
		"Shadow Lunge":    {ManaCost: 25, Cooldown: 10 * time.Second, Range: 10.0},
		"Death Spiral":    {ManaCost: 35, Cooldown: 20 * time.Second, Range: 4.0},
		"Fan of Knives":   {ManaCost: 25, Cooldown: 6 * time.Second, Range: 5.0},
		"Serrated Edges":  {ManaCost: 30, Cooldown: 20 * time.Second, Range: 0.0},
		"Blade Storm":     {ManaCost: 30, Cooldown: 15 * time.Second, Range: 10.0},
		"Phantom Volley":  {ManaCost: 40, Cooldown: 18 * time.Second, Range: 12.0},
		"Smoke Bomb":      {ManaCost: 35, Cooldown: 20 * time.Second, Range: 5.0},
		"Poison Coating":  {ManaCost: 30, Cooldown: 30 * time.Second, Range: 0.0},
		"Tripwire":        {ManaCost: 25, Cooldown: 15 * time.Second, Range: 6.0},
		"Cloak & Vanish":  {ManaCost: 30, Cooldown: 30 * time.Second, Range: 0.0},
		"Stealth":         {ManaCost: 25, Cooldown: 20 * time.Second, Range: 0.0},
		"Shadow Strike":   {ManaCost: 35, Cooldown: 10 * time.Second, Range: 10.0},
		"Ricochet Blades": {ManaCost: 20, Cooldown: 8 * time.Second, Range: 12.0},
		"Explosive Trap":  {ManaCost: 30, Cooldown: 15 * time.Second, Range: 6.0},
		"Snare Trap":      {ManaCost: 25, Cooldown: 18 * time.Second, Range: 6.0},
		"Rain of Arrows":  {ManaCost: 45, Cooldown: 12 * time.Second, Range: 12.0},
	},
	"Wizard": {
		"Fireball":          {ManaCost: 30, Cooldown: 2 * time.Second, Range: 18.0},
		"Flame Whip":        {ManaCost: 35, Cooldown: 10 * time.Second, Range: 12.0},
		"Flame Tornado":     {ManaCost: 50, Cooldown: 8 * time.Second, Range: 15.0},
		"Meteor Drop":       {ManaCost: 60, Cooldown: 15 * time.Second, Range: 20.0},
		"Inferno Cataclysm": {ManaCost: 60, Cooldown: 60 * time.Second, Range: 20.0},
		"Scorch Beam":       {ManaCost: 40, Cooldown: 8 * time.Second, Range: 18.0},
		"Arcane Missiles":   {ManaCost: 30, Cooldown: 4 * time.Second, Range: 18.0},
		"Spell Focus":       {ManaCost: 30, Cooldown: 45 * time.Second, Range: 0.0},
		"Dragonfire Lance":  {ManaCost: 50, Cooldown: 20 * time.Second, Range: 18.0},
		"Teleport":          {ManaCost: 40, Cooldown: 12 * time.Second, Range: 15.0},
		"Arcane Shield":     {ManaCost: 40, Cooldown: 30 * time.Second, Range: 0.0},
		"Gravity Well":      {ManaCost: 60, Cooldown: 20 * time.Second, Range: 18.0},
		"Time Warp":         {ManaCost: 50, Cooldown: 60 * time.Second, Range: 15.0},
		"Frost Nova":        {ManaCost: 40, Cooldown: 10 * time.Second, Range: 8.0},
	},
	"Cleric": {
		"Spirit Guardians":       {ManaCost: 40, Cooldown: 10 * time.Second, Range: 6.0},
		"Guardian Spirits":       {ManaCost: 40, Cooldown: 10 * time.Second, Range: 6.0},
		"Healing Light":          {ManaCost: 25, Cooldown: 8 * time.Second, Range: 15.0},
		"Guardian Embrace":       {ManaCost: 40, Cooldown: 30 * time.Second, Range: 6.0},
		"Purifying Wave":         {ManaCost: 30, Cooldown: 12 * time.Second, Range: 8.0},
		"Divine Intervention":    {ManaCost: 60, Cooldown: 120 * time.Second, Range: 15.0},
		"Radiant Strike":         {ManaCost: 20, Cooldown: 4 * time.Second, Range: 3.0},
		"Consecrated Ground":     {ManaCost: 40, Cooldown: 12 * time.Second, Range: 5.0},
		"Spirit Guardians Boost": {ManaCost: 40, Cooldown: 20 * time.Second, Range: 6.0},
		"Avenging Seraph":        {ManaCost: 60, Cooldown: 45 * time.Second, Range: 12.0},
		"Blessing of Resolve":    {ManaCost: 35, Cooldown: 45 * time.Second, Range: 10.0},
		"Blessing of Zeal":       {ManaCost: 35, Cooldown: 25 * time.Second, Range: 10.0},
		"Mark of Weakness":       {ManaCost: 30, Cooldown: 20 * time.Second, Range: 15.0},
		"Heaven's Trumpet":       {ManaCost: 50, Cooldown: 60 * time.Second, Range: 12.0},
		"Smite":                  {ManaCost: 30, Cooldown: 12 * time.Second, Range: 4.0},
	},
}

func getAbilitySpec(classType, skillName string) (AbilitySpec, bool) {
	classSpecs, ok := abilitySpecs[classType]
	if !ok {
		return AbilitySpec{}, false
	}
	spec, ok := classSpecs[skillName]
	if !ok {
		return AbilitySpec{}, false
	}
	return spec, true
}

func resolveAbilityManaCost(player *Entity, skillName string, fallback int) int {
	cost := fallback
	if spec, ok := getAbilitySpec(player.SubType, skillName); ok && spec.ManaCost >= 0 {
		cost = spec.ManaCost
	}
	return player.GetEffectiveManaCost(cost)
}

func resolveAbilityCooldown(classType, skillName string, fallback time.Duration) time.Duration {
	if spec, ok := getAbilitySpec(classType, skillName); ok && spec.Cooldown > 0 {
		return spec.Cooldown
	}
	return fallback
}
