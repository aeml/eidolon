import * as THREE from 'three';
import { computeFoliageCellBounds, getFoliageRenderBatches } from '../src/art/FoliageRenderBatches.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { PROCEDURAL_FOLIAGE_RECIPES, getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';
import { createLeafCanopyGeometry } from '../src/art/ProceduralLeafCanopy.js';
import { createConiferBoughGeometry } from '../src/art/ProceduralConiferBoughs.js';
import { createWillowCurtainGeometry } from '../src/art/WillowCurtainGeometry.js';

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
    expect(batches.length).toBeLessThanOrEqual(source.length);
    if (!source.some(part => part.geometry.userData.woodlandCrown)) expect(batches.length).toBeLessThan(source.length);
    expect(surfaceSignature(batches)).toEqual(surfaceSignature(source));
    expect(batches.every(part => part.geometry.boundingSphere.radius > 0)).toBe(true);
    for (const part of source) expect(part.matrix).toBeInstanceOf(THREE.Matrix4);
});

const triangles = parts => parts.reduce((sum, part) => sum + (part.geometry.index?.count || part.geometry.attributes.position.count) / 3, 0);

test.each(['high', 'low'])('%s woodland instances do not submit unsupported shear normal transforms', quality => {
    let shearedSource = 0;
    const columns = matrix => [0, 1, 2].map(index => new THREE.Vector3().setFromMatrixColumn(matrix, index).normalize());
    const shear = matrix => {
        const [x, y, z] = columns(matrix);
        return Math.max(Math.abs(x.dot(y)), Math.abs(x.dot(z)), Math.abs(y.dot(z)));
    };
    for (const id of ['ossuary_birch', 'grave_pine', 'mourning_willow']) {
        for (const part of getProceduralFoliageArchetype(id)) if (shear(part.matrix) > 1e-7) shearedSource++;
        for (const part of getFoliageRenderBatches(id, quality)) expect(shear(part.matrix)).toBeLessThan(1e-7);
    }
    expect(shearedSource).toBeGreaterThan(0);
});

test.each(['high', 'low'].flatMap(quality => ['ossuary_birch', 'grave_pine', 'mourning_willow'].map(id => [quality, id])))('%s %s crowns retain independent cullable geometry without losing a crown', (quality, id) => {
    const source = getProceduralFoliageArchetype(id);
    const leaves = source.filter(part => part.geometry.userData.woodlandCrown);
    const batches = getFoliageRenderBatches(id, quality);
    for (const leaf of leaves) {
        const candidate = batches.find(part => part.name === leaf.name);
        expect(candidate).toBeDefined();
        const sourceGeometry = quality === 'low' ? (leaf.geometry.userData.woodlandCrown === 'leaf'
            ? createLeafCanopyGeometry('low') : leaf.geometry.userData.woodlandCrown === 'willow'
                ? createWillowCurtainGeometry('low') : createConiferBoughGeometry('low')) : leaf.geometry;
        const expected = sourceGeometry.clone().applyMatrix4(leaf.matrix);
        const actual = candidate.geometry.clone();
        if (!candidate.matrix.equals(new THREE.Matrix4())) actual.applyMatrix4(candidate.matrix);
        expect(actual.attributes.position.array).toEqual(expected.attributes.position.array);
        expect(actual.attributes.normal.array).toEqual(expected.attributes.normal.array);
        expect(candidate.geometry.attributes.uv?.array).toEqual(sourceGeometry.attributes.uv?.array);
        expect(candidate.geometry.attributes.color.array).toEqual(sourceGeometry.attributes.color.array);
        expected.dispose(); actual.dispose();
        if (quality === 'low') sourceGeometry.dispose();
        expect(candidate.material).toBe(leaf.material);
        expect(candidate.castShadow).toBe(leaf.castShadow);
        expect(candidate.geometry.userData.woodlandCrown).toBe(leaf.geometry.userData.woodlandCrown);
    }
    expect(batches.filter(part => part.geometry.userData.woodlandCrown)).toHaveLength(leaves.length);
});

