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

    test.each(['Fighter', 'Rogue', 'Wizard', 'Cleric'])('procedural %s and starter enemies never enter the model preload gate', (type) => {
        const startup = MeshCatalog.getStartupPreloadModelPaths(type);

        expect(startup).toEqual([]);
        expect(MeshCatalog.getPreloadModelPaths().some((path) => path.includes(`/${type}/`))).toBe(false);
        expect(MeshCatalog.getPreloadModelPaths().some((path) => path.includes('/skeleton/'))).toBe(false);
    });

    test('legacy regional enemies have explicit procedural recipes and no migrated model preload', () => {
        expect(MeshCatalog.recipes.Skeleton.source).toBe('procedural Gloamwood ossuary rig');
        expect(MeshCatalog.recipes.DemonOrc.source).toBe('procedural Cinder Wastes kiln-warrior rig');
        expect(MeshCatalog.recipes.Imp.source).toBe('procedural Cinder Wastes ember-scavenger rig');
        expect(MeshCatalog.recipes.Construct.source).toBe('procedural Gloamwood grave-reliquary rig');
        expect(MeshCatalog.recipes.InfernoTitan.source).toBe('procedural Cinder Wastes crucible-titan rig');
        for (const type of ['Skeleton', 'DemonOrc', 'Imp', 'Construct', 'InfernoTitan']) {
            expect(MeshCatalog.recipes[type]).toEqual(expect.objectContaining({
                type: 'enemy',
                animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            }));
        }
        expect(MeshCatalog.getPreloadModelPaths().some((path) => /skeleton|demon_orc|\/imp\/|\/construct\/|\/inferno_titan\//.test(path))).toBe(false);
    });

    test('Moonfrost enemies have explicit procedural recipes and no authored-model preload', () => {
        const expectedSources = {
            MountainTroll: 'procedural Moonfrost rimeback-troll rig',
            AquaGolem: 'procedural Moonfrost drowned-cairn rig',
            Siren: 'procedural Moonfrost choir-siren rig',
            FrostGuardian: 'procedural Moonfrost glacial-bell rig'
        };
        for (const [type, source] of Object.entries(expectedSources)) {
            expect(MeshCatalog.recipes[type]).toEqual({
                type: 'enemy',
                source,
                animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            });
        }
        expect(MeshCatalog.getPreloadModelPaths().some((path) => /siren|aqua_golem|mountain_troll|frostguardian/.test(path))).toBe(false);
    });

    test('Thorncrypt bosses have explicit procedural recipes and no authored-model preload', () => {
        const expectedSources = {
            RootboundWarden: 'procedural Thorncrypt root-gate rig',
            BriarMatron: 'procedural Thorncrypt briar-crown rig',
            RustboundColossus: 'procedural Thorncrypt rust-reliquary rig',
            HollowSentinel: 'procedural Thorncrypt hollow-vigil rig'
        };
        for (const [type, source] of Object.entries(expectedSources)) {
            expect(MeshCatalog.recipes[type]).toEqual({
                type: 'enemy',
                source,
                animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            });
        }
        expect(MeshCatalog.getPreloadModelPaths().some((path) => (
            /rootbound_warden|briar_matron|rustbound_colossus|hollow_sentinel/.test(path)
        ))).toBe(false);
    });

    test('all Lanternhold services use explicit procedural actor recipes', () => {
        for (const type of ['DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC']) {
            expect(MeshCatalog.recipes[type]).toEqual({
                type: 'npc',
                source: 'procedural town actor',
                animations: ['Idle']
            });
        }
        expect(MeshCatalog.getPreloadModelPaths().some((path) => path.startsWith('./assets/npc/'))).toBe(false);
    });

    test('Avenging Seraph is an explicit procedural summon with no model preload', () => {
        expect(MeshCatalog.recipes.AvengingSeraph).toEqual({
            type: 'summon',
            source: 'procedural reliquary seraph rig',
            animations: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        });
        expect(MeshCatalog.getPreloadModelPaths().some((path) => path.includes('/avenging_seraph/'))).toBe(false);
    });

    test('mesh recipes retain typed asset metadata for concrete entities', () => {
        expect(MeshCatalog.recipes.AvengingSeraph.type).toBe('summon');
        expect(MeshCatalog.recipes.DwarfSalesman.source).toBe('procedural town actor');
        expect(MeshCatalog.recipes.Construct.animations).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
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
