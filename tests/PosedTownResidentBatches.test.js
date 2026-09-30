import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createProceduralTownResident } from '../src/art/ProceduralTownActors.js';
import { batchPosedTownResident } from '../src/art/PosedTownResidentBatches.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

function posed() {
    const root = createProceduralTownResident();
    root.position.set(4.3, 0, 2); root.rotation.y = -.7; root.scale.setScalar(.9);
    root.getObjectByName('Rig_UpperArmRight').rotation.x = -1.05;
    root.getObjectByName('Rig_ForearmRight').rotation.x = -.8;
    root.getObjectByName('Rig_Head').rotation.x = .15;
    return root;
}

test('posed residents retain every surface and motion pivot with fewer draws and owned resources', () => {
    const source = posed(), batched = posed(), originalGeometries = new Set();
    batched.traverse(part => { if (part.isMesh) originalGeometries.add(part.geometry); });
    const spies = new Map([...originalGeometries].map(g => [g, jest.spyOn(g, 'dispose')]));
    const forearm = batched.getObjectByName('Rig_ForearmRight'), head = batched.getObjectByName('Rig_Head');
    batchPosedTownResident(batched, [forearm, head]);
    const { sourceMeshes, drawMeshes } = batched.userData.posedResidentBatches;
    expect(drawMeshes).toBeLessThan(sourceMeshes / 2);
    expect(batched.getObjectByName('Rig_ForearmRight')).toBe(forearm);
    expect(batched.getObjectByName('Rig_Head')).toBe(head);
    for (const [armAngle, headAngle] of [[-.8, 0], [-.68, .08], [-.92, -.08]]) {
        for (const root of [source, batched]) {
            root.getObjectByName('Rig_ForearmRight').rotation.x = armAngle;
            root.getObjectByName('Rig_Head').rotation.y = headAngle;
            root.updateMatrixWorld(true);
        }
        const originals = new Set(); source.traverseVisible(part => { if (part.isMesh) originals.add(part); });
        let count = 0;
        batched.traverseVisible(mesh => {
            if (!mesh.isMesh) return;
            count++;
            if (!mesh.userData.townPoseSources) {
                const original = source.getObjectByName(mesh.name); originals.delete(original);
                expect(mesh.matrixWorld.elements).toEqual(original.matrixWorld.elements);
                expect([...mesh.geometry.attributes.position.array]).toEqual([...original.geometry.attributes.position.array]);
                return;
            }
            let offset = 0;
            for (const name of mesh.userData.townPoseSources) {
                const original = source.getObjectByName(name); expect(originals.delete(original)).toBe(true);
                expect(mesh.material.color).toEqual(original.material.color);
                expect(mesh.material.roughness).toBe(original.material.roughness);
                expect(mesh.castShadow).toBe(original.castShadow); expect(mesh.receiveShadow).toBe(original.receiveShadow);
                const a = original.geometry, b = mesh.geometry, vertices = a.index?.count || a.attributes.position.count;
                const originalNormals = new THREE.Matrix3().getNormalMatrix(original.matrixWorld);
                const normals = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
                for (let i = 0; i < vertices; i++, offset++) {
                    const index = a.index ? a.index.getX(i) : i;
                    const position = new THREE.Vector3().fromBufferAttribute(a.attributes.position, index).applyMatrix4(original.matrixWorld);
                    const bakedPosition = new THREE.Vector3().fromBufferAttribute(b.attributes.position, offset).applyMatrix4(mesh.matrixWorld);
                    expect(position.distanceTo(bakedPosition)).toBeLessThan(1e-5);
                    const normal = new THREE.Vector3().fromBufferAttribute(a.attributes.normal, index).applyNormalMatrix(originalNormals);
                    const bakedNormal = new THREE.Vector3().fromBufferAttribute(b.attributes.normal, offset).applyNormalMatrix(normals);
                    expect(normal.distanceTo(bakedNormal)).toBeLessThan(1e-5);
                    for (const axis of ['X', 'Y']) expect(b.attributes.uv[`get${axis}`](offset)).toBe(a.attributes.uv[`get${axis}`](index));
                }
            }
            expect(mesh.geometry.attributes.position.count).toBe(offset);
        });
        expect(originals.size).toBe(0); expect(count).toBe(drawMeshes);
    }
    const retained = new Set(); batched.traverse(part => { if (part.isMesh) retained.add(part.geometry); });
    for (const [geometry, spy] of spies) expect(spy).toHaveBeenCalledTimes(retained.has(geometry) ? 0 : 1);
    RenderSystem.prototype.disposeObjectResources.call({}, batched);
    for (const spy of spies.values()) expect(spy).toHaveBeenCalledTimes(1);
    RenderSystem.prototype.disposeObjectResources.call({}, source);
});

test('rejects player/service rigs instead of freezing their animation or equipment', () => {
    expect(() => batchPosedTownResident(new THREE.Group(), [])).toThrow('owned scenery residents');
});
