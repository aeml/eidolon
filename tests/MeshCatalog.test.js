import { MeshCatalog } from '../src/utils/MeshCatalog.js';

describe('MeshCatalog', () => {
    test('separates startup and background preload paths', () => {
        const startup = MeshCatalog.getStartupPreloadModelPaths();
        const background = MeshCatalog.getBackgroundPreloadModelPaths();

        expect(startup).toContain('./assets/archetypes/Fighter/idle.glb');
        expect(startup).not.toContain('./assets/buildings/trading_post.glb');
        expect(background).toContain('./assets/buildings/trading_post.glb');
        expect(background).toContain('./assets/buildings/dungeons/the_verdant_bastion.glb');
    });

    test('mesh recipe aliases reuse quest NPC asset loader', () => {
        expect(MeshCatalog.recipes.DungeonNPC.alias).toBe('QuestManNpc');
        expect(MeshCatalog.recipes.RespecNPC.alias).toBe('QuestManNpc');
        expect(MeshCatalog.recipes.QuestNPC.loader).toBe('loadQuestManModel');
    });

    test('mesh recipes retain typed asset metadata for concrete entities', () => {
        expect(MeshCatalog.recipes.DwarfSalesman.modelPath).toBe('./assets/npc/dwarf_salesman/idle.glb');
        expect(MeshCatalog.recipes.Construct.animations).toEqual(['idle', 'walk', 'run', 'attack', 'death']);
        expect(MeshCatalog.recipes.TradingHouse.type).toBe('structure');
    });
});
