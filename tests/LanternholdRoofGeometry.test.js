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
