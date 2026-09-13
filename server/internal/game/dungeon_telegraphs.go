package game

import "math"

type bossImpactCircle struct{ X, Z, Radius float64 }

// Locked at windup: the exact circles sent to clients also resolve the hit.
// Overlapping circles belong to one attack, never several stacked damage hits.
func dungeonBossImpactPattern(boss *Entity, targetX, targetZ float64) ([]bossImpactCircle, string) {
	presentation := telegraphPresentationForDungeonBoss(boss.SubType)
	angle := math.Atan2(targetZ-boss.Z, targetX-boss.X)
	point := func(distance, offset, radius float64) bossImpactCircle {
		return bossImpactCircle{boss.X + math.Cos(angle+offset)*distance, boss.Z + math.Sin(angle+offset)*distance, radius}
	}
	switch presentation.Theme {
	case "verdant_bastion_catacombs":
		return []bossImpactCircle{point(0, 0, 6), point(10, 0, 6), point(20, 0, 6)}, "Step sideways out of the fissure line."
	case "abyssal_well":
		return []bossImpactCircle{{targetX, targetZ, 10}}, "Surge locked on its target's position—move out of the marked pool."
	case "molten_core":
		return []bossImpactCircle{point(0, 0, 7), point(17, math.Pi/2, 7), point(17, -math.Pi/2, 7)}, "Move between the eruption pockets; keep a clear escape lane."
	case "tempest_spire":
		circles := make([]bossImpactCircle, 6)
		for i := range circles {
			circles[i] = point(22, float64(i)*math.Pi/3, 8)
		}
		return circles, "The storm closes around the edge. Move into its safe center or beyond the marked ring."
	default:
		return []bossImpactCircle{{boss.X, boss.Z, 8 + (boss.Scale-1)*1.5}}, "Leave the marked circle before impact."
	}
}

func insideBossImpactPattern(x, z float64, circles []bossImpactCircle) bool {
	for _, circle := range circles {
		if math.Hypot(x-circle.X, z-circle.Z) <= circle.Radius {
			return true
		}
	}
	return false
}

type dungeonBossTelegraphPresentation struct {
	Theme  string
	Attack string
	Label  string
}

func telegraphPresentationForDungeonBoss(subType string) dungeonBossTelegraphPresentation {
	switch subType {
	case "RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel":
		return dungeonBossTelegraphPresentation{Theme: "verdant_bastion_catacombs", Attack: "root_quake", Label: "ROOT QUAKE"}
	case "Cindermaw", "ScorchedTwins", "ForgemasterPyrax", "ObsidianGuardian", "LordInfernax":
		return dungeonBossTelegraphPresentation{Theme: "molten_core", Attack: "furnace_rupture", Label: "FURNACE RUPTURE"}
	case "Windshear", "Stormcallers", "RocMatriarch", "ThunderlordKaelix", "Zephyrion":
		return dungeonBossTelegraphPresentation{Theme: "tempest_spire", Attack: "stormbreak", Label: "STORMBREAK"}
	case "TiderendLeviathan", "DrownedChoir", "AbyssalGoliath", "MaelstromWarden", "Thalorath":
		return dungeonBossTelegraphPresentation{Theme: "abyssal_well", Attack: "undertow_crush", Label: "UNDERTOW CRUSH"}
	case "DissonantHerald", "NullArchitect", "EidolonDevourer", "UmbraPrime":
		return dungeonBossTelegraphPresentation{Theme: "umbral_nexus", Attack: "memory_fracture", Label: "MEMORY FRACTURE"}
	case "GravenColossus":
		return dungeonBossTelegraphPresentation{Theme: "verdant_bastion_catacombs", Attack: "root_quake", Label: "SANCTUM FRACTURE"}
	case "TideboundTyrant":
		return dungeonBossTelegraphPresentation{Theme: "abyssal_well", Attack: "undertow_crush", Label: "CONFLUENCE SURGE"}
	case "AshenImperator":
		return dungeonBossTelegraphPresentation{Theme: "molten_core", Attack: "furnace_rupture", Label: "CROWN ERUPTION"}
	case "TempestSovereign":
		return dungeonBossTelegraphPresentation{Theme: "tempest_spire", Attack: "stormbreak", Label: "EYRIE STORMBREAK"}
	default:
		return dungeonBossTelegraphPresentation{Attack: "ground_slam", Label: "BOSS SLAM"}
	}
}
