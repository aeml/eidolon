import * as THREE from 'three';
import { jest } from '@jest/globals';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { createLanternholdPerimeter } from '../src/art/LanternholdPerimeter.js';

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
        const cells = mesh.isBatchedMesh ? mesh.userData.perimeterCells : [null];
        for (const cell of cells) {
            const matrix = cell ? mesh.matrixWorld.clone().multiply(mesh.getMatrixAt(cell.instanceId, new THREE.Matrix4())) : mesh.matrixWorld;
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
            const range = cell ? mesh.getGeometryRangeAt(cell.geometryId) : { start: 0, count: geometry.index?.count ?? positions.count };
            for (let i = range.start; i < range.start + range.count; i += 3) {
                const vertices = [];
                for (let j = 0; j < 3; j++) {
                    const index = geometry.index ? geometry.index.getX(i + j) : i + j;
                    point.fromBufferAttribute(positions, index).applyMatrix4(matrix);
                    normal.fromBufferAttribute(normals, index).applyNormalMatrix(normalMatrix);
                    const color = geometry.attributes.color;
                    vertices.push([...point, ...normal, uv.getX(index), uv.getY(index),
                        color?.getX(index) ?? 1, color?.getY(index) ?? 1, color?.getZ(index) ?? 1]
                        .map(value => Math.round(value * 10000) / 10000));
                }
                result.push(JSON.stringify([mesh.material.name, vertices]));
            }
        }
    });
    return result.sort();
}

test.each([[0, 200, 200, 200], [11, -19, 24, 36], [20000.25, 20000.5, 60, 80]])(
    'new perimeter batching preserves its surfaces and legacy colliders at %s,%s (%s×%s)', (cx, cz, width, depth) => {
        const scene = new THREE.Scene(), collision = { addCollider: jest.fn() };
        new WorldGenerator(scene, collision).createRectangularFence(cx, cz, width, depth);
        const expected = referenceFence(cx, cz, width, depth), actual = scene.children[0];
        const unbatched = createLanternholdPerimeter(cx, cz, width, depth, { batched: false });
        expect(triangles(actual)).toEqual(triangles(unbatched));
        expect(collision.addCollider.mock.calls.map(([box]) => box)).toEqual(expected.colliders);
        expect(actual.children.length).toBeLessThan(unbatched.children.length / 4);
        expect(new Set(actual.children.map(mesh => mesh.material)).size).toBe(3);
        for (const mesh of actual.children) {
            expect(mesh.isBatchedMesh).toBe(true);
            expect(mesh.boundingSphere).not.toBeNull();
            expect(mesh.perObjectFrustumCulled).toBe(true);
            expect(mesh.instanceCount).toBe(mesh.userData.perimeterCells.length);
            for (const { geometryId } of mesh.userData.perimeterCells) {
                const size = mesh.getBoundingBoxAt(geometryId, new THREE.Box3()).getSize(new THREE.Vector3());
                expect(size.x).toBeLessThanOrEqual(36.01);
                expect(size.z).toBeLessThanOrEqual(36.01);
            }
            expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
        }
        const cellReference = createLanternholdPerimeter(cx, cz, width, depth, { multiDraw: false });
        expect(triangles(actual)).toEqual(triangles(cellReference));
    });

test('town fence keeps four open gate corridors and greatly reduces renderable objects', () => {
    const scene = new THREE.Scene(), collision = { addCollider: jest.fn() };
    new WorldGenerator(scene, collision).createRectangularFence(0, 200, 200, 200);
    expect(scene.children[0].children.length).toBeLessThan(64);
    expect(collision.addCollider).toHaveBeenCalledTimes(184);
    for (const point of [[0, 4, 100], [0, 4, 300], [-100, 4, 200], [100, 4, 200]]) {
        expect(collision.addCollider.mock.calls.some(([box]) => box.containsPoint(new THREE.Vector3(...point)))).toBe(false);
    }
});

test('perimeter has eight lit gateposts, split palings and braces within its unchanged wall envelope', () => {
    const root = createLanternholdPerimeter(0, 200, 200, 200, { batched: false });
    expect(root.userData.gatePosts).toBe(8);
    expect(root.children.filter(mesh => mesh.name === 'perimeter:gate-light')).toHaveLength(8);
    expect(root.children.filter(mesh => mesh.name === 'perimeter:split-paling')).toHaveLength(184 * 4);
    expect(root.children.filter(mesh => mesh.name === 'perimeter:diagonal-brace')).toHaveLength(184);
    const bounds = new THREE.Box3().setFromObject(root);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-.00001);
    expect(bounds.max.y).toBeLessThanOrEqual(8);
    const vertex = new THREE.Vector3();
    const envelopes = root.userData.walkColliders.map(box => box.clone().expandByScalar(.00001));
    root.updateMatrixWorld(true);
    for (const mesh of root.children) {
        expect(mesh.material.shadowSide).toBe(THREE.FrontSide);
        if (mesh.material.name.endsWith('timber')) {
            expect(mesh.material.userData.worldSurfaceDetail).toBe('timber');
            expect(mesh.geometry.attributes.color).toBeDefined();
        }
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            vertex.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld);
            if (!envelopes.some(box => box.containsPoint(vertex))) {
                throw new Error(`Fence escaped collision envelope: ${mesh.name} ${vertex.toArray()}`);
            }
        }
    }
});
