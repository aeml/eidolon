import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorContactShadows } from '../src/core/ActorContactShadows.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

const isActor = entity => entity.actor === true;
function actor(scene, x = 0, y = 0) {
    const mesh = new THREE.Group(); scene.add(mesh); mesh.position.set(x, y, 0);
    mesh.userData.bounds = { radius: 1.25 };
    return { actor: true, mesh, position: new THREE.Vector3(x, y, 0), state: 'IDLE', isActive: true };
}

test('one unpickable batch follows interpolated bodies without changing their gameplay transforms', () => {
    const scene = new THREE.Scene(), contacts = new ActorContactShadows(scene);
    const a = actor(scene), b = actor(scene, 4);
    a.mesh.position.x = 1; b.mesh.scale.setScalar(2);
    contacts.update([a, b, { mesh: new THREE.Group() }], { enabled: true, isActor });
    expect(contacts.mesh.count).toBe(2);
    expect(contacts.mesh.geometry.index.count).toBe(6);
    expect(contacts.material.depthWrite).toBe(false);
    expect(contacts.mesh.castShadow).toBe(false);
    expect(contacts.mesh.raycast(new THREE.Raycaster(), [])).toBeUndefined();
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
    contacts.mesh.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([1, expect.closeTo(.12), 0]);
    contacts.mesh.getMatrixAt(1, matrix); scale.setFromMatrixScale(matrix);
    expect(scale.x).toBeCloseTo(2.25);
    expect(a.position.x).toBe(0); expect(a.mesh.position.x).toBe(1);
    expect(contacts.mesh.boundingSphere.radius).toBeGreaterThan(2);
    contacts.dispose();
});

test('jump contact remains on sloping ground and weakens with height; instance floors retain their own Y', () => {
    const scene = new THREE.Scene(), contacts = new ActorContactShadows(scene), a = actor(scene, 5, 8);
    const terrainElevation = { sample: x => 3 + x * .2 };
    contacts.update([a], { enabled: true, isActor, terrainElevation });
    const matrix = new THREE.Matrix4(); contacts.mesh.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).y).toBeCloseTo(4.12);
    expect(contacts.opacity.getX(0)).toBeCloseTo(.25);
    const normal = new THREE.Vector3(0, 1, 0).transformDirection(matrix);
    expect(normal.x).toBeLessThan(0); expect(normal.y).toBeGreaterThan(.9);
    contacts.update([a], { enabled: true, isActor });
    contacts.mesh.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).y).toBeCloseTo(8.12);
    expect(contacts.opacity.getX(0)).toBe(1);
    a.mesh.position.y = 16;
    contacts.update([a], { enabled: true, isActor });
    expect(contacts.mesh.visible).toBe(false);
    contacts.dispose();
});

test('hidden, departed, stealth, dead and seated actors leave no revealing or stale contact', () => {
    const scene = new THREE.Scene(), contacts = new ActorContactShadows(scene), a = actor(scene);
    for (const key of ['hidden', 'inactive', 'stealth', 'dead', 'seated', 'detached', 'hidden-parent']) {
        scene.add(a.mesh); scene.visible = true; a.mesh.visible = true;
        a.isActive = true; a.stealthTimer = 0; a.state = 'IDLE';
        if (key === 'hidden') a.mesh.visible = false;
        if (key === 'inactive') a.isActive = false;
        if (key === 'stealth') a.stealthTimer = 5;
        if (key === 'dead') a.state = 'DEAD';
        if (key === 'seated') a.state = 'SEATED';
        if (key === 'detached') a.mesh.removeFromParent();
        if (key === 'hidden-parent') scene.visible = false;
        contacts.update([a], { enabled: true, isActor });
        expect(contacts.mesh.count).toBe(0); expect(contacts.mesh.visible).toBe(false);
    }
    scene.visible = true; contacts.update([], { enabled: true, isActor });
    expect(contacts.mesh.count).toBe(0);
    contacts.dispose();
});

test('crowd growth releases old instance resources and teardown removes only its own decoration', () => {
    const scene = new THREE.Scene(), contacts = new ActorContactShadows(scene), a = actor(scene);
    contacts.update([a], { enabled: true, isActor });
    const first = contacts.mesh, firstMesh = jest.spyOn(first, 'dispose'), firstGeometry = jest.spyOn(first.geometry, 'dispose');
    const material = jest.spyOn(contacts.material, 'dispose');
    contacts.update(Array.from({ length: 40 }, (_, i) => actor(scene, i)), { enabled: true, isActor });
    expect(contacts.capacity).toBe(64); expect(contacts.mesh.count).toBe(40);
    expect(firstMesh).toHaveBeenCalledTimes(1); expect(firstGeometry).toHaveBeenCalledTimes(1);
    expect(material).not.toHaveBeenCalled(); expect(first.parent).toBeNull();
    const geometry = jest.spyOn(contacts.geometry, 'dispose');
    contacts.dispose(); expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
    expect(a.mesh.parent).toBe(scene);
});

test('production renderer enables the fallback only without shadows and clears on scene/quality transitions', () => {
    const render = new RenderSystem(false);
    try {
        const a = actor(render.scene);
        render.updateActorContactShadows([a], { isActor });
        expect(render.actorContactShadows).toBeUndefined();
        render.setGraphicsQuality('low'); render.updateActorContactShadows([a], { isActor });
        const contacts = render.actorContactShadows;
        expect(contacts.mesh.count).toBe(1);
        render.setGraphicsQuality('high'); expect(contacts.mesh.visible).toBe(false);
        render.setGraphicsQuality('low'); render.updateActorContactShadows([a], { isActor });
        expect(contacts.mesh.visible).toBe(true);
        render.clearInstanceScene(); expect(contacts.mesh.visible).toBe(false);
        expect(render.actorContactShadows).toBe(contacts);
        const release = jest.spyOn(contacts.material, 'dispose');
        render.dispose(); expect(release).toHaveBeenCalledTimes(1);
    } finally { if (render.actorContactShadows) render.dispose(); }
});
