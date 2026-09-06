// Expected encounters are checked against the server catalog in unit tests.
// These are assertions, not a substitute layout or a way around story gates.
export const DUNGEON_PLAYTHROUGHS = Object.freeze({
    verdant_bastion_catacombs: { name: 'Verdant Bastion Catacombs', level: 30,
        bosses: ['RootboundWarden', 'BriarMatron', 'RustboundColossus', 'HollowSentinel'] },
    abyssal_well: { name: 'Abyssal Well', level: 60,
        bosses: ['TiderendLeviathan', 'DrownedChoir', 'AbyssalGoliath', 'MaelstromWarden', 'Thalorath'] },
    molten_core: { name: 'Molten Core', level: 70,
        bosses: ['Cindermaw', 'ScorchedTwins', 'ForgemasterPyrax', 'ObsidianGuardian', 'LordInfernax'] },
    tempest_spire: { name: 'Tempest Spire', level: 70,
        bosses: ['Windshear', 'Stormcallers', 'RocMatriarch', 'ThunderlordKaelix', 'Zephyrion'] },
    umbral_nexus: { name: 'Umbral Nexus', level: 100,
        bosses: ['DissonantHerald', 'NullArchitect', 'EidolonDevourer'] }
});

export function dungeonPlaythroughOptions(environment = {}) {
    const dungeonType = environment.EIDOLON_E2E_DUNGEON || 'verdant_bastion_catacombs';
    const definition = DUNGEON_PLAYTHROUGHS[dungeonType];
    if (!definition) throw new Error(`Unknown dungeon playthrough: ${dungeonType}`);
    const difficulty = environment.EIDOLON_E2E_DUNGEON_DIFFICULTY || 'normal';
    if (!['normal', 'heroic', 'mythic'].includes(difficulty)) throw new Error(`Unknown dungeon difficulty: ${difficulty}`);
    const runLevel = Number(environment.EIDOLON_E2E_DUNGEON_LEVEL || definition.level);
    if (!Number.isInteger(runLevel) || runLevel < definition.level || runLevel > 100 || runLevel % 10 !== 0) {
        throw new Error(`Dungeon run level must be a ten-level band from ${definition.level} to 100`);
    }
    return { dungeonType, difficulty, runLevel, ...definition };
}
