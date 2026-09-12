import * as THREE from 'three';
import { jest } from '@jest/globals';
import { WorldGenerator } from '../src/world/WorldGenerator.js';

function referenceFence(cx, cz, width, depth) {
    const group = new THREE.Group(), colliders = [];
    const post = new THREE.BoxGeometry(.8, 8, .8), rail = new THREE.BoxGeometry(4, .4, .2);
    const segment = (x, z, rotation) => {
        for (const [geometry, y] of [[post, 4], [rail, 2], [rail, 4], [rail, 6]]) {
            const mesh = new THREE.Mesh(geometry);
            mesh.position.set(x, y, z);
            if (geometry === rail) mesh.rotation.y = rotation;
            group.add(mesh);
        }
        colliders.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 4, z),
            new THREE.Vector3(rotation ? 1 : 4.5, 8, rotation ? 4.5 : 1)));
    };
    for (const z of [cz - depth / 2, cz + depth / 2]) {
        for (let x = cx - width / 2; x <= cx + width / 2; x += 4) {
            if (Math.abs(x - cx) >= 10) segment(x, z, 0);
        }
    }
    for (const x of [cx - width / 2, cx + width / 2]) {
        for (let z = cz - depth / 2; z <= cz + depth / 2; z += 4) {
            if (Math.abs(z - cz) >= 10) segment(x, z, Math.PI / 2);
        }
    }
    return { group, colliders };
}

// Compare the full indexed triangle stream in world space, not just a bound
// that could hide missing rails, changed normals, UVs or winding.
function triangles(group) {
    group.updateMatrixWorld(true);
    const result = [], point = new THREE.Vector3(), normal = new THREE.Vector3();
    group.traverse(mesh => {
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry, positions = geometry.attributes.position;
        const normals = geometry.attributes.normal, uv = geometry.attributes.uv;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        const count = geometry.index?.count ?? positions.count;
        for (let i = 0; i < count; i += 3) {
            const vertices = [];
            for (let j = 0; j < 3; j++) {
                const index = geometry.index ? geometry.index.getX(i + j) : i + j;
                point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
                normal.fromBufferAttribute(normals, index).applyNormalMatrix(normalMatrix);
                vertices.push([...point, ...normal, uv.getX(index), uv.getY(index)]
                    .map(value => Math.round(value * 10000) / 10000));
            }
            result.push(JSON.stringify(vertices));
        }
    });
    return result.sort();
}

test.each([[0, 200, 200, 200], [11, -19, 24, 36], [20000.25, 20000.5, 60, 80]])(
    'fence batching preserves every surface and collider at %s,%s (%s×%s)', (cx, cz, width, depth) => {
        const scene = new THREE.Scene(), collision = { addCollider: jest.fn() };
        new WorldGenerator(scene, collision).createRectangularFence(cx, cz, width, depth);
        const expected = referenceFence(cx, cz, width, depth), actual = scene.children[0];
        expect(triangles(actual)).toEqual(triangles(expected.group));
        expect(collision.addCollider.mock.calls.map(([box]) => box)).toEqual(expected.colliders);
        expect(actual.children.length).toBeLessThan(expected.group.children.length / 4);
        expect(new Set(actual.children.map(mesh => mesh.material)).size).toBe(1);
        for (const mesh of actual.children) {
            expect(mesh.geometry.boundingSphere).not.toBeNull();
            const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
            expect(size.x).toBeLessThanOrEqual(36.01);
            expect(size.z).toBeLessThanOrEqual(36.01);
            expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
        }
    });

test('town fence keeps four open gate corridors and greatly reduces renderable objects', () => {
    const scene = new THREE.Scene(), collision = { addCollider: jest.fn() };
    new WorldGenerator(scene, collision).createRectangularFence(0, 200, 200, 200);
    expect(scene.children[0].children.length).toBeLessThan(32);
    expect(collision.addCollider).toHaveBeenCalledTimes(184);
    for (const point of [[0, 4, 100], [0, 4, 300], [-100, 4, 200], [100, 4, 200]]) {
        expect(collision.addCollider.mock.calls.some(([box]) => box.containsPoint(new THREE.Vector3(...point)))).toBe(false);
    }
});
