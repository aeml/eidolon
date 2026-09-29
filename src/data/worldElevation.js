import { WORLD_ELEVATION } from './worldElevation.generated.js';
import { EARTH_OUTCROP_PROFILE } from './earthOutcrops.js';

const smooth = value => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

// This is an integration candidate, not a visual offset applied to live actors.
// Both runtimes sample the SAME triangulated surface, not a smooth function
// under a coarser rendered mesh. Heights are quantized to millimeters once.
export function createWorldElevationField(data) {
    const { minX, maxX, minZ, maxZ } = data.bounds;
    const columns = Math.ceil((maxX - minX) / data.spacing);
    const rows = Math.ceil((maxZ - minZ) / data.spacing);
    const stepX = (maxX - minX) / columns, stepZ = (maxZ - minZ) / rows;
    const heights = new Float64Array((columns + 1) * (rows + 1));
    let maxHeight = 0;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
        const x = minX + column * stepX, z = minZ + row * stepZ;
        let height = 0;
        for (const hill of data.hills) {
            const radiusSquared = ((x - hill.x) / hill.radiusX) ** 2 + ((z - hill.z) / hill.radiusZ) ** 2;
            if (radiusSquared < 1) height += hill.height * (1 - radiusSquared) ** 3;
        }
        let mask = smooth(Math.min(x - minX, maxX - x, z - minZ, maxZ - z) / data.edgeFade);
        const town = data.flatTown;
        const townDistance = Math.hypot(Math.max(town.minX - x, 0, x - town.maxX), Math.max(town.minZ - z, 0, z - town.maxZ));
        mask *= smooth(townDistance / data.padFade);
        for (const pad of data.pads) mask *= smooth((Math.hypot(x - pad.x, z - pad.z) - pad.radius) / data.padFade);
        height = Math.round(height * mask * 1000) / 1000;
        heights[row * (columns + 1) + column] = height;
        maxHeight = Math.max(maxHeight, height);
    }
    const vertexHeight = (column, row) => heights[row * (columns + 1) + column];
    const sample = (x, z, instanceId = '') => {
        if (instanceId || !Number.isFinite(x) || !Number.isFinite(z) || x < minX || x > maxX || z < minZ || z > maxZ) return 0;
        const gx = (x - minX) / stepX, gz = (z - minZ) / stepZ;
        const column = Math.min(columns - 1, Math.floor(gx)), row = Math.min(rows - 1, Math.floor(gz));
        const u = gx - column, v = gz - row;
        const a = vertexHeight(column, row), b = vertexHeight(column + 1, row);
        const c = vertexHeight(column, row + 1), d = vertexHeight(column + 1, row + 1);
        // PlaneGeometry's diagonal runs from top-right to bottom-left.
        return u + v <= 1 ? a + u * (b - a) + v * (c - a)
            : d + (1 - u) * (c - d) + (1 - v) * (b - d);
    };
    let maxGrade = 0;
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const a = vertexHeight(column, row), b = vertexHeight(column + 1, row);
        const c = vertexHeight(column, row + 1), d = vertexHeight(column + 1, row + 1);
        maxGrade = Math.max(maxGrade, Math.hypot((b - a) / stepX, (c - a) / stepZ),
            Math.hypot((d - c) / stepX, (d - b) / stepZ));
    }
    if (maxGrade > data.maxGrade) throw new Error(`World elevation grade ${maxGrade} exceeds ${data.maxGrade}`);
    return Object.freeze({ minX, maxX, minZ, maxZ, columns, rows, stepX, stepZ, maxHeight, maxGrade, vertexHeight, sample });
}

export const EARTH_ELEVATION = createWorldElevationField(WORLD_ELEVATION);

export function resolveWorldElevationProfile(profile = 'flat-v1') {
    if (!profile || profile === 'flat-v1') return null;
    if (profile === 'earth-elevation-v1' || profile === EARTH_OUTCROP_PROFILE) return EARTH_ELEVATION;
    throw new Error(`Unsupported server terrain profile: ${profile}. Reload the game client.`);
}

// Isometric camera rays are steeper than every terrain face. That gives one
// crossing and a bounded bracket; do not pretend this is a general horizontal
// projectile/line-of-sight raycaster. Instance owners supply their existing
// floor (not always zero: the casino VIP screen uses y=8).
export function intersectWorldElevationRay(ray, target, { instanceId = '', floorHeight = 0, field = EARTH_ELEVATION } = {}) {
    const { origin, direction } = ray;
    if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, floorHeight].every(Number.isFinite)) return null;
    if (instanceId) {
        if (Math.abs(direction.y) < 1e-8) return null;
        const t = (floorHeight - origin.y) / direction.y;
        return t >= 0 ? target.set(origin.x + direction.x * t, floorHeight, origin.z + direction.z * t) : null;
    }
    if (
        -direction.y <= field.maxGrade * Math.hypot(direction.x, direction.z) + 1e-8) return null;
    let near = Math.max(0, (origin.y - field.maxHeight) / -direction.y);
    let far = origin.y / -direction.y;
    if (far < near || origin.y < field.sample(origin.x, origin.z, instanceId)) return null;
    for (let i = 0; i < 32; i++) {
        const t = (near + far) / 2;
        const x = origin.x + direction.x * t, z = origin.z + direction.z * t;
        if (origin.y + direction.y * t > field.sample(x, z, instanceId)) near = t;
        else far = t;
    }
    const t = (near + far) / 2;
    return target.set(origin.x + direction.x * t, origin.y + direction.y * t, origin.z + direction.z * t);
}
