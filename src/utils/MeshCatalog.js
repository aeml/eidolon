const PRELOAD_MODEL_PATHS = [
    './assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/idle.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/walk.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/run.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/attack.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/death.glb',

    './assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/idle.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/walk.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/run.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/attack.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/death.glb',

    './assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/idle.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/walk.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/run.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/attack.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/death.glb',

    './assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/idle.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/walk.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/run.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/attack.glb',
    './assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/death.glb',

    './assets/enemies/snow/siren/idle.glb',
    './assets/enemies/snow/siren/walk.glb',
    './assets/enemies/snow/siren/run.glb',
    './assets/enemies/snow/siren/attack.glb',
    './assets/enemies/snow/siren/death.glb',

    './assets/enemies/golems/aqua_golem/idle.glb',
    './assets/enemies/golems/aqua_golem/walk.glb',
    './assets/enemies/golems/aqua_golem/run.glb',
    './assets/enemies/golems/aqua_golem/attack.glb',
    './assets/enemies/golems/aqua_golem/death.glb',

    './assets/enemies/humanoid/mountain_troll/idle.glb',
    './assets/enemies/humanoid/mountain_troll/walk.glb',
    './assets/enemies/humanoid/mountain_troll/run.glb',
    './assets/enemies/humanoid/mountain_troll/attack.glb',
    './assets/enemies/humanoid/mountain_troll/death.glb',

    './assets/buildings/trading_house.glb',
    './assets/buildings/blacksmith_forge.glb',
    './assets/objects/chests/stash_base.glb',

    './assets/plants/birch.glb',
    './assets/plants/pine.glb',
    './assets/plants/willow.glb',
    './assets/buildings/two_story_building.glb',
    './assets/buildings/trading_post.glb',
    './assets/buildings/blacksmith.glb',
    './assets/buildings/camp_site.glb',
    './assets/buildings/dungeons/the_verdant_bastion.glb',
    './assets/buildings/dungeons/the_molten_core.glb',
    './assets/buildings/dungeons/the_tempest_spire.glb',
    './assets/buildings/dungeons/the_abyssal_well.glb'
];

const BACKGROUND_PRELOAD_PREFIXES = [
    './assets/plants/',
    './assets/buildings/dungeons/'
];

const BACKGROUND_PRELOAD_PATHS = new Set([
    './assets/buildings/two_story_building.glb',
    './assets/buildings/trading_post.glb',
    './assets/buildings/blacksmith.glb',
    './assets/buildings/camp_site.glb'
]);

export class MeshCatalog {
    static recipes = {
        Skeleton: {
            type: 'enemy',
            source: 'procedural Gloamwood ossuary rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        DemonOrc: {
            type: 'enemy',
            source: 'procedural Cinder Wastes kiln-warrior rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        Imp: {
            type: 'enemy',
            source: 'procedural Cinder Wastes ember-scavenger rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        AvengingSeraph: {
            type: 'summon',
            source: 'procedural reliquary seraph rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        DwarfSalesman: {
            type: 'npc',
            source: 'procedural town actor',
            animations: ['Idle']
        },
        QuestNPC: {
            type: 'npc',
            source: 'procedural town actor',
            animations: ['Idle']
        },
        DungeonNPC: {
            type: 'npc',
            source: 'procedural town actor',
            animations: ['Idle']
        },
        RespecNPC: {
            type: 'npc',
            source: 'procedural town actor',
            animations: ['Idle']
        },
        Construct: {
            type: 'enemy',
            source: 'procedural Gloamwood grave-reliquary rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        InfernoTitan: {
            type: 'enemy',
            source: 'procedural Cinder Wastes crucible-titan rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        TradingHouse: {
            type: 'structure',
            modelPath: './assets/buildings/trading_house.glb'
        }
    };

