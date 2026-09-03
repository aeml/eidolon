import { readFileSync } from 'node:fs';
import { MeshCatalog } from '../src/utils/MeshCatalog.js';
import {
    ACTOR_ANIMATION_MANIFEST,
    getActorAnimationEntry,
    listActorAnimationEntries
} from '../src/entities/actorAnimationManifest.js';

const PLAYER_TYPES = ['Fighter', 'Rogue', 'Wizard', 'Cleric'];
const NPC_TYPES = ['DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC', 'AvengingSeraph'];

function remoteEnemyTypes() {
    const source = readFileSync('src/core/GameEngine.js', 'utf8');
    const enemySwitch = source.slice(
        source.indexOf("} else if (type === 'Enemy')"),
        source.indexOf('// Check for Elite ID pattern')
    );
    return [...enemySwitch.matchAll(/case '([^']+)'/g)].map((match) => match[1]);
}

describe('actor animation manifest', () => {
    test('classifies every remote enemy constructor path', () => {
        const types = remoteEnemyTypes();
        expect(types.length).toBeGreaterThan(30);
        types.forEach((type) => expect(getActorAnimationEntry(type)).not.toBeNull());
    });

    test('classifies every player, NPC, and summon path', () => {
        [...PLAYER_TYPES, ...NPC_TYPES].forEach((type) => {
            expect(getActorAnimationEntry(type)).not.toBeNull();
        });
    });

    test('all procedural mesh catalog entries use generated standard clips', () => {
        for (const type of Object.keys(MeshCatalog.getProceduralEnemySpecs())) {
            expect(ACTOR_ANIMATION_MANIFEST[type]).toEqual(expect.objectContaining({
                source: 'procedural clips',
                states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            }));
        }
    });

    test('classifies Fighter as the shared procedural humanoid vertical slice', () => {
        expect(ACTOR_ANIMATION_MANIFEST.Fighter).toEqual(expect.objectContaining({
            source: 'shared procedural humanoid rig',
            states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        }));
    });

    test('classifies Rogue as a class-specific shared procedural humanoid', () => {
        expect(ACTOR_ANIMATION_MANIFEST.Rogue).toEqual(expect.objectContaining({
            source: 'shared procedural humanoid rig',
            states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        }));
    });

    test('classifies Wizard as a class-specific shared procedural humanoid', () => {
        expect(ACTOR_ANIMATION_MANIFEST.Wizard).toEqual(expect.objectContaining({
            source: 'shared procedural humanoid rig',
            states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        }));
    });

    test('classifies Cleric as a class-specific shared procedural humanoid', () => {
        expect(ACTOR_ANIMATION_MANIFEST.Cleric).toEqual(expect.objectContaining({
            source: 'shared procedural humanoid rig',
            states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        }));
    });

    test('classifies every Lanternhold service as an intentional procedural town actor', () => {
        for (const type of ['DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC']) {
            expect(ACTOR_ANIMATION_MANIFEST[type]).toEqual(expect.objectContaining({
                category: 'npc',
                source: 'procedural town actor rig',
                states: ['Idle']
            }));
            expect(ACTOR_ANIMATION_MANIFEST[type].special).not.toBe('none');
        }
    });

    test('classifies Avenging Seraph as an intentional procedural summon', () => {
        expect(ACTOR_ANIMATION_MANIFEST.AvengingSeraph).toEqual(expect.objectContaining({
            category: 'summon',
            source: 'procedural reliquary seraph rig',
            states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        }));
        expect(ACTOR_ANIMATION_MANIFEST.AvengingSeraph.special).toContain('oath-spear');
    });

    test('classifies starter regional enemies as intentional procedural rigs', () => {
        expect(ACTOR_ANIMATION_MANIFEST.Skeleton).toEqual(expect.objectContaining({
            category: 'enemy',
            source: 'procedural Gloamwood ossuary rig',
            states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        }));
        expect(ACTOR_ANIMATION_MANIFEST.DemonOrc.source).toBe('procedural Cinder Wastes kiln-warrior rig');
        expect(ACTOR_ANIMATION_MANIFEST.Imp.source).toBe('procedural Cinder Wastes ember-scavenger rig');
        expect(ACTOR_ANIMATION_MANIFEST.Skeleton.special).toContain('soul lantern');
        expect(ACTOR_ANIMATION_MANIFEST.DemonOrc.special).toContain('cinder cleaver');
        expect(ACTOR_ANIMATION_MANIFEST.Imp.special).toContain('spaded tail');
    });

    test('classifies the greater Gloamwood and Cinder Wastes enemies as intentional procedural rigs', () => {
        expect(ACTOR_ANIMATION_MANIFEST.Construct).toEqual(expect.objectContaining({
            category: 'enemy',
            source: 'procedural Gloamwood grave-reliquary rig',
            states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        }));
        expect(ACTOR_ANIMATION_MANIFEST.InfernoTitan).toEqual(expect.objectContaining({
            category: 'enemy',
            source: 'procedural Cinder Wastes crucible-titan rig',
            states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
        }));
        expect(ACTOR_ANIMATION_MANIFEST.Construct.special).toContain('grave bell');
        expect(ACTOR_ANIMATION_MANIFEST.InfernoTitan.special).toContain('caldera cleaver');
    });

    test('classifies all Moonfrost enemies as intentional regional procedural rigs', () => {
        const expectedSources = {
            MountainTroll: 'procedural Moonfrost rimeback-troll rig',
            AquaGolem: 'procedural Moonfrost drowned-cairn rig',
            Siren: 'procedural Moonfrost choir-siren rig',
            FrostGuardian: 'procedural Moonfrost glacial-bell rig'
        };
        for (const [type, source] of Object.entries(expectedSources)) {
            expect(ACTOR_ANIMATION_MANIFEST[type]).toEqual(expect.objectContaining({
                category: 'enemy',
                source,
                states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            }));
            expect(ACTOR_ANIMATION_MANIFEST[type].special).not.toBe('Attack clip plus class telegraph/VFX');
        }
    });

    test('classifies all Thorncrypt bosses as intentional procedural boss rigs', () => {
        const expectedSources = {
            RootboundWarden: 'procedural Thorncrypt root-gate rig',
            BriarMatron: 'procedural Thorncrypt briar-crown rig',
            RustboundColossus: 'procedural Thorncrypt rust-reliquary rig',
            HollowSentinel: 'procedural Thorncrypt hollow-vigil rig'
        };
        for (const [type, source] of Object.entries(expectedSources)) {
            expect(ACTOR_ANIMATION_MANIFEST[type]).toEqual(expect.objectContaining({
                category: 'enemy',
                source,
                states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            }));
            expect(ACTOR_ANIMATION_MANIFEST[type].special).not.toBe('Attack clip plus class telegraph/VFX');
        }
    });

    test('classifies all Molten Core bosses as intentional regional boss rigs', () => {
        const expectedSources = {
            Cindermaw: 'procedural Furnace Below cinder-hound rig',
            ScorchedTwins: 'procedural Furnace Below twin-flame rig',
            ForgemasterPyrax: 'procedural Furnace Below oath-anvil rig',
            ObsidianGuardian: 'procedural Furnace Below black-glass bulwark rig',
            LordInfernax: 'procedural Furnace Below furnace-lord rig'
        };
        for (const [type, source] of Object.entries(expectedSources)) {
            expect(ACTOR_ANIMATION_MANIFEST[type]).toEqual(expect.objectContaining({
                category: 'enemy',
                source,
                states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            }));
            expect(ACTOR_ANIMATION_MANIFEST[type].special).not.toBe('Attack clip plus class telegraph/VFX');
        }
    });

    test('classifies all Tempest Spire bosses as intentional regional boss rigs', () => {
        const expectedSources = {
            Windshear: 'procedural Shattered Aerie wind-razor rig',
            Stormcallers: 'procedural Shattered Aerie divided-oracle rig',
            RocMatriarch: 'procedural Shattered Aerie thunder-roc rig',
            ThunderlordKaelix: 'procedural Shattered Aerie storm-bell rig',
            Zephyrion: 'procedural Shattered Aerie eternal-gale rig'
        };
        for (const [type, source] of Object.entries(expectedSources)) {
            expect(ACTOR_ANIMATION_MANIFEST[type]).toEqual(expect.objectContaining({
                category: 'enemy',
                source,
                states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            }));
            expect(ACTOR_ANIMATION_MANIFEST[type].special).not.toBe('Attack clip plus class telegraph/VFX');
        }
    });

    test('classifies all Abyssal Well bosses as intentional regional boss rigs', () => {
        const expectedSources = {
            TiderendLeviathan: 'procedural Drowned Sanctum tide-rend rig',
            DrownedChoir: 'procedural Drowned Sanctum many-voiced rig',
            AbyssalGoliath: 'procedural Drowned Sanctum anchor-cairn rig',
            MaelstromWarden: 'procedural Drowned Sanctum maelstrom-bulwark rig',
            Thalorath: 'procedural Drowned Sanctum tide-king rig'
        };
        for (const [type, source] of Object.entries(expectedSources)) {
            expect(ACTOR_ANIMATION_MANIFEST[type]).toEqual(expect.objectContaining({
                category: 'enemy',
                source,
                states: ['Idle', 'Walk', 'Run', 'Attack', 'Death']
            }));
            expect(ACTOR_ANIMATION_MANIFEST[type].special).not.toBe('Attack clip plus class telegraph/VFX');
        }
    });

    test('no combat actor is classified without idle, movement, attack, and death presentation', () => {
        for (const actor of listActorAnimationEntries()) {
            if (actor.category === 'npc') continue;
            expect(actor.states).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Attack', 'Death']));
            expect(actor.browserEvidence).toMatch(/^local hardware gallery:/);
        }
    });
});
