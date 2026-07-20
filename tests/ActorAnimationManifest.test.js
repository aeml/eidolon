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

    test('no combat actor is classified without idle, movement, attack, and death presentation', () => {
        for (const actor of listActorAnimationEntries()) {
            if (actor.category === 'npc') continue;
            expect(actor.states).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Attack', 'Death']));
            expect(actor.browserEvidence).toMatch(/^local hardware gallery:/);
        }
    });
});
