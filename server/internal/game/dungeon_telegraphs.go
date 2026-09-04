package game

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
