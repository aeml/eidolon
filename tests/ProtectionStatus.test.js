import { jest } from '@jest/globals';
import * as THREE from 'three';
import { eidolon } from '../src/proto/state_pb.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Wizard } from '../src/entities/Wizard.js';

test.each([0, .5, 1, 1.2, 3])('protection protobuf preserves %s remaining seconds', duration => {
    const decoded = eidolon.state.Entity.decode(eidolon.state.Entity.encode({
        id: 'protected', invulnerableActive: duration > 0, invulnerableDuration: duration
    }).finish());
    expect(decoded.invulnerableActive).toBe(duration > 0);
    expect(decoded.invulnerableDuration).toBeCloseTo(duration, 6);
});

test('older packets never fabricate protection', () => {
    const decoded = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ id: 'legacy' }).finish());
    expect(decoded.invulnerableActive).toBe(false);
    expect(decoded.invulnerableDuration).toBe(0);
});

function fixture(quality) {
    const actor = new Wizard('protected');
    const scene = new THREE.Group();
    const engine = Object.assign(Object.create(GameEngine.prototype), {
        renderSystem: { effectGroup: scene, graphicsQuality: quality },
        showRemoteSupportStateReadability: jest.fn()
    });
    actor.gameEngine = engine;
    return { actor, engine, scene };
}

describe.each(['high', 'low'])('%s protection status', quality => {
    test('replicated activation, duration updates and explicit clear own exactly one effect', () => {
        const f = fixture(quality);
        try {
            f.engine.syncRemoteSupportEffects(f.actor, { invulnerableActive: true, invulnerableDuration: 1.2 });
            expect(f.actor.invulnerabilityTimer).toBe(1.2);
            const effect = f.actor.attachedStatusEffects.get('invulnerable');
            expect(effect?.isActive).toBe(true);
            expect(f.scene.children.length).toBe(1);
            let solidShells = 0;
            effect.group.traverse(part => {
                if (part.isMesh && ['BoxGeometry', 'SphereGeometry', 'IcosahedronGeometry'].includes(part.geometry.type)) solidShells++;
            });
            expect(solidShells).toBe(0);
            f.engine.syncRemoteSupportEffects(f.actor, { invulnerableDuration: .4 });
            expect(f.actor.invulnerabilityTimer).toBe(.4);
            expect(f.actor.attachedStatusEffects.get('invulnerable')).toBe(effect);
            f.engine.syncRemoteSupportEffects(f.actor, { invulnerableActive: false, invulnerableDuration: 0 });
            expect(f.scene.children.length).toBe(0);
            expect(effect.disposed).toBe(true);
        } finally { f.actor.dispose(); }
    });

    test('Protected entry counts down and death/respawn leave no persistent aura', () => {
        const f = fixture(quality);
        f.engine.player = f.actor;
        try {
            f.engine.syncPlayerSupportEffects(f.actor, { invulnerableActive: true, invulnerableDuration: 1.2 });
            expect(f.engine.getActiveBuffs().find(buff => buff.id === 'invulnerable'))
                .toMatchObject({ name: 'Protected', detail: 'Temporarily immune to damage' });
            f.actor.invulnerabilityTimer = .4;
            expect(f.engine.getActiveBuffs().find(buff => buff.id === 'invulnerable').durationSeconds).toBe(.4);
            f.actor.die();
            f.actor.respawn(1, 2);
            expect(f.actor.invulnerabilityTimer).toBe(0);
            expect(f.actor.invulnerableActive).toBe(false);
            expect(f.actor.attachedStatusEffects.has('invulnerable')).toBe(false);
            expect(f.engine.getActiveBuffs().some(buff => buff.id === 'invulnerable')).toBe(false);
        } finally { f.actor.dispose(); }
    });

    test('offline Phase owns a visible effect only while alive and protected', () => {
        const f = fixture(quality);
        try {
            f.actor.teleportPhaseTimer = 1;
            f.actor.syncAttachedStatusEffects();
            expect(f.actor.attachedStatusEffects.has('invulnerable')).toBe(true);
            f.actor.teleportPhaseTimer = 0;
            f.actor.syncAttachedStatusEffects();
            expect(f.scene.children.length).toBe(0);
            f.actor.teleportPhaseTimer = 1;
            f.actor.state = 'DEAD';
            f.actor.syncAttachedStatusEffects();
            expect(f.scene.children.length).toBe(0);
        } finally { f.actor.dispose(); }
    });

    test('display countdown expires while stunned without granting offline protection', () => {
        const f = fixture(quality);
        try {
            f.engine.syncPlayerSupportEffects(f.actor, { invulnerableActive: true, invulnerableDuration: .1 });
            f.actor.stunTimer = 1;
            const hp = f.actor.stats.hp;
            f.actor.takeDamage(1);
            expect(f.actor.stats.hp).toBe(hp - 1); // Replicated visual state cannot grant gameplay immunity.
            f.actor.update(.2, null, null, []);
            expect(f.actor.invulnerabilityTimer).toBe(0);
            expect(f.scene.children.length).toBe(1); // Stun only; protection is gone.
            expect(f.actor.attachedStatusEffects.has('invulnerable')).toBe(false);
        } finally { f.actor.dispose(); }
    });
});
