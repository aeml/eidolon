import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Actor } from '../../../../../src/entities/base/Actor.js';
import { AquaGolem } from '../../../../../src/entities/enemies/AquaGolem.js';
import { AvengingSeraph } from '../../../../../src/entities/summons/AvengingSeraph.js';
import { BriarMatron } from '../../../../../src/entities/enemies/BriarMatron.js';
import { Fighter } from '../../../../../src/entities/players/Fighter.js';
import { HollowSentinel } from '../../../../../src/entities/enemies/HollowSentinel.js';
import { MountainTroll } from '../../../../../src/entities/enemies/MountainTroll.js';
import { QuestNPC } from '../../../../../src/entities/npcs/QuestNPC.js';
import { RootboundWarden } from '../../../../../src/entities/enemies/RootboundWarden.js';
import { RustboundColossus } from '../../../../../src/entities/enemies/RustboundColossus.js';

function activeAtOrigin(actor) {
    actor.position.set(1, 0, 0);
    actor.isActive = true;
    actor.state = 'IDLE';
    return actor;
}

describe('Fighter Guardian Roar local classification', () => {
    test('new and generic enemy families are taunted instead of receiving the ally buff', () => {
        const fighter = activeAtOrigin(new Fighter('fighter'));
        fighter.position.set(0, 0, 0);
        fighter.mesh = new THREE.Group();
        fighter.unlockedSkills.push('Guardian Roar');
        fighter.stats.mana = 1000;
        const genericEnemy = activeAtOrigin(new Actor('generic-enemy', {}));
        const enemies = [
            activeAtOrigin(new MountainTroll('troll')),
            activeAtOrigin(new AquaGolem('golem')),
            activeAtOrigin(new RootboundWarden('warden')),
            activeAtOrigin(new BriarMatron('matron')),
            activeAtOrigin(new RustboundColossus('colossus')),
            activeAtOrigin(new HollowSentinel('sentinel')),
            genericEnemy
        ];
        const questNpc = activeAtOrigin(new QuestNPC('quest-npc'));
        const seraph = activeAtOrigin(new AvengingSeraph('seraph'));
        const floatingSpawn = jest.fn();
        const gameEngine = {
            isMultiplayer: false,
            pendingInteraction: null,
            abilityController: { pendingAbilityTarget: null, pendingAbilitySkill: null },
            chunkManager: { getActiveEntities: jest.fn(() => [fighter, questNpc, seraph, ...enemies]) },
            floatingTextManager: { spawn: floatingSpawn },
            spawnTransientEffect: jest.fn(() => true),
            isPlayerClassEntity: (entity) => ['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name)
        };

        expect(fighter.useAbility(new THREE.Vector3(0, 0, 0), gameEngine, 'Guardian Roar')).toBeUndefined();

        for (const enemy of enemies) expect(enemy.guardianRoarTimer).toBe(0);
        expect(questNpc.guardianRoarTimer).toBe(10);
        expect(seraph.guardianRoarTimer).toBe(10);
        expect(floatingSpawn.mock.calls.filter(([text]) => text === 'Taunted!')).toHaveLength(enemies.length);
        expect(floatingSpawn.mock.calls.filter(([text]) => text === 'Protected')).toHaveLength(3);
    });
});
