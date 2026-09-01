import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';
import { listPlayerAbilityPresentations } from '../src/skills/abilityVisualManifest.js';

function clip(name, duration = 0.25) {
    return new THREE.AnimationClip(name, duration, [
        new THREE.NumberKeyframeTrack('.position[x]', [0, duration], [0, 0.01])
    ]);
}

function animatedActor() {
    const actor = new Actor('animated-actor', {
        STATS: {
            STRENGTH: 5,
            INTELLIGENCE: 5,
            DEXTERITY: 6,
            WISDOM: 5,
            STAMINA: 5
        }
    });
    const mesh = new THREE.Group();
    mesh.userData.animations = [
        clip('Idle', 1),
        clip('Walk', 0.8),
        clip('Run', 0.6),
        clip('Attack', 0.2),
        clip('Jump', 0.5),
        clip('Death', 0.4)
    ];
    actor.setMesh(mesh);
    return actor;
}

describe('Actor animation state machine', () => {
    test('non-looping cast restores idle when stationary', () => {
        const actor = animatedActor();

        expect(actor.playAnimation('Attack', false, true)).toBe(true);
        actor.mixer.update(0.25);

        expect(actor.currentAnimationName).toBe('Idle');
        actor.dispose();
    });

    test('non-looping cast restores run rather than freezing while moving', () => {
        const actor = animatedActor();
        actor.state = 'MOVING';
        actor.targetPosition = new THREE.Vector3(5, 0, 0);

        actor.playAnimation('Attack', false, true);
        actor.mixer.update(0.25);

        expect(actor.currentAnimationName).toBe('Run');
        expect(actor.currentAction).toBe(actor.animations.Run);
        actor.dispose();
    });

    test('a committed cast cancels stale movement and interaction intent', () => {
        const actor = animatedActor();
        actor.meshType = 'Fighter';
        actor.abilityName = 'Charge';
        actor.state = 'MOVING';
        actor.targetPosition = new THREE.Vector3(5, 0, 0);
        const engine = {
            pendingInteraction: { id: 'old-target' },
            abilityController: {
                pendingAbilityTarget: { id: 'old-target' },
                pendingAbilitySkill: 'Charge'
            },
            spawnTransientEffect: () => true
        };

        expect(actor.useAbility(new THREE.Vector3(3, 0, 0), engine)).toBe(true);

        expect(actor.targetPosition).toBeNull();
        expect(actor.state).toBe('IDLE');
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.pendingAbilitySkill).toBeNull();
        expect(actor.currentAnimationName).toBe('Run');
        actor.dispose();
    });

    test('a moving self-cast preserves ordinary click-to-move locomotion', () => {
        const actor = animatedActor();
        actor.meshType = 'Cleric';
        actor.abilityName = 'Spirit Guardians';
        actor.state = 'MOVING';
        actor.targetPosition = new THREE.Vector3(12, 0, 0);
        actor.velocity.set(6, 0, 0);
        const movementTarget = actor.targetPosition;
        const engine = {
            pendingInteraction: null,
            abilityController: {
                pendingAbilityTarget: null,
                pendingAbilitySkill: null
            },
            spawnTransientEffect: () => true
        };

        expect(actor.useAbility(new THREE.Vector3(3, 0, 0), engine)).toBe(true);

        expect(actor.targetPosition).toBe(movementTarget);
        expect(actor.state).toBe('MOVING');
        expect(actor.velocity.x).toBe(6);
        expect(actor.currentAbilityAnimation?.skillName).toBe('Spirit Guardians');
        actor.update(1 / 60, null, null, null);
        expect(actor.position.x).toBeGreaterThan(0);
        actor.dispose();
    });

    test('idle reconciliation cannot replace an active local ability action', () => {
        const actor = animatedActor();
        actor.meshType = 'Fighter';

        expect(actor.playAbilityAnimation('Iron Fortress')).toBe(true);
        const abilityAction = actor.currentAction;
        actor.state = 'MOVING';
        actor.targetPosition = null;

        actor.update(1 / 60, null, null, null);

        expect(actor.state).toBe('IDLE');
        expect(actor.currentAnimationName).toBe('Attack');
        expect(actor.currentAction).toBe(abilityAction);
        expect(actor.currentAbilityAnimation?.skillName).toBe('Iron Fortress');

        actor.mixer.update(actor.currentAbilityAnimation.duration + 0.01);
        expect(actor.currentAnimationName).toBe('Idle');
        expect(actor.currentAbilityAnimation).toBeNull();
        actor.dispose();
    });

    test('replicated idle snapshots cannot replace an active remote ability action', () => {
        const actor = animatedActor();
        actor.meshType = 'Cleric';
        actor.isRemote = true;
        actor.state = 'IDLE';

        expect(actor.playAbilityAnimation('Spirit Guardians')).toBe(true);
        const abilityAction = actor.currentAction;

        actor.update(1 / 60, null, null, []);

        expect(actor.currentAnimationName).toBe('Attack');
        expect(actor.currentAction).toBe(abilityAction);
        expect(actor.currentAbilityAnimation?.skillName).toBe('Spirit Guardians');
        actor.dispose();
    });

    test('a remote cast received during mesh loading plays when the mixer becomes ready', () => {
        const actor = new Actor('loading-remote', {
            STATS: {
                STRENGTH: 5,
                INTELLIGENCE: 5,
                DEXTERITY: 6,
                WISDOM: 5,
                STAMINA: 5
            }
        });
        actor.meshType = 'Cleric';
        actor.isRemote = true;

        expect(actor.playAbilityAnimation('Spirit Guardians')).toBe(false);
        expect(actor.pendingRemoteAbilityAnimation).toEqual(expect.objectContaining({
            skillName: 'Spirit Guardians'
        }));

        const mesh = new THREE.Group();
        mesh.userData.animations = [
            clip('Idle', 1),
            clip('Walk', 0.8),
            clip('Run', 0.6),
            clip('Attack', 0.2),
            clip('Death', 0.4)
        ];
        actor.setMesh(mesh);

        expect(actor.pendingRemoteAbilityAnimation).toBeNull();
        expect(actor.currentAnimationName).toBe('Attack');
        expect(actor.currentAbilityAnimation?.skillName).toBe('Spirit Guardians');
        actor.dispose();
    });

    test('forced priority actions intentionally interrupt an active ability action', () => {
        const actor = animatedActor();
        actor.meshType = 'Fighter';

        actor.playAbilityAnimation('Iron Fortress');
        actor.playJumpAnimation({ duration: 0.8, visualProgress: 0 });

        expect(actor.currentAbilityAnimation).toBeNull();
        expect(actor.currentAnimationName).toBe('Jump');
        actor.dispose();
    });

    test('death animation cannot be overwritten by late movement or cast requests', () => {
        const actor = animatedActor();

        actor.die();
        expect(actor.currentAnimationName).toBe('Death');
        expect(actor.playAnimation('Run')).toBe(false);
        expect(actor.playAnimation('Attack', false, true)).toBe(false);
        expect(actor.currentAnimationName).toBe('Death');

        actor.dispose();
    });

    test('repeated state snapshots do not restart the current loop', () => {
        const actor = animatedActor();
        actor.playAnimation('Run');
        actor.currentAction.time = 0.31;

        actor.playAnimation('Run');

        expect(actor.currentAction.time).toBeCloseTo(0.31, 5);
        actor.dispose();
    });

    test('movement playback follows slow, normal, and haste speed', () => {
        const actor = animatedActor();
        actor.state = 'MOVING';
        actor.playAnimation('Run');

        expect(actor.getMovementAnimationTimeScale(3)).toBeCloseTo(0.5, 5);
        expect(actor.getMovementAnimationTimeScale(6)).toBeCloseTo(1, 5);
        expect(actor.getMovementAnimationTimeScale(9)).toBeCloseTo(1.5, 5);

        actor.slowTimer = 1;
        actor.slowFactor = 0.5;
        expect(actor.getMovementAnimationTimeScale(6)).toBeCloseTo(0.5, 5);

        actor.isMultiplayer = true;
        expect(actor.getMovementAnimationTimeScale(3)).toBeCloseTo(0.5, 5);
        actor.dispose();
    });

    test('an orphaned moving snapshot converges to idle instead of running in place', () => {
        const actor = animatedActor();
        actor.state = 'MOVING';
        actor.targetPosition = null;
        actor.velocity.set(2, 0, 0);
        actor.playAnimation('Run');

        actor.update(1 / 60, null, null, null);

        expect(actor.state).toBe('IDLE');
        expect(actor.currentAnimationName).toBe('Idle');
        expect(actor.velocity.lengthSq()).toBe(0);
        actor.dispose();
    });

    test('stun queues a destination without allowing predicted movement', () => {
        const actor = animatedActor();
        actor.stunTimer = 1;

        expect(actor.move(new THREE.Vector3(5, 0, 0))).toBe(false);
        expect(actor.targetPosition).toEqual(new THREE.Vector3(5, 0, 0));
        expect(actor.state).not.toBe('MOVING');
        actor.update(0.1, null, null, null);
        expect(actor.position.x).toBe(0);
        actor.dispose();
    });

    test('a dedicated Jump clip wins over locomotion fallback', () => {
        const actor = animatedActor();

        expect(actor.playJumpAnimation({ duration: 1, visualProgress: 0.4 })).toBe(true);

        expect(actor.currentAnimationName).toBe('Jump');
        expect(actor.jumpAnimationRestore?.name).toBe('Jump');
        expect(actor.currentAction.time).toBeCloseTo(0.2, 5);
        actor.dispose();
    });

    test('missing clips are explicit diagnostics instead of false success', () => {
        const actor = animatedActor();

        expect(actor.playAnimation('Stun')).toBe(false);
        expect(actor.missingAnimationClips).toContain('Stun');
        actor.dispose();
    });

    test('all playable classes scale locomotion clips with effective speed', () => {
        expect(new Fighter('fighter').scaleAnimSpeed).toBe(true);
        expect(new Rogue('rogue').scaleAnimSpeed).toBe(true);
        expect(new Wizard('wizard').scaleAnimSpeed).toBe(true);
        expect(new Cleric('cleric').scaleAnimSpeed).toBe(true);
    });

    test('every classified player ability resolves to a playable skeletal profile', () => {
        const actor = animatedActor();

        for (const ability of listPlayerAbilityPresentations()) {
            actor.meshType = ability.className;
            expect(actor.playAbilityAnimation(ability.skillName)).toBe(true);
            expect(['Attack', 'Run']).toContain(actor.currentAnimationName);
            expect(actor.currentAbilityAnimation).toEqual(expect.objectContaining({
                skillName: ability.skillName,
                duration: expect.any(Number)
            }));
        }

        expect(actor.missingAnimationClips).toEqual(new Set());
        actor.dispose();
    });
});
