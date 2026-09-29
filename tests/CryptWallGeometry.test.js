import * as THREE from 'three';
import { createCryptWallGeometry } from '../src/art/CryptWallGeometry.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';

test.each([1, 5, 20, 122, 500])('crypt wall stays inside its exact existing collider envelope (%sm)', width => {
    const geometry = createCryptWallGeometry(width, 15, 2);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.toArray()).toEqual([-width / 2, -7.5, -1]);
    expect(geometry.boundingBox.max.toArray()).toEqual([width / 2, 7.5, 1]);
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    expect(p.count).toBeLessThan(20000);
    for (let i = 0; i < p.count; i++) {
        if (![p.getX(i), p.getY(i), p.getZ(i), uv.getX(i), uv.getY(i)].every(Number.isFinite)) throw new Error('invalid vertex');
        if (Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) > .0001) throw new Error('invalid normal');
    }
    if (geometry.userData.cryptWall) {
        expect(geometry.groups).toHaveLength(0);
        for (let i = 0; i < p.count; i += 3) {
            const area = (uv.getX(i+1)-uv.getX(i))*(uv.getY(i+2)-uv.getY(i))
                -(uv.getX(i+2)-uv.getX(i))*(uv.getY(i+1)-uv.getY(i));
            if (Math.abs(area) < 1e-12) throw new Error('collapsed surface mapping');
        }
    }
    geometry.dispose();
});

test('opaque wall detail is cached while foreground cutaways retain one simple box', () => {
    const kit = createProceduralDungeonInteriorKit('verdant_bastion_catacombs');
    const opaque = kit.wallGeometry(120, 15, 2), cutaway = kit.wallGeometry(120, 15, 2, true);
    expect(opaque).toBe(kit.wallGeometry(120, 15, 2));
    expect(opaque.userData.cryptWall).toBe(true);
    expect(cutaway).toBeInstanceOf(THREE.BoxGeometry);
    expect(kit.wallMaterial(120, 15, true).depthWrite).toBe(false);
});
