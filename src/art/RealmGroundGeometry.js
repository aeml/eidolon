import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';

// Keep the shoreline inset behind fences, but carry the ground to the shared
// realm boundary at open gates. A shared wall may be owned by the other realm.
export function createRealmGroundGeometry(region, inset = 0.75) {
    const width = region.maxX - region.minX - inset * 2;
    const depth = region.maxZ - region.minZ - inset * 2;
    const centerX = (region.minX + region.maxX) / 2;
    const centerZ = (region.minZ + region.maxZ) / 2;
    const parts = [new THREE.PlaneGeometry(width, depth)];
    const seen = new Set();
    for (const owner of Object.values(WORLD_REGIONS)) for (const wall of owner.walls) {
        if (!wall.gap) continue;
        const vertical = wall.side === 'west' || wall.side === 'east';
        const at = vertical ? (wall.side === 'west' ? owner.minX : owner.maxX)
            : (wall.side === 'north' ? owner.minZ : owner.maxZ);
        const min = vertical ? region.minX : region.minZ;
        const max = vertical ? region.maxX : region.maxZ;
        if (at !== min && at !== max) continue;
        const lo = Math.max(wall.gap[0], (vertical ? region.minZ : region.minX) + inset);
        const hi = Math.min(wall.gap[1], (vertical ? region.maxZ : region.maxX) - inset);
        const key = `${vertical}:${at}:${lo}:${hi}`;
        if (lo >= hi || seen.has(key)) continue;
        seen.add(key);
        const middle = (lo + hi) / 2;
        const edgeCenter = at + (at === min ? inset / 2 : -inset / 2);
        const patch = new THREE.PlaneGeometry(vertical ? inset : hi - lo, vertical ? hi - lo : inset);
        patch.translate((vertical ? edgeCenter : middle) - centerX, centerZ - (vertical ? middle : edgeCenter), 0);
        parts.push(patch);
    }
    // Same UV origin/scale as the original rectangle, including normal and
    // roughness maps. Patches meet the inset edge; they do not overlay it.
    for (const part of parts) {
        const positions = part.getAttribute('position'), uv = part.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setXY(i,
            positions.getX(i) / width + 0.5, positions.getY(i) / depth + 0.5);
    }
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