    static proceduralEnemySpecs = {
        // Fire realm overworld
        SandstormDjinn: { shape: 'wraith', scale: 2.5, color: 0xD2B48C, emissive: 0x332200, emissiveI: 0.15 },
        MagmaGolem: { shape: 'golem', scale: 3.0, color: 0xFF4500, emissive: 0xFF2200, emissiveI: 0.4 },
        ScorchedWraith: { shape: 'wraith', scale: 2.5, color: 0xFF6600, emissive: 0xFF4400, emissiveI: 0.5 },
        InfernalBehemoth: { shape: 'titan', scale: 4.0, color: 0x8B0000, emissive: 0xFF0000, emissiveI: 0.3 },
        PhoenixSentinel: { shape: 'bird', scale: 3.0, color: 0xFFD700, emissive: 0xFF8C00, emissiveI: 0.6 },

        // Air realm overworld
        StormHarpy: { shape: 'bird', scale: 2.5, color: 0x87CEEB, emissive: 0x000000, emissiveI: 0 },
        CloudElemental: { shape: 'elemental', scale: 2.8, color: 0xE0E0E0, emissive: 0xCCCCCC, emissiveI: 0.2 },
        ThunderRoc: { shape: 'bird', scale: 3.0, color: 0x4169E1, emissive: 0xFFFF00, emissiveI: 0.3 },
        TempestGiant: { shape: 'titan', scale: 4.5, color: 0x483D8B, emissive: 0x00BFFF, emissiveI: 0.2 },
        CycloneAvatar: { shape: 'elemental', scale: 3.5, color: 0x00CED1, emissive: 0x00FFFF, emissiveI: 0.4 },

        // Fire dungeon bosses
        Cindermaw: { shape: 'beast', scale: 4.0, color: 0xFF4500, emissive: 0xFF2200, emissiveI: 0.6 },
        ScorchedTwins: { shape: 'humanoid', scale: 3.5, color: 0xFF6347, emissive: 0xFF4500, emissiveI: 0.5 },
        ForgemasterPyrax: { shape: 'golem', scale: 4.5, color: 0xB22222, emissive: 0xFF4500, emissiveI: 0.4 },
        ObsidianGuardian: { shape: 'titan', scale: 5.0, color: 0x1C1C1C, emissive: 0xFF0000, emissiveI: 0.2 },
        LordInfernax: { shape: 'titan', scale: 6.0, color: 0x8B0000, emissive: 0xFF4500, emissiveI: 0.7 },

        // Air dungeon bosses
        Windshear: { shape: 'elemental', scale: 4.0, color: 0x87CEEB, emissive: 0x00BFFF, emissiveI: 0.4 },
        Stormcallers: { shape: 'humanoid', scale: 3.5, color: 0x9370DB, emissive: 0xFFFF00, emissiveI: 0.3 },
        RocMatriarch: { shape: 'bird', scale: 4.5, color: 0x4682B4, emissive: 0x00CED1, emissiveI: 0.3 },
        ThunderlordKaelix: { shape: 'titan', scale: 5.5, color: 0x483D8B, emissive: 0xFFFF00, emissiveI: 0.5 },
        Zephyrion: { shape: 'elemental', scale: 6.5, color: 0x00CED1, emissive: 0x00FFFF, emissiveI: 0.6 },

        // Water dungeon bosses
        TiderendLeviathan: { shape: 'serpent', scale: 4.0, color: 0x0AA0B8, emissive: 0x3DE7FF, emissiveI: 0.4 },
        DrownedChoir: { shape: 'wraith', scale: 3.6, color: 0x1E6F9F, emissive: 0x6FD8FF, emissiveI: 0.3 },
        AbyssalGoliath: { shape: 'golem', scale: 4.6, color: 0x0D3D5C, emissive: 0x2BB4CC, emissiveI: 0.2 },
        MaelstromWarden: { shape: 'titan', scale: 5.2, color: 0x0A3A6B, emissive: 0x4DD2FF, emissiveI: 0.4 },
        Thalorath: { shape: 'titan', scale: 6.2, color: 0x003B6F, emissive: 0x4EF2FF, emissiveI: 0.5 },
    };

    static getProceduralEnemySpecs() {
        return this.proceduralEnemySpecs;
    }

    static getPreloadModelPaths() {
        return [...PRELOAD_MODEL_PATHS];
    }

    static isBackgroundPreloadPath(path) {
        if (!path) return false;
        return BACKGROUND_PRELOAD_PATHS.has(path) || BACKGROUND_PRELOAD_PREFIXES.some((prefix) => path.startsWith(prefix));
    }

    static getStartupPreloadModelPaths(playerType = '') {
        const modelBackedPlayerTypes = new Set();
        const proceduralPlayerTypes = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);
        const selectedPlayerType = modelBackedPlayerTypes.has(playerType) ? playerType : '';
        const playerPrefix = selectedPlayerType
            ? `./assets/archetypes/${selectedPlayerType}/`
            : (proceduralPlayerTypes.has(playerType) ? null : './assets/archetypes/');

        // The network connection and entity stream start after this gate. Load
        // only a selected authored local actor. Procedural player and starter-
        // region enemy rigs are synchronous, while distant authored assets
        // remain on demand so unused models cannot hold entry open.
        return this.getPreloadModelPaths().filter((path) =>
            playerPrefix && path.startsWith(playerPrefix)
        );
    }

    static getBackgroundPreloadModelPaths() {
        return this.getPreloadModelPaths().filter((path) => this.isBackgroundPreloadPath(path));
    }
}
