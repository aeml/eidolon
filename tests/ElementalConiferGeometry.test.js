import * as THREE from 'three';
import { createElementalConiferGeometry } from '../src/art/ElementalConiferGeometry.js';
import { getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';
import { computeFoliageCellBounds, getFoliageRenderBatches, updateFoliageRenderQuality } from '../src/art/FoliageRenderBatches.js';

test.each(['high', 'low'])('%s elemental boughs have finite folded sprays inside the old cone envelope', quality => {
    const first = createElementalConiferGeometry(quality), repeat = createElementalConiferGeometry(quality);
    try {
        expect(first.attributes.position.array).toEqual(repeat.attributes.position.array);
        expect(first.attributes.position.count / 3).toBe(quality === 'low' ? 120 : 240);
        expect(first.attributes.color.count).toBe(first.attributes.position.count);
        expect(first.userData.woodlandCrown).toBe('elemental-needle');
        const p = first.attributes.position, n = first.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            expect(Math.hypot(p.getX(i), p.getZ(i))).toBeLessThanOrEqual(1.7);
            expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(1.7);
            expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
        }
        expect(first.attributes.color.array.every(Number.isFinite)).toBe(true);
        expect(first.boundingBox.max.y - first.boundingBox.min.y).toBeGreaterThan(2.3);
    } finally { first.dispose(); repeat.dispose(); }
});

test('Low retains all120 High sprays and their unchanged tips, edges and roots', () => {
    const high = createElementalConiferGeometry(), low = createElementalConiferGeometry('low');
    try {
        for (let spray = 0; spray < 120; spray++) {
            for (const attribute of ['position', 'color']) {
                expect(Array.from(low.attributes[attribute].array.slice(spray * 9, spray * 9 + 9)))
                    .toEqual(Array.from(high.attributes[attribute].array.slice(spray * 18, spray * 18 + 9)));
            }
        }
    } finally { high.dispose(); low.dispose(); }
});

test.each(['rime_pine', 'gale_cypress'])('%s retains its original material batches and quality-switch identities', id => {
    const source = getProceduralFoliageArchetype(id);
    const high = getFoliageRenderBatches(id), low = getFoliageRenderBatches(id, 'low');
    expect(high.map(part => part.name)).toEqual(low.map(part => part.name));
    expect(high).toHaveLength(id === 'rime_pine' ? 4 : 3);
    const crowns = source.filter(part => part.geometry.userData.woodlandCrown === 'elemental-needle');
    expect(crowns).toHaveLength(id === 'rime_pine' ? 3 : 2);
    for (const crown of crowns) {
        expect(crown.material.transparent).toBe(false);
        expect(crown.material.vertexColors).toBe(true);
        expect(crown.material.side).toBe(THREE.DoubleSide);
        expect(crown.material.map).toBeNull();
        expect(crown.castShadow).toBe(true);
    }
    const triangles = parts => parts.reduce((sum, part) => sum +
        (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3, 0);
    expect(triangles(high) - triangles(low)).toBe(crowns.length * 120);
    expect(getFoliageRenderBatches(id)).toBe(high);
    expect(getFoliageRenderBatches(id, 'low')).toBe(low);
});

test('gale crowns and storm conductor follow the tilted trunk rather than floating to its opposite side', () => {
    const parts = getProceduralFoliageArchetype('gale_cypress');
    const stem = parts.find(part => part.name === 'wind-bent silver trunk');
    const origin = new THREE.Vector3().setFromMatrixPosition(stem.matrix);
    const direction = new THREE.Vector3(0, 1, 0).transformDirection(stem.matrix);
    for (const name of ['low leeward crown', 'high leeward crown', 'storm conductor']) {
        const center = new THREE.Vector3().setFromMatrixPosition(parts.find(part => part.name === name).matrix);
        const stemAtHeight = origin.clone().addScaledVector(direction, (center.y - origin.y) / direction.y);
        expect(Math.hypot(center.x - stemAtHeight.x, center.z - stemAtHeight.z)).toBeLessThan(.05);
    }
});

test.each(['rime_pine', 'gale_cypress'])('%s switches both directions without rebuilding instances or disposing shared art', id => {
    const group = new THREE.Group();
    group.userData = { proceduralFoliage: true, foliageId: id,
        region: id === 'rime_pine' ? 'water' : 'air', foliageQuality: 'high' };
    const high = getFoliageRenderBatches(id), low = getFoliageRenderBatches(id, 'low');
    const instances = high.map(part => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, 1);
        mesh.name = part.name; mesh.setMatrixAt(0, part.matrix); group.add(mesh);
        // Production construction prepares the bounds before a setting swap.
        // Unchanged bark/conductor batches must not need a rebuild to switch.
        computeFoliageCellBounds(mesh);
        return { mesh, buffer: mesh.instanceMatrix, material: mesh.material,
            matrix: mesh.instanceMatrix.array.slice(), geometry: mesh.geometry };
    });
    let disposals = 0;
    const onDispose = () => disposals++;
    for (const { geometry } of instances) geometry.addEventListener('dispose', onDispose);
    try {
        for (const [quality, expected] of [['low', low], ['high', high], ['low', low], ['high', high]]) {
            updateFoliageRenderQuality(group, quality);
            expect(group.userData.foliageQuality).toBe(quality);
            for (const original of instances) {
                const part = expected.find(part => part.name === original.mesh.name);
                expect(original.mesh.geometry).toBe(part.geometry);
                expect(original.mesh.instanceMatrix).toBe(original.buffer);
                expect(original.mesh.instanceMatrix.array).toEqual(original.matrix);
                expect(original.mesh.material).toBe(original.material);
                expect(original.mesh.boundingSphere.radius).toBeGreaterThan(0);
            }
        }
        expect(disposals).toBe(0);
    } finally {
        for (const { mesh, geometry } of instances) {
            geometry.removeEventListener('dispose', onDispose); mesh.dispose();
        }
    }
});
