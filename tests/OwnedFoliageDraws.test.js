import * as THREE from 'three';
import { jest } from '@jest/globals';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { OwnedFoliageDraws, getOwnedFoliageDraws, hasOwnedFoliageDrawSort } from '../src/art/OwnedFoliageDraws.js';
import { updateFoliageRenderQuality } from '../src/art/FoliageRenderBatches.js';
import { FoliageShadowInfluence } from '../src/core/FoliageShadowInfluence.js';

async function fixture(quality) {
    const scene = new THREE.Scene(), collision = { addCollider: jest.fn() };
    const generator = new WorldGenerator(scene, collision, { graphicsQuality: quality });
    await generator.loadTrees(0, 200);
    const source = scene.children.filter(root => root.userData.proceduralFoliage);
    const camera = new THREE.OrthographicCamera(-25, 25, 25, -25, .1, 500);
    camera.position.set(390, 100, 173); camera.up.set(0, 0, -1); camera.lookAt(390, 0, 173); camera.updateMatrixWorld(true);
    const influence = new FoliageShadowInfluence();
    const owners = source.map(root => new OwnedFoliageDraws(root, influence, camera));
    return { scene, source, owners, camera, influence, collision };
}

test.each(['high', 'low'])('%s owned draws preserve every construction matrix and material while reducing live objects', async quality => {
    const s = await fixture(quality), matrix = new THREE.Matrix4();
    expect(s.owners).toHaveLength(9); expect(s.collision.addCollider).toHaveBeenCalled();
    let cells = 0, batches = 0;
    for (const owner of s.owners) {
        const originals = new Map(owner.source.children.map(cell => [cell.id, cell]));
        cells += originals.size; batches += owner.entries.length;
        for (const entry of owner.entries) {
            expect(hasOwnedFoliageDrawSort(entry.mesh)).toBe(true);
            const cursors = new Map();
            for (let i = 0; i < entry.owners.length; i++) {
                const cell = entry.cells[entry.owners[i]], original = originals.get(cell.id), cursor = cursors.get(original) || 0;
                entry.mesh.getMatrixAt(i, matrix);
                expect(matrix.elements).toEqual(Array.from(original.instanceMatrix.array.subarray(cursor * 16, (cursor + 1) * 16)));
                expect(entry.mesh.material).toBe(original.material);
                expect(entry.mesh.castShadow).toBe(original.castShadow);
                cursors.set(original, cursor + 1);
            }
            for (const [original, count] of cursors) expect(count).toBe(original.count);
        }
        owner.dispose(); owner.dispose();
        expect(owner.group.children).toHaveLength(0);
    }
    expect(cells).toBe(3146); expect(batches).toBeLessThan(40);
});

test('camera, moving parent, light and disabled influence retain original cell culling', async () => {
    const s = await fixture('high');
    const light = new THREE.DirectionalLight(); light.position.set(500, 500, 250); s.scene.add(light, light.target);
    const shadowCamera = new THREE.OrthographicCamera(-1000, 1000, 1000, -1000, .1, 3000);
    shadowCamera.position.set(500, 500, 250); shadowCamera.lookAt(0, 0, 0); shadowCamera.updateMatrixWorld(true);
    for (const [x, z, move, enabled] of [[390, 173, 0, true], [420, 190, 4, true], [370, 160, -3, false], [395, 175, 0, true]]) {
        s.camera.position.set(x, 100, z); s.camera.lookAt(x, 0, z); s.camera.updateMatrixWorld(true);
        light.position.x += 100;
        for (let i = 0; i < s.source.length; i++) {
            s.source[i].position.x = move; s.owners[i].group.position.x = move;
            s.owners[i].group.updateMatrixWorld(true);
        }
        s.scene.updateMatrixWorld(true); s.influence.enabled = enabled;
        s.influence.beginFrame(s.scene, s.camera, light);
        for (const camera of [s.camera, shadowCamera]) {
            const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
            for (const owner of s.owners) for (const entry of owner.entries) {
                const originals = new Map(owner.source.children.map(cell => [cell.id, cell]));
                const expected = entry.owners.map((cell, index) => ({ cell: originals.get(entry.cells[cell].id), index }))
                    .filter(({ cell }) => cell.visible && (camera === s.camera || cell.castShadow) &&
                        frustum.intersectsSphere(cell.boundingSphere.clone().applyMatrix4(cell.matrixWorld))).map(row => row.index).sort((a, b) => a - b);
                const list = entry.owners.map((_, index) => ({ index }));
                // Non-shadow-casting batches are not submitted to the shadow pass.
                if (camera !== s.camera && !entry.mesh.castShadow) continue;
                owner.sort(entry, list, camera);
                expect(list.map(row => row.index).sort((a, b) => a - b)).toEqual(expected);
            }
        }
        s.influence.endFrame();
    }
    s.owners.forEach(owner => owner.dispose()); s.influence.dispose();
});

