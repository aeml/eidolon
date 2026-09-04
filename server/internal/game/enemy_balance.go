package game

import (
	"math"
	"time"
)

// Enemy progression is anchored to the level-10 Skeleton, whose live combat
// pacing is the reference encounter for the rest of the game. Past level 10,
// health and damage grow linearly with the player's post-squish stat budget.
// Individual families then apply small silhouette/gameplay modifiers instead
// of carrying unrelated pre-squish stat blocks.
const (
	starterEnemyLevel      = 10
	starterEnemyVitality   = 15
	starterEnemyStrength   = 15
	starterEnemyDexterity  = 9
	starterEnemyCasterStat = 6

	enemyVitalityPerLevel = 3
	enemyStrengthPerLevel = 3

	dungeonTrashHealthMultiplier = 2.5
	dungeonTrashDamageMultiplier = 0.85
	dungeonEliteHealthMultiplier = 5.0
	dungeonEliteDamageMultiplier = 1.05
	dungeonBossHealthMultiplier  = 20.0
	dungeonBossDamageMultiplier  = 1.25
)

type enemyArchetypeBalance struct {
	HealthMultiplier float64
	DamageMultiplier float64
	Speed            float64
}

// Modifiers stay deliberately narrow. The shared level curve owns progression;
// these values only preserve readable archetype differences (glass cannon,
// bruiser, tank, or swift attacker) within a level band.
var enemyArchetypeBalances = map[string]enemyArchetypeBalance{
	"Skeleton":         {HealthMultiplier: 1.00, DamageMultiplier: 1.00, Speed: 5.4},
	"Imp":              {HealthMultiplier: 0.85, DamageMultiplier: 0.90, Speed: 5.4},
	"DemonOrc":         {HealthMultiplier: 1.10, DamageMultiplier: 1.10, Speed: 5.4},
	"Construct":        {HealthMultiplier: 1.25, DamageMultiplier: 0.85, Speed: 5.0},
	"InfernoTitan":     {HealthMultiplier: 1.30, DamageMultiplier: 1.15, Speed: 4.7},
	"MountainTroll":    {HealthMultiplier: 1.15, DamageMultiplier: 1.10, Speed: 5.0},
	"AquaGolem":        {HealthMultiplier: 1.35, DamageMultiplier: 1.00, Speed: 4.0},
	"Siren":            {HealthMultiplier: 0.85, DamageMultiplier: 1.10, Speed: 5.4},
	"FrostGuardian":    {HealthMultiplier: 1.40, DamageMultiplier: 1.05, Speed: 4.5},
	"SandstormDjinn":   {HealthMultiplier: 0.90, DamageMultiplier: 1.00, Speed: 5.2},
	"MagmaGolem":       {HealthMultiplier: 1.30, DamageMultiplier: 1.10, Speed: 4.2},
	"ScorchedWraith":   {HealthMultiplier: 0.80, DamageMultiplier: 1.15, Speed: 5.7},
	"InfernalBehemoth": {HealthMultiplier: 1.40, DamageMultiplier: 1.20, Speed: 4.3},
	"PhoenixSentinel":  {HealthMultiplier: 1.00, DamageMultiplier: 1.10, Speed: 5.5},
	"StormHarpy":       {HealthMultiplier: 0.80, DamageMultiplier: 1.05, Speed: 5.8},
	"CloudElemental":   {HealthMultiplier: 1.15, DamageMultiplier: 0.95, Speed: 5.1},
	"ThunderRoc":       {HealthMultiplier: 1.00, DamageMultiplier: 1.15, Speed: 5.7},
	"TempestGiant":     {HealthMultiplier: 1.35, DamageMultiplier: 1.15, Speed: 4.5},
	"CycloneAvatar":    {HealthMultiplier: 1.10, DamageMultiplier: 1.20, Speed: 5.8},
	"DissonantShade":   {HealthMultiplier: 1.05, DamageMultiplier: 1.15, Speed: 5.6},
	"MemoryReaver":     {HealthMultiplier: 1.40, DamageMultiplier: 1.20, Speed: 4.8},
}

