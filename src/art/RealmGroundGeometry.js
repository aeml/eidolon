import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';

// Only exterior edges get a narrow footing beyond the fence centre. Shared
// realm borders meet exactly; town already sits on the larger Earth surface.
function footingBounds(region, inset) {
    const adjacent = (side, edge) => Object.values(WORLD_REGIONS).some(other => other.id !== region.id && other.id !== 'town' && (
        side === 'x'
            ? (other.minX === edge || other.maxX === edge) && Math.min(region.maxZ, other.maxZ) > Math.max(region.minZ, other.minZ)
            : (other.minZ === edge || other.maxZ === edge) && Math.min(region.maxX, other.maxX) > Math.max(region.minX, other.minX)));
    const margin = region.id === 'town' ? 0 : inset;
    return [region.minX - (adjacent('x', region.minX) ? 0 : margin),
        region.minZ - (adjacent('z', region.minZ) ? 0 : margin),
        region.maxX + (adjacent('x', region.maxX) ? 0 : margin),
        region.maxZ + (adjacent('z', region.maxZ) ? 0 : margin)];
}

// At concave world corners two exterior footings can touch the same small
// square. Keep one owner instead of overlapping coplanar realm materials.
function subtractRectangle(a, b) {
    const x0 = Math.max(a[0], b[0]), z0 = Math.max(a[1], b[1]);
    const x1 = Math.min(a[2], b[2]), z1 = Math.min(a[3], b[3]);
    if (x0 >= x1 || z0 >= z1) return [a];
    return [[a[0], a[1], x0, a[3]], [x1, a[1], a[2], a[3]],
        [x0, a[1], x1, z0], [x0, z1, x1, a[3]]].filter(r => r[0] < r[2] && r[1] < r[3]);
}

// Keep the canonical interior/elevation grid and UV scale, then cover its
// border up to every fence line. Leaving only gateway patches exposed the
// ocean beneath closed walls. Shared realms meet without overlapping ground.
export function createRealmGroundGeometry(region, inset = 0.75, elevation = null) {
    const width = region.maxX - region.minX - inset * 2;
    const depth = region.maxZ - region.minZ - inset * 2;
    const centerX = (region.minX + region.maxX) / 2;
    const centerZ = (region.minZ + region.maxZ) / 2;
    // Elevation is opt-in for the integration preview until ALL placement,
    // movement, effects and picking consumers use the shared height contract.
    if (elevation && (elevation.minX !== region.minX + inset || elevation.maxX !== region.maxX - inset ||
        elevation.minZ !== region.minZ + inset || elevation.maxZ !== region.maxZ - inset)) {
        throw new Error('Elevation field does not match realm ground bounds');
    }
    const surface = new THREE.PlaneGeometry(width, depth, elevation?.columns ?? 1, elevation?.rows ?? 1);
    if (elevation) {
        const positions = surface.getAttribute('position');
        for (let row = 0; row <= elevation.rows; row++) for (let column = 0; column <= elevation.columns; column++) {
            positions.setZ(row * (elevation.columns + 1) + column, elevation.vertexHeight(column, row));
        }
        surface.computeVertexNormals();
    }
    const parts = [surface];
    if (inset > 0) {
        const [x0, z0, x1, z1] = footingBounds(region, inset);
        const inner = [region.minX + inset, region.minZ + inset, region.maxX - inset, region.maxZ - inset];
        let borders = [[x0, z0, x1, inner[1]], [x0, inner[3], x1, z1],
            [x0, inner[1], inner[0], inner[3]], [inner[2], inner[1], x1, inner[3]]];
        for (const other of Object.values(WORLD_REGIONS)) {
            if (other.id === region.id) break;
            if (other.id === 'town' || region.id === 'town') continue;
            const prior = footingBounds(other, inset);
            borders = borders.flatMap(border => subtractRectangle(border, prior));
        }
        // Tile cuts match RealmGroundMesh's 128m grid, retaining compact bounds
        // for raised previews as well as the single flat production mesh.
        for (const [minX, minZ, maxX, maxZ] of borders) {
            for (let x = minX - centerX; x < maxX - centerX;) {
                const nextX = Math.min(maxX - centerX, (Math.floor(x / 128) + 1) * 128);
                for (let y = centerZ - maxZ; y < centerZ - minZ;) {
                    const nextY = Math.min(centerZ - minZ, (Math.floor(y / 128) + 1) * 128);
                    const patch = new THREE.PlaneGeometry(nextX - x, nextY - y);
                    patch.translate((x + nextX) / 2, (y + nextY) / 2, 0);
                    parts.push(patch); y = nextY;
                }
                x = nextX;
            }
        }
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
