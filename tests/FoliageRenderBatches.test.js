import * as THREE from 'three';
import { getFoliageRenderBatches } from '../src/art/FoliageRenderBatches.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { PROCEDURAL_FOLIAGE_RECIPES, getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';

function surfaceSignature(parts) {
    const surfaces = new Map();
    for (const part of parts) {
        const key = `${part.material.uuid}:${part.castShadow}:${part.receiveShadow}`;
        if (!surfaces.has(key)) surfaces.set(key, []);
        const list = surfaces.get(key), geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
        geometry.applyMatrix4(part.matrix);
        const p = geometry.attributes.position, n = geometry.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            list.push([p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)]
                .map(value => Math.round(value * 1e4)).join(','));
        }
        geometry.dispose();
    }
    return new Map([...surfaces].map(([key, values]) => [key, values.sort()]));
}

test.each(PROCEDURAL_FOLIAGE_RECIPES.map(recipe => recipe.id))('%s batching preserves every transformed surface and shadow/material assignment', id => {
    const source = getProceduralFoliageArchetype(id), batches = getFoliageRenderBatches(id);
    expect(getFoliageRenderBatches(id)).toBe(batches);
    expect(batches.length).toBeLessThan(source.length);
    expect(surfaceSignature(batches)).toEqual(surfaceSignature(source));
    expect(batches.every(part => part.geometry.boundingSphere.radius > 0)).toBe(true);
    for (const part of source) expect(part.matrix).toBeInstanceOf(THREE.Matrix4);
});

const triangles = parts => parts.reduce((sum, part) => sum + (part.geometry.index?.count || part.geometry.attributes.position.count) / 3, 0);
test.each(['ossuary_birch', 'grave_pine', 'mourning_willow'])('%s Low retains complete crowns and trunks with cheaper leaf surfaces', id => {
    const high = getFoliageRenderBatches(id), low = getFoliageRenderBatches(id, 'low');
    expect(getFoliageRenderBatches(id, 'medium')).toBe(high);
    expect(getFoliageRenderBatches(id, 'low')).toBe(low);
    expect(low.length).toBe(high.length);
    expect(triangles(low)).toBeLessThan(triangles(high) * .6);
    low.forEach((part, i) => {
        expect(part.material).toBe(high[i].material); expect(part.matrix).toEqual(high[i].matrix);
        expect([...part.geometry.attributes.position.array, ...part.geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        if (!part.material.vertexColors) expect(part.geometry).toBe(high[i].geometry);
        const a = part.geometry.boundingBox, b = high[i].geometry.boundingBox;
        for (const component of ['x', 'y', 'z']) {
            expect(Math.abs(a.min[component] - b.min[component])).toBeLessThan(.15);
            expect(Math.abs(a.max[component] - b.max[component])).toBeLessThan(.15);
        }
    });
});

test('production quality switches replace only foliage detail and preserve its instance transforms', () => {
    const render = new RenderSystem(false), id = 'mourning_willow';
    const group = new THREE.Group();
    group.userData = { proceduralFoliage: true, region: 'earth', foliageId: id, foliageQuality: 'high' };
    for (const part of getFoliageRenderBatches(id)) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, 1);
        mesh.name = part.name; mesh.setMatrixAt(0, part.matrix);
        mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
    }
    render.instanceEnvironmentGroup.add(group);
    const before = group.children.map(mesh => ({ geometry: mesh.geometry, matrix: Array.from(mesh.instanceMatrix.array) }));
    try {
        render.setGraphicsQuality('low');
        expect(group.userData.foliageQuality).toBe('low');
        expect(group.children.some((mesh, i) => mesh.geometry !== before[i].geometry)).toBe(true);
        group.children.forEach((mesh, i) => expect([...mesh.instanceMatrix.array]).toEqual(before[i].matrix));
        render.setGraphicsQuality('high');
        group.children.forEach((mesh, i) => expect(mesh.geometry).toBe(before[i].geometry));
    } finally {
        group.removeFromParent(); group.children.forEach(mesh => mesh.dispose()); render.dispose();
    }
});