type dungeonEnemyRank int

const (
	dungeonRankTrash dungeonEnemyRank = iota
	dungeonRankElite
	dungeonRankBoss
)

type dungeonBossBalance struct {
	HealthMultiplier float64
	DamageMultiplier float64
}

// Boss depth remains meaningful without inheriting the old million-Vitality
// constants. Final bosses have longer, harder encounters than entry bosses,
// while all of them still follow the selected run level and difficulty.
var dungeonBossBalances = map[string]dungeonBossBalance{
	"RootboundWarden":   {HealthMultiplier: 1.00, DamageMultiplier: 1.00},
	"BriarMatron":       {HealthMultiplier: 1.12, DamageMultiplier: 1.06},
	"RustboundColossus": {HealthMultiplier: 1.25, DamageMultiplier: 1.12},
	"HollowSentinel":    {HealthMultiplier: 1.45, DamageMultiplier: 1.22},

	"Cindermaw":         {HealthMultiplier: 1.00, DamageMultiplier: 1.00},
	"ScorchedTwins":     {HealthMultiplier: 1.25, DamageMultiplier: 1.05},
	"ForgemasterPyrax":  {HealthMultiplier: 1.45, DamageMultiplier: 1.12},
	"ObsidianGuardian":  {HealthMultiplier: 1.75, DamageMultiplier: 1.20},
	"LordInfernax":      {HealthMultiplier: 2.40, DamageMultiplier: 1.35},
	"Windshear":         {HealthMultiplier: 1.00, DamageMultiplier: 1.00},
	"Stormcallers":      {HealthMultiplier: 1.25, DamageMultiplier: 1.05},
	"RocMatriarch":      {HealthMultiplier: 1.45, DamageMultiplier: 1.12},
	"ThunderlordKaelix": {HealthMultiplier: 1.75, DamageMultiplier: 1.20},
	"Zephyrion":         {HealthMultiplier: 2.40, DamageMultiplier: 1.35},
	"TiderendLeviathan": {HealthMultiplier: 1.00, DamageMultiplier: 1.00},
	"DrownedChoir":      {HealthMultiplier: 1.25, DamageMultiplier: 1.05},
	"AbyssalGoliath":    {HealthMultiplier: 1.45, DamageMultiplier: 1.12},
	"MaelstromWarden":   {HealthMultiplier: 1.75, DamageMultiplier: 1.20},
	"Thalorath":         {HealthMultiplier: 2.40, DamageMultiplier: 1.35},
	"DissonantHerald":   {HealthMultiplier: 1.35, DamageMultiplier: 1.10},
	"NullArchitect":     {HealthMultiplier: 1.80, DamageMultiplier: 1.22},
	"EidolonDevourer":   {HealthMultiplier: 2.70, DamageMultiplier: 1.40},
	"UmbraPrime":        {HealthMultiplier: 8.00, DamageMultiplier: 1.55},
	"GravenColossus":    {HealthMultiplier: 4.00, DamageMultiplier: 1.35},
	"TideboundTyrant":   {HealthMultiplier: 4.25, DamageMultiplier: 1.38},
	"AshenImperator":    {HealthMultiplier: 4.50, DamageMultiplier: 1.42},
	"TempestSovereign":  {HealthMultiplier: 4.50, DamageMultiplier: 1.45},
}

type enemyCombatProfile struct {
	BaseStats      Stats
	Health         int
	MaxHealth      int
	Mana           int
	MaxMana        int
	Damage         int
	Speed          float64
	AttackSpeed    float64
	AttackCooldown time.Duration
}

func balancedEnemyBaseStats(level int) Stats {
	if level < starterEnemyLevel {
		level = starterEnemyLevel
	}
	levelsAfterStarter := level - starterEnemyLevel
	return Stats{
		Strength:     starterEnemyStrength + levelsAfterStarter*enemyStrengthPerLevel,
		Dexterity:    starterEnemyDexterity + levelsAfterStarter/4,
		Intelligence: starterEnemyCasterStat,
		Wisdom:       starterEnemyCasterStat,
		Vitality:     starterEnemyVitality + levelsAfterStarter*enemyVitalityPerLevel,
	}
}

