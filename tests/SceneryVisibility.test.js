import { jest } from '@jest/globals';
import * as THREE from 'three';
import { SceneryVisibility } from '../src/core/SceneryVisibility.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { createProceduralDungeonEntrance, DUNGEON_ENTRANCE_IDS } from '../src/art/ProceduralDungeonEntrances.js';

function scene(type = 'verdant_bastion_catacombs', focus = new THREE.Vector3(-10, 0, -10)) {
    const group = new THREE.Group(), root = createProceduralDungeonEntrance(type);
    group.add(root);
    const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 2000);
    camera.position.copy(focus).add(new THREE.Vector3(100, 100, 100));
    camera.lookAt(focus); camera.updateMatrixWorld(true);
    return { group, root, focus, camera, controller: new SceneryVisibility() };
}
function advance(s, start = 0, frames = 90) {
    for (let i = 0; i <= frames; i++) s.controller.update(s.group, s.camera, s.focus, start + i / 60);
}

test('the actual Verdant roof hides a hero outside the legacy circular collider', () => {
    const s = scene('verdant_bastion_catacombs', new THREE.Vector3(-36, 0, -30));
    expect(s.focus.length()).toBeGreaterThan(s.root.userData.interactionRadius + 1);
    const entry = s.controller.createEntry(s.root);
    expect(s.controller.blocksFocus(entry, s.camera, s.focus)).toBe(true);
    expect(entry.parts.every(part => part.material.opacity > 0)).toBe(true);
});

test.each(DUNGEON_ENTRANCE_IDS)('%s reveals an obscured hero without changing gameplay geometry', type => {
    const s = scene(type), boundsMesh = s.root.children.find(child => child.userData.gameplayBounds);
    const boundsMaterial = boundsMesh.material;
    const before = new THREE.Box3().setFromObject(s.root);
    const metadata = JSON.stringify(s.root.userData);
    advance(s);
    const entry = s.controller.entries.get(s.root);
    expect(entry.opacity).toBeLessThan(.01);
    expect(entry.clones.size).toBeGreaterThan(0);
    expect(entry.parts.every(part => part.mesh.material !== part.material && part.mesh.castShadow === part.castShadow)).toBe(true);
    expect(entry.parts.every(part => part.mesh.material.transparent === part.material.transparent &&
        part.mesh.material.depthWrite === part.material.depthWrite)).toBe(true);
    expect(new THREE.Box3().setFromObject(s.root).equals(before)).toBe(true);
    expect(JSON.stringify(s.root.userData)).toBe(metadata);
    expect(boundsMesh.material).toBe(boundsMaterial);
    expect(boundsMaterial.visible).toBe(false);
});

test('fading is smooth and does not mutate another entrance sharing cached materials', () => {
    const s = scene(), other = createProceduralDungeonEntrance('verdant_bastion_catacombs');
    other.position.x = 500; s.group.add(other);
    const original = other.children[0].material;
    expect(s.root.children[0].material).toBe(original);
    s.controller.update(s.group, s.camera, s.focus, 0);
    const entry = s.controller.entries.get(s.root);
    expect(entry.opacity).toBeLessThan(1); expect(entry.opacity).toBeGreaterThan(0);
    advance(s, 1 / 60);
    expect(other.children[0].material).toBe(original);
    expect(original.opacity).toBe(1); expect(original.transparent).toBe(false);
    const faded = entry.opacity;
    s.focus.set(200, 0, 200);
    s.controller.update(s.group, s.camera, s.focus, 1.56);
    expect(entry.opacity).toBeLessThanOrEqual(faded + .001);
    advance(s, 1.7, 120);
    expect(entry.opacity).toBe(1);
    expect(s.root.children[0].material).toBe(original);
});

test('landmarks behind the hero and unrelated dungeon architecture remain opaque', () => {
    const s = scene();
    s.root.position.set(-300, 0, -300);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshStandardMaterial());
    s.group.add(wall);
    advance(s);
    expect(s.controller.entries.get(s.root).opacity).toBe(1);
    expect(s.controller.entries.has(wall)).toBe(false);
    expect(wall.material.opacity).toBe(1);
});

test('the private shader cuts only a soft foreground window and retains material opacity outside it', () => {
    const s = scene(); advance(s);
    const entry = s.controller.entries.get(s.root), part = entry.parts[0];
    const shader = { uniforms: {}, fragmentShader: '#include <opaque_fragment>' };
    part.mesh.material.onBeforeCompile(shader, null);
    expect(part.mesh.material.opacity).toBe(part.material.opacity);
    expect(shader.uniforms.uSceneryReveal).toBe(entry.uniforms.reveal);
    expect(shader.uniforms.uSceneryReveal.value).toBeGreaterThan(.99);
    expect(shader.fragmentShader).toContain('smoothstep(3.2, 4.5, sceneryDistance)');
    expect(shader.fragmentShader).toContain('sceneryForeground');
    expect(shader.fragmentShader).toContain('discard;');
    expect(part.mesh.material.customProgramCacheKey()).toContain('hero-cutaway-v2');
});

test('removed roots restore shared resources and dispose only private fade materials', () => {
    const s = scene(); advance(s);
    const entry = s.controller.entries.get(s.root), original = entry.parts[0].material;
    const originalDispose = jest.spyOn(original, 'dispose');
    const clonedDisposers = [...entry.clones.values()].map(material => jest.spyOn(material, 'dispose'));
    s.group.remove(s.root);
    s.controller.update(s.group, s.camera, s.focus, 2);
    expect(s.controller.entries.size).toBe(0);
    expect(s.root.children[0].material).toBe(original);
    expect(originalDispose).not.toHaveBeenCalled();
    for (const dispose of clonedDisposers) expect(dispose).toHaveBeenCalledTimes(1);
    originalDispose.mockRestore();
});

test('losing the player restores scenery and scene teardown clears private materials', () => {
    const s = scene(); advance(s);
    s.focus = null; advance(s, 2, 120);
    expect(s.controller.entries.get(s.root).opacity).toBe(1);
    s.focus = new THREE.Vector3(-10, 0, -10); advance(s, 5);
    const render = Object.create(RenderSystem.prototype);
    render.instanceEnvironmentGroup = s.group; render.sceneryVisibility = s.controller;
    render.setSceneryFocus(s.focus);
    expect(render.sceneryFocus).not.toBe(s.focus);
    render.clearGroupChildren(s.group);
    expect(s.group.children).toHaveLength(0);
    expect(s.controller.entries.size).toBe(0);
    expect(render.sceneryFocus).toBeNull();
});
