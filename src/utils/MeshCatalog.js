import { PROCEDURAL_FOLIAGE_RECIPES } from '../art/ProceduralRealmFoliage.js';

const PRELOAD_MODEL_PATHS = [];

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
        MountainTroll: {
            type: 'enemy',
            source: 'procedural Moonfrost rimeback-troll rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        AquaGolem: {
            type: 'enemy',
            source: 'procedural Moonfrost drowned-cairn rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        Siren: {
            type: 'enemy',
            source: 'procedural Moonfrost choir-siren rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        FrostGuardian: {
            type: 'enemy',
            source: 'procedural Moonfrost glacial-bell rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        RootboundWarden: {
            type: 'enemy',
            source: 'procedural Thorncrypt root-gate rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        BriarMatron: {
            type: 'enemy',
            source: 'procedural Thorncrypt briar-crown rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        RustboundColossus: {
            type: 'enemy',
            source: 'procedural Thorncrypt rust-reliquary rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        HollowSentinel: {
            type: 'enemy',
            source: 'procedural Thorncrypt hollow-vigil rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        Cindermaw: {
            type: 'enemy',
            source: 'procedural Furnace Below cinder-hound rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        ScorchedTwins: {
            type: 'enemy',
            source: 'procedural Furnace Below twin-flame rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        ForgemasterPyrax: {
            type: 'enemy',
            source: 'procedural Furnace Below oath-anvil rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        ObsidianGuardian: {
            type: 'enemy',
            source: 'procedural Furnace Below black-glass bulwark rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        LordInfernax: {
            type: 'enemy',
            source: 'procedural Furnace Below furnace-lord rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        Windshear: {
            type: 'enemy',
            source: 'procedural Shattered Aerie wind-razor rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        Stormcallers: {
            type: 'enemy',
            source: 'procedural Shattered Aerie divided-oracle rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        RocMatriarch: {
            type: 'enemy',
            source: 'procedural Shattered Aerie thunder-roc rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        ThunderlordKaelix: {
            type: 'enemy',
            source: 'procedural Shattered Aerie storm-bell rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        Zephyrion: {
            type: 'enemy',
            source: 'procedural Shattered Aerie eternal-gale rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        TiderendLeviathan: {
            type: 'enemy',
            source: 'procedural Drowned Sanctum tide-rend rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        DrownedChoir: {
            type: 'enemy',
            source: 'procedural Drowned Sanctum many-voiced rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        AbyssalGoliath: {
            type: 'enemy',
            source: 'procedural Drowned Sanctum anchor-cairn rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        MaelstromWarden: {
            type: 'enemy',
            source: 'procedural Drowned Sanctum maelstrom-bulwark rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        Thalorath: {
            type: 'enemy',
            source: 'procedural Drowned Sanctum tide-king rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        SandstormDjinn: {
            type: 'enemy',
            source: 'procedural Cinder Wastes ash-dune rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        MagmaGolem: {
            type: 'enemy',
            source: 'procedural Cinder Wastes fault-heart rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        ScorchedWraith: {
            type: 'enemy',
            source: 'procedural Cinder Wastes cinder-shroud rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        InfernalBehemoth: {
            type: 'enemy',
            source: 'procedural Cinder Wastes kiln-behemoth rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        PhoenixSentinel: {
            type: 'enemy',
            source: 'procedural Cinder Wastes oathflame-phoenix rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        StormHarpy: {
            type: 'enemy',
            source: 'procedural Stormcrown gale-talon rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        CloudElemental: {
            type: 'enemy',
            source: 'procedural Stormcrown captive-cloud rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        ThunderRoc: {
            type: 'enemy',
            source: 'procedural Stormcrown conductor-roc rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        TempestGiant: {
            type: 'enemy',
            source: 'procedural Stormcrown thunder-cairn rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        CycloneAvatar: {
            type: 'enemy',
            source: 'procedural Stormcrown hollow-cyclone rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        },
        TradingHouse: {
            type: 'structure',
            source: 'procedural Lanternhold auction hall'
        },
        Stash: {
            type: 'structure',
            source: 'procedural Lanternhold reliquary chest'
        },
        Forge: {
            type: 'structure',
            source: 'procedural Lanternhold oathfire forge'
        }
    };

    static proceduralEnemySpecs = {};

    static getProceduralEnemySpecs() {
        return this.proceduralEnemySpecs;
    }

    static getProceduralFoliageRecipes() {
        return PROCEDURAL_FOLIAGE_RECIPES;
    }

    static getPreloadModelPaths() {
        return [...PRELOAD_MODEL_PATHS];
    }

    static isBackgroundPreloadPath(path) {
        void path;
        return false;
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
