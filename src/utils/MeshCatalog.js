const PRELOAD_MODEL_PATHS = [
    './assets/archetypes/Fighter/idle.glb',
    './assets/archetypes/Fighter/walk.glb',
    './assets/archetypes/Fighter/run.glb',
    './assets/archetypes/Fighter/attack.glb',

    './assets/archetypes/Wizard/idle.glb',
    './assets/archetypes/Wizard/walk.glb',
    './assets/archetypes/Wizard/run.glb',
    './assets/archetypes/Wizard/attack.glb',

    './assets/archetypes/Rogue/idle.glb',
    './assets/archetypes/Rogue/walk.glb',
    './assets/archetypes/Rogue/run.glb',
    './assets/archetypes/Rogue/attack.glb',

    './assets/archetypes/Cleric/idle.glb',
    './assets/archetypes/Cleric/walk.glb',
    './assets/archetypes/Cleric/run.glb',
    './assets/archetypes/Cleric/attack.glb',

    './assets/enemies/undead/skeleton/idle.glb',
    './assets/enemies/undead/skeleton/walk.glb',
    './assets/enemies/undead/skeleton/run.glb',
    './assets/enemies/undead/skeleton/attack.glb',
    './assets/enemies/undead/skeleton/death.glb',

    './assets/enemies/demons/demon_orc/idle.glb',
    './assets/enemies/demons/demon_orc/walk.glb',
    './assets/enemies/demons/demon_orc/run.glb',
    './assets/enemies/demons/demon_orc/attack.glb',
    './assets/enemies/demons/demon_orc/death.glb',

    './assets/enemies/demons/imp/idle.glb',
    './assets/enemies/demons/imp/walk.glb',
    './assets/enemies/demons/imp/run.glb',
    './assets/enemies/demons/imp/attack.glb',
    './assets/enemies/demons/imp/death.glb',

    './assets/enemies/undead/construct/idle.glb',
    './assets/enemies/undead/construct/walk.glb',
    './assets/enemies/undead/construct/run.glb',
    './assets/enemies/undead/construct/attack.glb',
    './assets/enemies/undead/construct/death.glb',

    './assets/enemies/demons/inferno_titan/idle.glb',
    './assets/enemies/demons/inferno_titan/walk.glb',
    './assets/enemies/demons/inferno_titan/run.glb',
    './assets/enemies/demons/inferno_titan/attack.glb',
    './assets/enemies/demons/inferno_titan/death.glb',

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

    './assets/npc/dwarf_salesman/idle.glb',
    './assets/npc/quest_man/idle.glb',
    './assets/buildings/trading_house.glb',
    './assets/buildings/blacksmith_forge.glb',
    './assets/objects/chests/stash_base.glb',

    './assets/summons/avenging_seraph/idle.glb',
    './assets/summons/avenging_seraph/walk.glb',
    './assets/summons/avenging_seraph/run.glb',
    './assets/summons/avenging_seraph/attack.glb',
    './assets/summons/avenging_seraph/death.glb',

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
        DwarfSalesman: {
            type: 'npc',
            modelPath: './assets/npc/dwarf_salesman/idle.glb',
            animations: ['idle']
        },
        QuestNPC: {
            type: 'npc',
            modelPath: './assets/npc/quest_man/idle.glb',
            animations: ['idle'],
            loader: 'loadQuestManModel'
        },
        DungeonNPC: {
            type: 'npc',
            alias: 'QuestManNpc'
        },
        RespecNPC: {
            type: 'npc',
            alias: 'QuestManNpc'
        },
        Construct: {
            type: 'enemy',
            modelPath: './assets/enemies/undead/construct/idle.glb',
            animations: ['idle', 'walk', 'run', 'attack', 'death']
        },
        TradingHouse: {
            type: 'structure',
            modelPath: './assets/buildings/trading_house.glb'
        }
    };

    static getPreloadModelPaths() {
        return [...PRELOAD_MODEL_PATHS];
    }

    static isBackgroundPreloadPath(path) {
        if (!path) return false;
        return BACKGROUND_PRELOAD_PATHS.has(path) || BACKGROUND_PRELOAD_PREFIXES.some((prefix) => path.startsWith(prefix));
    }

    static getStartupPreloadModelPaths() {
        return this.getPreloadModelPaths().filter((path) => !this.isBackgroundPreloadPath(path));
    }

    static getBackgroundPreloadModelPaths() {
        return this.getPreloadModelPaths().filter((path) => this.isBackgroundPreloadPath(path));
    }
}
