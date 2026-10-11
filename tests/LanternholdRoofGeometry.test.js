import * as THREE from 'three';
import { createLappedSlateRoof } from '../src/art/LanternholdRoofGeometry.js';
import { createProceduralLanternholdStructure, getLanternholdWalkCollider } from '../src/art/ProceduralLanternholdArchitecture.js';

test.each([[19.2, Math.hypot(8.9, 4.4)], [13.1, Math.hypot(5.9, 3.25)], [13.5, Math.hypot(5.35, 3.25)], [2.2, Math.hypot(1.2, .8)]])(
    'slate slope %s × %s stays inside its former slab with bounded real detail', (width, length) => {
        const mesh = createLappedSlateRoof(width, length), positions = mesh.attributes.position;
        expect(mesh.groups).toHaveLength(0);
        expect(positions.count / 3).toBeLessThan(5000);
        for (let i = 0; i < positions.count; i++) {
            expect(Math.abs(positions.getX(i))).toBeLessThanOrEqual(width / 2 + 1e-6);
            expect(Math.abs(positions.getZ(i))).toBeLessThanOrEqual(length / 2 + 1e-6);
            expect(Math.abs(positions.getY(i))).toBeLessThan(.24);
        }
        expect(mesh.attributes.normal.array.every(Number.isFinite)).toBe(true);
        expect(new Set(mesh.attributes.color.array).size).toBeGreaterThan(10);
        expect(mesh.attributes.uv.count).toBe(positions.count);
        mesh.dispose();
    });

test.each(['oathhall', 'trading_house'])('%s dormers keep picking and walking contracts intact in production batches', id => {
    const source = createProceduralLanternholdStructure(id), batched = createProceduralLanternholdStructure(id, { optimized: true });
    const prefix = id === 'oathhall' ? 'oathhall' : 'compact';
    for (const side of [-1, 1]) expect(source.getObjectByName(`${prefix}:${side}:dormer-gable`)).toBeTruthy();
    expect(getLanternholdWalkCollider(batched).box.equals(getLanternholdWalkCollider(source).box)).toBe(true);
    const a = new THREE.Box3().setFromObject(source), b = new THREE.Box3().setFromObject(batched);
    expect(a.min.distanceTo(b.min)).toBeLessThan(.00001);
    expect(a.max.distanceTo(b.max)).toBeLessThan(.00001);
    expect(batched.userData.drawMeshCount).toBeLessThanOrEqual(10);
    let sourceTriangles = 0, batchTriangles = 0;
    for (const [model, count] of [[source, v => sourceTriangles += v], [batched, v => batchTriangles += v]]) {
        model.traverse(part => {
            if (part.isMesh && part.userData.proceduralTownPart) count((part.geometry.index?.count || part.geometry.attributes.position.count) / 3);
        });
    }
    expect(batchTriangles).toBe(sourceTriangles);
});

test.each([['oathhall', 'oathhall', 15.3, 11.55, 16.1],
    ['blacksmith', 'smithy', 11.8, 7, 9.8], ['trading_house', 'compact', 12.35, 6.75, 9.8]])(
    '%s roof ends close the space above both wall ends without adding material batches', (id, prefix, wallWidth, wallTop, ridge) => {
        const source = createProceduralLanternholdStructure(id);
        const batched = createProceduralLanternholdStructure(id, { optimized: true });
        source.updateMatrixWorld(true);
        const parts = [];
        source.traverse(part => { if (part.isMesh && part.userData.proceduralTownPart) parts.push(part); });
        for (const sign of [-1, 1]) for (const fraction of [.25, .7]) {
            const ray = new THREE.Raycaster(new THREE.Vector3(sign * (wallWidth / 2 + 1),
                wallTop + (ridge - wallTop) * fraction, 0), new THREE.Vector3(-sign, 0, 0));
            expect(ray.intersectObjects(parts, false)[0]?.object.name).toBe(`${prefix}:gable-infill:${sign}`);
        }
        const end = source.getObjectByName(`${prefix}:gable-infill:1`);
        expect(end.geometry.attributes.normal.array.every(Number.isFinite)).toBe(true);
        expect(end.geometry.attributes.uv.count).toBe(end.geometry.attributes.position.count);
        expect(end.material.userData.worldSurfaceDetail).toBe('weathered-masonry');
        const sourceMaterials = new Set(parts.map(part => part.material));
        const batchedMaterials = new Set(batched.children.filter(part => part.userData.proceduralTownPart).map(part => part.material));
        expect(batchedMaterials).toEqual(sourceMaterials);
        const a = getLanternholdWalkCollider(source), b = getLanternholdWalkCollider(batched);
        expect(a.box.equals(b.box)).toBe(true);
        expect(batched.userData.drawMeshCount).toBeLessThanOrEqual(10);
    });
