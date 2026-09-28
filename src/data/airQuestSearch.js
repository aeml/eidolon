import { WORLD_REGIONS } from './worldGeography.js';

// Initial spawnAirArea bands, including the server's five-metre margins.
// These are search grounds, not live enemy positions or guaranteed safe paths.
export const AIR_HUNT_SECTORS = Object.freeze({
    StormHarpy: [1005, 1395], CloudElemental: [1405, 1795],
    ThunderRoc: [1805, 2195], TempestGiant: [2205, 2595],
    CycloneAvatar: [2605, 2995]
});

export function airQuestSearch(quest, hunt) {
    const collection = quest.target === 'Stormglass Pinion';
    const enemy = collection ? 'StormHarpy' : hunt?.enemy || quest.target;
    const sector = AIR_HUNT_SECTORS[enemy];
    if (!sector) return null;
    const directions = collection
        ? 'Begin with Storm Harpies beyond Earth’s eastern passage into Air. Stormglass Pinions are chance drops from Air creatures: pick up the dropped quest item; not every kill yields one.'
        : enemy === 'ThunderRoc'
            ? 'Travel east beyond the Harpy and Cloud Elemental grounds to the Thunder Roc sector. Stay in the overworld for this hunt; Tempest Spire is farther east.'
            : 'Search the marked Air sector east of Earth. Stronger creatures live farther east.';
    return {
        x: (sector[0] + sector[1]) / 2, z: 200,
        area: { ...WORLD_REGIONS.air, minX: sector[0], maxX: sector[1], minZ: -595, maxZ: 995 },
        directions: `${directions} Watch for wind hazards; the waypoint is not a safe path.`
    };
}