func positiveScaledStat(value int, multiplier float64) int {
	if value <= 0 || multiplier <= 0 {
		return 0
	}
	scaled := int(math.Round(float64(value) * multiplier))
	if scaled < 1 {
		return 1
	}
	return scaled
}

func enemyAttackTiming(dexterity int) (float64, time.Duration) {
	speedMultiplier := 1.0 + float64(dexterity)*0.02
	cooldown := 5.0 / speedMultiplier
	if cooldown < 1.0 {
		cooldown = 1.0
	}
	return cooldown, time.Duration(cooldown * float64(time.Second))
}

func enemyProfileFromStats(stats Stats, speed float64) enemyCombatProfile {
	attackSpeed, attackCooldown := enemyAttackTiming(stats.Dexterity)
	maxHealth := stats.Vitality * 10
	maxMana := stats.Intelligence * 10
	return enemyCombatProfile{
		BaseStats:      stats,
		Health:         maxHealth,
		MaxHealth:      maxHealth,
		Mana:           maxMana,
		MaxMana:        maxMana,
		Damage:         stats.Strength * 2,
		Speed:          speed,
		AttackSpeed:    attackSpeed,
		AttackCooldown: attackCooldown,
	}
}

func balancedEnemyStats(subType string, level int, healthMultiplier, damageMultiplier float64) Stats {
	stats := balancedEnemyBaseStats(level)
	archetype := enemyArchetypeBalances[subType]
	if archetype.HealthMultiplier == 0 {
		archetype.HealthMultiplier = 1
	}
	if archetype.DamageMultiplier == 0 {
		archetype.DamageMultiplier = 1
	}
	stats.Vitality = positiveScaledStat(stats.Vitality, archetype.HealthMultiplier*healthMultiplier)
	stats.Strength = positiveScaledStat(stats.Strength, archetype.DamageMultiplier*damageMultiplier)
	return stats
}

func overworldEnemyCombatProfile(subType string, level int, elite bool) enemyCombatProfile {
	healthMultiplier, damageMultiplier := 1.0, 1.0
	if elite {
		healthMultiplier = 1.5
		damageMultiplier = 1.5
	}
	archetype := enemyArchetypeBalances[subType]
	speed := archetype.Speed
	if speed == 0 {
		speed = 5.4
	}
	return enemyProfileFromStats(
		balancedEnemyStats(subType, level, healthMultiplier, damageMultiplier),
		speed,
	)
}

func dungeonRankMultipliers(rank dungeonEnemyRank) (float64, float64) {
	switch rank {
	case dungeonRankElite:
		return dungeonEliteHealthMultiplier, dungeonEliteDamageMultiplier
	case dungeonRankBoss:
		return dungeonBossHealthMultiplier, dungeonBossDamageMultiplier
	default:
		return dungeonTrashHealthMultiplier, dungeonTrashDamageMultiplier
	}
}

func dungeonEnemyCombatProfile(subType string, runLevel int, difficulty DungeonDifficulty, rank dungeonEnemyRank, speed float64) enemyCombatProfile {
	healthMultiplier, damageMultiplier := dungeonRankMultipliers(rank)
	if rank == dungeonRankBoss {
		bossBalance := dungeonBossBalances[subType]
		if bossBalance.HealthMultiplier == 0 {
			bossBalance.HealthMultiplier = 1
		}
		if bossBalance.DamageMultiplier == 0 {
			bossBalance.DamageMultiplier = 1
		}
		healthMultiplier *= bossBalance.HealthMultiplier
		damageMultiplier *= bossBalance.DamageMultiplier
	}
	difficultyHealth, difficultyDamage, _, _ := DifficultyMultipliers(difficulty)
	healthMultiplier *= difficultyHealth
	damageMultiplier *= difficultyDamage
	return enemyProfileFromStats(
		balancedEnemyStats(subType, runLevel, healthMultiplier, damageMultiplier),
		speed,
	)
}
