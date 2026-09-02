import { MeshCatalog } from '../src/utils/MeshCatalog.js';

describe('MeshCatalog', () => {
    test('separates startup and background preload paths', () => {
        const startup = MeshCatalog.getStartupPreloadModelPaths();
        const background = MeshCatalog.getBackgroundPreloadModelPaths();

        expect(startup).not.toContain('./assets/archetypes/Fighter/idle.glb');
        expect(startup).not.toContain('./assets/archetypes/Rogue/idle.glb');
        expect(startup).not.toContain('./assets/archetypes/Wizard/idle.glb');
        expect(startup).not.toContain('./assets/archetypes/Cleric/idle.glb');
        expect(startup).not.toContain('./assets/buildings/trading_post.glb');
        expect(background).toContain('./assets/buildings/trading_post.glb');
        expect(background).toContain('./assets/buildings/dungeons/the_verdant_bastion.glb');
    });

    test('procedural Fighter never enters the model preload gate', () => {
        const startup = MeshCatalog.getStartupPreloadModelPaths('Fighter');

        expect(startup).toHaveLength(5);
        expect(startup.every((path) => path.startsWith('./assets/enemies/undead/skeleton/'))).toBe(true);
        expect(MeshCatalog.getPreloadModelPaths().some((path) => path.includes('/Fighter/'))).toBe(false);
    });

    test('procedural Rogue never enters the model preload gate', () => {
        const startup = MeshCatalog.getStartupPreloadModelPaths('Rogue');

        expect(startup).toHaveLength(5);
        expect(startup.every((path) => path.startsWith('./assets/enemies/undead/skeleton/'))).toBe(true);
        expect(MeshCatalog.getPreloadModelPaths().some((path) => path.includes('/Rogue/'))).toBe(false);
    });

    test('procedural Wizard never enters the model preload gate', () => {
        const startup = MeshCatalog.getStartupPreloadModelPaths('Wizard');

        expect(startup).toHaveLength(5);
        expect(startup.every((path) => path.startsWith('./assets/enemies/undead/skeleton/'))).toBe(true);
        expect(MeshCatalog.getPreloadModelPaths().some((path) => path.includes('/Wizard/'))).toBe(false);
    });

    test('procedural Cleric never enters the model preload gate', () => {
        const startup = MeshCatalog.getStartupPreloadModelPaths('Cleric');

        expect(startup).toHaveLength(5);
        expect(startup.every((path) => path.startsWith('./assets/enemies/undead/skeleton/'))).toBe(true);
        expect(MeshCatalog.getPreloadModelPaths().some((path) => path.includes('/Cleric/'))).toBe(false);
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

    test('catalogs procedural enemy silhouettes for realm and dungeon enemies', () => {
        const specs = MeshCatalog.getProceduralEnemySpecs();

        expect(specs.SandstormDjinn).toMatchObject({ shape: 'wraith', scale: 2.5, color: 0xD2B48C });
        expect(specs.MagmaGolem).toMatchObject({ shape: 'golem', emissive: 0xFF2200 });
        expect(specs.Cindermaw).toMatchObject({ shape: 'beast', emissiveI: 0.6 });
        expect(specs.Zephyrion).toMatchObject({ shape: 'elemental', scale: 6.5 });
        expect(specs.Thalorath).toMatchObject({ shape: 'titan', color: 0x003B6F });
    });
});
