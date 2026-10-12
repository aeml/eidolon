import { jest } from '@jest/globals';
import * as THREE from 'three';
import { createLanternholdNeighborhood } from '../src/art/LanternholdNeighborhood.js';
import { SceneryVisibility } from '../src/core/SceneryVisibility.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { CollisionManager } from '../src/core/CollisionManager.js';

test('exterior walking cutaway controls stay clear of actual world collisions', async () => {
    const group = new THREE.Group(), collision = new CollisionManager();
    try {
        await new WorldGenerator(group, collision).loadBuildings(0, 200);
        for (const [x, z] of [[-26, 269], [-82, 147], [66, 147], [-48, 114]]) {
            expect(collision.checkCollision(new THREE.Vector3(x, 0, z), 1.3)).toBeNull();
        }
        for (let i = 0; i <= 40; i++) {
            expect(collision.checkCollision(new THREE.Vector3(-34 + 8 * i / 40, 0, 260 + 9 * i / 40), 1.3)).toBeNull();
        }
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, group); }
});

test.each([['high', false], ['high', true], ['low', false], ['low', true]])('%s homes mode %s reveal the hero and restore all original materials', (quality, perInstanceFrustum) => {
    const root = createLanternholdNeighborhood(0, 200, { quality, perInstanceFrustum }), group = new THREE.Group(); group.add(root);
    const controller = new SceneryVisibility(), camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 2000);
    const focus = new THREE.Vector3(-26, 0, 269), geometries = root.children.map(m => m.geometry);
    const originals = root.children.map(m => m.material), foundation = root.children.find(m => m.name.endsWith(':stone'));
    const flags = root.children.map(m => [m.castShadow, m.receiveShadow]);
    const maps = [...new Set(root.children.flatMap(m => Object.values(m.material).filter(v => v?.isTexture)))];
    const mapRetirements = maps.map(map => jest.spyOn(map, 'dispose'));
    camera.position.copy(focus).add(new THREE.Vector3(100, 100, 100)); camera.lookAt(focus); camera.updateMatrixWorld(true);
    try {
        for (let i = 0; i < 90; i++) controller.update(group, camera, focus, i / 60);
        const entry = controller.entries.get(root);
        expect(entry.parts).toHaveLength(5); expect(entry.opacity).toBeLessThan(.005);
        expect(foundation.material).toBe(originals[root.children.indexOf(foundation)]);
        for (const part of entry.parts) {
            expect(part.mesh.material.transparent).toBe(false); expect(part.mesh.material.depthWrite).toBe(true);
            const shader = { ...THREE.ShaderLib.standard, uniforms: {} }; part.mesh.material.onBeforeCompile(shader, null);
            expect(shader.fragmentShader).toContain('if (sceneryCoverage < sceneryDither) discard;');
            if (part.material.userData.lanternholdTimberSurface) {
                expect(shader.uniforms.lanternholdTimberColor.value).toBe(part.material.lanternholdColorMap);
                expect(shader.fragmentShader).toContain('texture2D(lanternholdTimberColor, vLanternholdTimberUv)');
            }
        }
        expect(root.children.map(m => m.geometry)).toEqual(geometries);
        expect(root.children.map(m => [m.castShadow, m.receiveShadow])).toEqual(flags);
        const clones = [...entry.clones.values()].map(m => jest.spyOn(m, 'dispose'));
        focus.set(0, 0, 200);
        for (let i = 90; i < 240; i++) controller.update(group, camera, focus, i / 60);
        expect(entry.opacity).toBe(1); expect(root.children.map(m => m.material)).toEqual(originals);
        controller.clear(); controller.clear();
        expect(controller.entries.size).toBe(0); for (const dispose of clones) expect(dispose).toHaveBeenCalledTimes(1);
        for (const dispose of mapRetirements) expect(dispose).not.toHaveBeenCalled();
    } finally {
        controller.clear(); RenderSystem.prototype.disposeObjectResources.call({}, root);
        for (const dispose of mapRetirements) { expect(dispose).toHaveBeenCalledTimes(1); dispose.mockRestore(); }
    }
});
