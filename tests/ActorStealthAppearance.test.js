import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Rogue } from '../src/entities/Rogue.js';

function fixture() {
    const actor = new Rogue('respawn-appearance');
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
    const glow = new THREE.Mesh(new THREE.SphereGeometry(.2), new THREE.MeshBasicMaterial({ transparent: true, opacity: .6 }));
    mesh.add(body, glow);
    actor.setMesh(mesh);
    return { actor, body, glow, hitbox: mesh.getObjectByName('ActorInteractionHitbox') };
}

test('dying and respawning without stealth never reveals the interaction box', () => {
    const { actor, glow, hitbox } = fixture();
    try {
        actor.die();
        actor.respawn(-1.25, 200);
        expect(hitbox.material.opacity).toBe(0);
        expect(hitbox.material.transparent).toBe(true);
        expect(hitbox.material.colorWrite).toBe(false);
        expect(glow.material.opacity).toBe(.6);
        expect(glow.material.transparent).toBe(true);
    } finally { actor.dispose(); }
});

test.each(['expiry', 'cancel', 'death', 'respawn', 'dispose'])('%s restores original materials after stealth', mode => {
    const { actor, body, glow, hitbox } = fixture();
    const original = body.material, translucent = glow.material;
    const originalDispose = jest.spyOn(original, 'dispose');
    actor.stealthTimer = 10;
    actor.update(.1, null, null, null);
    const copy = body.material;
    const copyDispose = jest.spyOn(copy, 'dispose');
    expect(copy).not.toBe(original);
    expect(copy.opacity).toBeCloseTo(.3);
    expect(glow.material.opacity).toBeCloseTo(.18);
    expect(original.opacity).toBe(1);
    expect(translucent.opacity).toBe(.6);
    expect(hitbox.material.opacity).toBe(0);
    actor.update(.1, null, null, null);
    expect(body.material).toBe(copy);
    if (mode === 'expiry') { actor.stealthTimer = .01; actor.update(.02, null, null, null); }
    if (mode === 'cancel') actor.cancelAbilities();
    if (mode === 'death') actor.die();
    if (mode === 'respawn') actor.respawn(-1.25, 200);
    if (mode === 'dispose') actor.dispose();
    expect(body.material).toBe(original);
    expect(glow.material).toBe(translucent);
    expect(hitbox.material.opacity).toBe(0);
    expect(copyDispose).toHaveBeenCalledTimes(1);
    expect(originalDispose).not.toHaveBeenCalled();
    if (mode !== 'dispose') actor.dispose();
});

test('material arrays, shared models, and replaced equipment retain their own appearance', () => {
    const { actor, body, glow } = fixture();
    const original = [body.material, glow.material];
    body.material = original;
    const bystander = new THREE.Mesh(body.geometry, original);
    actor.stealthTimer = 10;
    actor.update(.1, null, null, null);
    expect(bystander.material[0].opacity).toBe(1);
    expect(bystander.material[1].opacity).toBe(.6);
    const oldCopy = body.material[0];
    const dispose = jest.spyOn(oldCopy, 'dispose');
    actor.mesh.remove(body);
    actor.update(.1, null, null, null);
    expect(body.material).toBe(original);
    expect(dispose).toHaveBeenCalledTimes(1);
    actor.dispose();
});

test('invisible interaction volume remains raycastable after repeated respawns', () => {
    const { actor, hitbox } = fixture();
    try {
        for (let i = 0; i < 3; i++) { actor.die(); actor.respawn(0, 0); }
        actor.mesh.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 5), new THREE.Vector3(0, 0, -1));
        expect(ray.intersectObject(hitbox).length).toBeGreaterThan(0);
        expect(hitbox.material.opacity).toBe(0);
        expect(hitbox.material.colorWrite).toBe(false);
    } finally { actor.dispose(); }
});
