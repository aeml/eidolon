import * as THREE from 'three';
import { ActorInstanceBatches } from '../src/art/ActorInstanceBatches.js';

test('cell writer preserves every numeric float32 coefficient of the previous inverse/multiply path', () => {
    const instances = new ActorInstanceBatches(new THREE.Scene());
    const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 1);
    const inverse = new THREE.Matrix4(), reference = new THREE.Matrix4();
    const world = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    const cells = [-50048, -64, 0, 64, 20032];
    let checked = 0;
    try {
        for (const originX of cells) for (const originZ of cells) for (let i = 0; i < 128; i++) {
            rotation.setFromEuler(new THREE.Euler(i * .17, i * .31, i * -.13));
            world.compose(new THREE.Vector3(originX + (i - 64) * .00123, (i - 64) * .019, originZ - i * .00321),
                rotation, new THREE.Vector3(.1 + i / 20, .7 + i / 30, 2.1 + i / 40));
            inverse.makeTranslation(originX, 0, originZ).invert();
            reference.multiplyMatrices(inverse, world);
            const expected = new Float32Array(reference.elements);
            instances.writeCellMatrix(batch, 0, { matrixWorld: world }, originX, originZ);
            const actual = batch.instanceMatrix.array;
            for (let e = 0; e < 16; e++) {
                // IEEE signed zeros may differ; all numeric values must match
                // exactly, with no position/normal tolerance.
                expect(actual[e] === expected[e]).toBe(true);
                checked++;
            }
        }
        expect(checked).toBe(51200);
    } finally { instances.dispose(); batch.dispose(); batch.geometry.dispose(); batch.material.dispose(); }
});

test.each([-32.00001, -32, -31.99999, 31.99999, 32, 32.00001, 50031.99999])(
    'filtered first leaf retains the original cell origin at %s', x => {
        const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
        const root = new THREE.Group(); root.userData.proceduralHumanoid = true;
        const parts = [x, x + 3].map(position => {
            const mesh = new THREE.Mesh(geometry, material); mesh.position.set(position, .12345, -32.00001);
            root.add(mesh); return mesh;
        });
        scene.add(root); scene.updateMatrixWorld(true);
        const instances = new ActorInstanceBatches(scene);
        instances.viewFilter = { beginFrame() {}, rejects: part => part === parts[0] };
        try {
            instances.beginFrame();
            const batch = [...instances.batches.values()][0];
            expect(batch.count).toBe(1);
            expect(batch.matrixWorld.elements[12]).toBe(Math.floor((x + 32) / 64) * 64);
            expect(batch.matrixWorld.elements[14]).toBe(-64);
            const expected = new Float32Array(new THREE.Matrix4().copy(batch.matrixWorld).invert()
                .multiply(parts[1].matrixWorld).elements);
            expect([...batch.instanceMatrix.array.slice(0, 16)].every((value, index) => value === expected[index])).toBe(true);
            instances.endFrame();
            expect(parts.every(part => part.visible)).toBe(true);
        } finally { instances.dispose(); geometry.dispose(); material.dispose(); }
    });