test.each(['high', 'low'])('%s cell spheres contain every transformed crown vertex without empty-box-corner inflation', quality => {
    let improved = 0;
    for (const id of ['ossuary_birch', 'grave_pine', 'mourning_willow']) {
        for (const part of getFoliageRenderBatches(id, quality)) for (const count of [1, 3]) {
            const mesh = new THREE.InstancedMesh(part.geometry, part.material, count);
            const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
            for (let i = 0; i < count; i++) mesh.setMatrixAt(i, new THREE.Matrix4().compose(
                new THREE.Vector3(20000.25 + i * 5, 3.7 + i, -19780.5 + i * 2),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .73 + i * .41, 0)),
                new THREE.Vector3(1.1, 1.2, .95)).multiply(part.matrix));
            const original = mesh.instanceMatrix.array.slice();
            mesh.computeBoundingBox();
            const box = mesh.boundingBox.clone(), oldRadius = box.getBoundingSphere(new THREE.Sphere()).radius;
            computeFoliageCellBounds(mesh);
            expect(box.clone().expandByScalar(.000001).containsBox(mesh.boundingBox)).toBe(true);
            expect(mesh.boundingSphere.radius).toBeLessThanOrEqual(oldRadius);
            if (mesh.boundingSphere.radius < oldRadius - .01) improved++;
            let escape = -Infinity, boxEscape = 0;
            for (let i = 0; i < count; i++) {
                mesh.getMatrixAt(i, matrix);
                for (let j = 0; j < part.geometry.attributes.position.count; j++) {
                    point.fromBufferAttribute(part.geometry.attributes.position, j).applyMatrix4(matrix);
                    boxEscape = Math.max(boxEscape, mesh.boundingBox.distanceToPoint(point));
                    escape = Math.max(escape, point.distanceTo(mesh.boundingSphere.center) - mesh.boundingSphere.radius);
                }
            }
            expect(escape).toBeLessThanOrEqual(.000001);
            expect(boxEscape).toBeLessThanOrEqual(.000001);
            expect(mesh.instanceMatrix.array).toEqual(original);
            mesh.dispose(); // shared source geometry/material are not owned
        }
    }
    expect(improved).toBeGreaterThan(0);
});

test('an empty foliage cell retains empty bounds without inventing a visible tree', () => {
    const part = getFoliageRenderBatches('grave_pine')[0];
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, 0);
    computeFoliageCellBounds(mesh);
    expect(mesh.boundingBox.isEmpty()).toBe(true);
    expect(mesh.boundingSphere.isEmpty()).toBe(true);
    mesh.dispose();
});

test('one-time foliage bounds use the actual transformed vertices, not an inflated source sphere', () => {
    const geometry = new THREE.TetrahedronGeometry(3), material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 2);
    try {
        mesh.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(-2, 1, 0),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(.4, .7, .2)), new THREE.Vector3(1.8, .7, 1.2)));
        mesh.setMatrixAt(1, new THREE.Matrix4().compose(new THREE.Vector3(3, 2, 1),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(.8, -.2, .6)), new THREE.Vector3(.8, 1.3, .6)));
        computeFoliageCellBounds(mesh);
        const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
        let exactRadius = 0;
        for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, matrix);
            for (let j = 0; j < geometry.attributes.position.count; j++) {
                point.fromBufferAttribute(geometry.attributes.position, j).applyMatrix4(matrix);
                exactRadius = Math.max(exactRadius, point.distanceTo(mesh.boundingSphere.center));
            }
        }
        expect(mesh.boundingSphere.radius).toBeCloseTo(exactRadius, 5);
    } finally { mesh.dispose(); geometry.dispose(); material.dispose(); }
});

test('one-time cell boxes exclude empty rotated source-box corners but contain every actual vertex', () => {
    const geometry = new THREE.TetrahedronGeometry(3), material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    try {
        mesh.setMatrixAt(0, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.4, .73, .2)));
        mesh.computeBoundingBox();
        const original = mesh.boundingBox.clone();
        const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), exact = new THREE.Box3();
        mesh.getMatrixAt(0, matrix);
        for (let i = 0; i < geometry.attributes.position.count; i++) {
            exact.expandByPoint(point.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(matrix));
        }
        computeFoliageCellBounds(mesh);
        expect(mesh.boundingBox.getSize(new THREE.Vector3()).length()).toBeLessThan(original.getSize(new THREE.Vector3()).length());
        expect(mesh.boundingBox.min.distanceTo(exact.min)).toBeLessThan(.00001);
        expect(mesh.boundingBox.max.distanceTo(exact.max)).toBeLessThan(.00001);
    } finally { mesh.dispose(); geometry.dispose(); material.dispose(); }
});

test('compound sheared transforms cannot clip actual foliage vertices', () => {
    const geometry = new THREE.SphereGeometry(1, 32, 16), material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 1), matrix = new THREE.Matrix4().makeShear(1, 0, 0, 0, 0, 0);
    try {
        mesh.setMatrixAt(0, matrix); computeFoliageCellBounds(mesh);
        const point = new THREE.Vector3(); let escape = -Infinity;
        for (let i = 0; i < geometry.attributes.position.count; i++) {
            point.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(matrix);
            escape = Math.max(escape, point.distanceTo(mesh.boundingSphere.center) - mesh.boundingSphere.radius);
        }
        expect(escape).toBeLessThanOrEqual(.000001);
    } finally { mesh.dispose(); geometry.dispose(); material.dispose(); }
});
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