test('quality rebuild preserves root identity, placement metadata and ownership while retiring old buffers once', async () => {
    const s = await fixture('high');
    for (const initial of s.owners) {
        const root = initial.group, placements = root.userData.placements, source = initial.source;
        root.position.set(3, 4, 5); root.visible = false;
        let owner = initial;
        for (const quality of ['low', 'high', 'low', 'high']) {
            const old = owner.entries.map(entry => entry.mesh), disposals = old.map(mesh => jest.spyOn(mesh.geometry, 'dispose'));
            updateFoliageRenderQuality(root, quality); owner = getOwnedFoliageDraws(root);
            expect(owner).not.toBe(initial); expect(owner.group).toBe(root); expect(owner.source).toBe(source);
            expect(root.userData.placements).toBe(placements); expect(root.userData.foliageQuality).toBe(quality);
            expect(root.position.toArray()).toEqual([3, 4, 5]); expect(root.visible).toBe(false);
            for (let i = 0; i < old.length; i++) { old[i].dispose(); expect(disposals[i]).toHaveBeenCalledTimes(1); }
            const current = owner;
            updateFoliageRenderQuality(root, quality); expect(getOwnedFoliageDraws(root)).toBe(current);
        }
        owner.dispose(); expect(getOwnedFoliageDraws(root)).toBeUndefined();
    }
});

test('world construction opt-in keeps every collider and source placement while fallback retains ordinary cells', async () => {
    const baseline = await fixture('high'), scene = new THREE.Scene(), collision = { addCollider: jest.fn() };
    const generator = new WorldGenerator(scene, collision, { graphicsQuality: 'high',
        ownedFoliageDraws: { influence: baseline.influence, camera: baseline.camera } });
    await generator.loadTrees(0, 200);
    const roots = scene.children.filter(root => root.userData.proceduralFoliage);
    expect(roots).toHaveLength(9);
    expect(collision.addCollider.mock.calls.map(([box]) => [box.min.toArray(), box.max.toArray()]))
        .toEqual(baseline.collision.addCollider.mock.calls.map(([box]) => [box.min.toArray(), box.max.toArray()]));
    for (let i = 0; i < roots.length; i++) {
        const owner = getOwnedFoliageDraws(roots[i]);
        expect(owner).toBeDefined(); expect(roots[i].userData.placements).toEqual(baseline.source[i].userData.placements);
        expect(baseline.source[i].children.every(mesh => mesh.isInstancedMesh)).toBe(true);
        expect(roots[i].children.every(mesh => mesh.isBatchedMesh)).toBe(true);
        owner.dispose(); baseline.owners[i].dispose();
    }
    const cancelled = new WorldGenerator(scene, collision, { ownedFoliageDraws: { influence: baseline.influence, camera: baseline.camera } });
    const count = scene.children.length;
    expect(await cancelled.loadTrees(0, 200, { shouldAttach: () => false })).toBe(false);
    expect(scene.children).toHaveLength(count);
});
