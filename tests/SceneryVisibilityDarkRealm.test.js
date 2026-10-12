import { jest } from '@jest/globals';
import * as THREE from 'three';
import { SceneryVisibility } from '../src/core/SceneryVisibility.js';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { darkRealmFixture } from './darkRealmFixture.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(['high', 'low'])('%s district cutaway reveals an occluded hero and preserves walk surfaces and shared maps', quality => {
    const group = new THREE.Group(), layout = darkRealmFixture();
    const root = createDarkRealmScene(group, layout, null, { quality });
    const controller = new SceneryVisibility(), camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 2000);
    const geometry = root.children.filter(n => n.isMesh).map(n => [n, n.geometry]);
    const metadata = JSON.stringify(root.userData), floors = root.children.filter(n => n.userData.walkSurface);
    const floorMaterials = floors.map(n => n.material), sourceMaterials = new Map(root.children.filter(n => n.isMesh).map(n => [n, n.material]));
    try {
        for (const room of layout.rooms.slice(1)) {
            // This point is inside the walk union and behind even the lowest
            // roof along the actual orthographic camera ray. The earlier
            // 12m-inset point only sits behind the tall city roof.
            const focus = new THREE.Vector3(room.x + room.width / 2 - 2, 0, room.z + 56);
            camera.position.copy(focus).add(new THREE.Vector3(100, 100, 100)); camera.lookAt(focus); camera.updateMatrixWorld(true);
            controller.clear();
            for (let frame = 0; frame < 90; frame++) controller.update(group, camera, focus, frame / 60);
            const entry = controller.entries.get(root);
            expect(entry.parts).toHaveLength(11); expect(entry.opacity).toBeLessThan(.005);
            expect(entry.masked).toBe(true);
            expect(entry.parts.every(p => p.mesh.geometry.getAttribute('sceneryOccluderMask').array.includes(1))).toBe(true);
            for (const floor of floors) expect(floor.material).toBe(floorMaterials[floors.indexOf(floor)]);
            for (const mesh of root.children.filter(n => n.isMesh && !n.userData.sceneryOccluderPart)) expect(mesh.material).toBe(sourceMaterials.get(mesh));
            const shared = entry.parts.filter(p => p.mesh.geometry.getAttribute('sceneryOccluderMask').array.includes(0));
            expect(shared).toHaveLength(2); // Bronze and shadow keep work/paving vertices solid.
            for (const part of shared) {
                const shader = { ...THREE.ShaderLib.standard, uniforms: {} };
                part.mesh.material.onBeforeCompile(shader, null);
                expect(shader.vertexShader).toContain('vSceneryOccluderMask = sceneryOccluderMask;');
                expect(shader.fragmentShader).toContain('sceneryForeground * vSceneryOccluderMask;');
                expect(part.mesh.material.customProgramCacheKey()).toContain('v3-masked');
            }
            const roof = entry.parts.find(p => p.material.userData.darkDistrictRoof);
            for (const key of ['map', 'normalMap', 'roughnessMap']) expect(roof.mesh.material[key]).toBe(roof.material[key]);
            for (const part of entry.parts) { expect(part.mesh.castShadow).toBe(part.castShadow); expect(part.mesh.material.transparent).toBe(false); }
            expect(root.children.filter(n => n.isMesh).map(n => [n, n.geometry])).toEqual(geometry);
            expect(JSON.stringify(root.userData)).toBe(metadata);
        }
        const entry = controller.entries.get(root), originals = [...new Set(entry.parts.map(p => p.material))];
        const originalDisposers = originals.map(m => jest.spyOn(m, 'dispose')), cloneDisposers = [...entry.clones.values()].map(m => jest.spyOn(m, 'dispose'));
        root.removeFromParent(); controller.update(group, camera, null, 3);
        expect(controller.entries.size).toBe(0);
        for (const [mesh, material] of sourceMaterials) expect(mesh.material).toBe(material);
        for (const dispose of originalDisposers) { expect(dispose).not.toHaveBeenCalled(); dispose.mockRestore(); }
        for (const dispose of cloneDisposers) expect(dispose).toHaveBeenCalledTimes(1);
    } finally { controller.clear(); RenderSystem.prototype.disposeObjectResources.call({}, root); }
});


test('shared work-surface triangles never trigger a building cutaway', () => {
    const group = new THREE.Group(), root = new THREE.Group();
    root.userData.sceneryOccluder = true; root.userData.sceneryOccluderMasked = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshStandardMaterial());
    mesh.userData.sceneryOccluderPart = true;
    mesh.geometry.setAttribute('sceneryOccluderMask', new THREE.Uint8BufferAttribute(new Uint8Array(mesh.geometry.attributes.position.count), 1));
    root.add(mesh); group.add(root);
    const controller = new SceneryVisibility(), focus = new THREE.Vector3(-10, 0, -10);
    const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 2000);
    camera.position.copy(focus).add(new THREE.Vector3(100, 100, 100)); camera.lookAt(focus); camera.updateMatrixWorld(true);
    const entry = controller.createEntry(root);
    try {
        expect(controller.blocksFocus(entry, camera, focus)).toBe(false);
        mesh.geometry.attributes.sceneryOccluderMask.array.fill(1);
        expect(controller.blocksFocus(entry, camera, focus)).toBe(true);
    } finally { controller.clear(); RenderSystem.prototype.disposeObjectResources.call({}, root); }
});
