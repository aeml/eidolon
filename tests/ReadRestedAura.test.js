import * as THREE from 'three';
import { runInNewContext } from 'node:vm';
import { readRestedAura, restedAuraMeetsBudget } from './restedAuraEvidence.js';
import { AttachedStatusEffect } from '../src/entities/AttachedStatusEffect.js';

test.each(['high', 'low'])('%s live observation reads the actual owner and visible scene hierarchy', quality => {
    const read = runInNewContext(`(${readRestedAura.toString()})`);
    const scene = new THREE.Scene(), effects = new THREE.Group(); scene.add(effects);
    const actor = { id: 'owner', mesh: new THREE.Group(), wellRestedSeconds: 60, state: 'IDLE', attachedStatusEffects: new Map() };
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    hitbox.name = 'ActorInteractionHitbox'; actor.mesh.add(hitbox); scene.add(actor.mesh);
    const aura = new AttachedStatusEffect(effects, actor, 'well_rested', { quality });
    actor.attachedStatusEffects.set('well_rested', aura);
    try {
        const observation = read(actor, scene);
        expect(restedAuraMeetsBudget(observation, quality)).toBe(true);
        expect(observation.visibleInScene).toBe(true); expect(observation.hitboxOpacity).toBe(0);
        effects.visible = false; expect(read(actor, scene).visibleInScene).toBe(false);
        effects.visible = true; scene.remove(effects); expect(read(actor, scene).visibleInScene).toBe(false);
        scene.add(effects); aura.dispose(); actor.attachedStatusEffects.clear(); actor.state = 'DEAD';
        expect(read(actor, scene)).toMatchObject({ state: 'DEAD', attached: false, visibleInScene: false, ownerGroups: 0, meshes: 0 });
    } finally { aura.dispose(); hitbox.geometry.dispose(); hitbox.material.dispose(); }
});

test('missing actors or scenes cannot be reported as visible auras', () => {
    expect(readRestedAura(null, new THREE.Scene()).visibleInScene).toBe(false);
    expect(readRestedAura({ attachedStatusEffects: new Map() }, null).visibleInScene).toBe(false);
});
