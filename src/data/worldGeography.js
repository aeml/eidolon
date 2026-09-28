import { WORLD_GEOGRAPHY } from './worldGeography.generated.js';

export { WORLD_GEOGRAPHY };
export const WORLD_REGIONS = Object.freeze(Object.fromEntries(WORLD_GEOGRAPHY.regions.map(r => [r.id, r])));

export function containsWorldPosition(region, x, z) {
    return Number.isFinite(x) && Number.isFinite(z) &&
        x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ;
}

// Safety is the actual town rectangle, not the renderer's ambient-light blend.
// Earth owns shared border coordinates, as in the shipped realm classification.
export function getOverworldRegion(x, z) {
    for (const id of ['town', 'earth', 'water', 'fire', 'air']) {
        if (containsWorldPosition(WORLD_REGIONS[id], x, z)) return id;
    }
    return null;
}

export function getRegionWallSegments(region) {
    return region.walls.flatMap(wall => {
        const vertical = wall.side === 'west' || wall.side === 'east';
        const min = vertical ? region.minZ : region.minX;
        const max = vertical ? region.maxZ : region.maxX;
        const fixed = vertical
            ? (wall.side === 'west' ? region.minX : region.maxX)
            : (wall.side === 'north' ? region.minZ : region.maxZ);
        const spans = wall.gap ? [[min, wall.gap[0]], [wall.gap[1], max]] : [[min, max]];
        return spans.map(([a, b]) => Object.freeze(vertical ? [fixed, a, fixed, b] : [a, fixed, b, fixed]));
    });
}

export const WORLD_BOUNDARY_SEGMENTS = Object.freeze(WORLD_GEOGRAPHY.regions.flatMap(getRegionWallSegments));
