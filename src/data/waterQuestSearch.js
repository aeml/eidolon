import { WORLD_REGIONS } from './worldGeography.js';

// Authored spawnSnowWorld bands, not live enemy positions. The five-metre
// margins match initial spawns; roaming/respawns are not promised here.
export const WATER_HUNT_SECTORS = Object.freeze({
    MountainTroll: [-995, -605], AquaGolem: [-1395, -1005],
    Siren: [-1795, -1405], FrostGuardian: [-2195, -1805]
});

export function waterQuestSearch(quest, hunt) {
    const collection = quest.target === 'Moon-Tide Pearl';
    const enemy = collection ? 'MountainTroll' : hunt?.enemy || quest.target;
    const sector = WATER_HUNT_SECTORS[enemy];
    if (!sector) return null;
    return {
        x: 0, z: (sector[0] + sector[1]) / 2,
        area: { ...WORLD_REGIONS.water, minX: -995, maxX: 995, minZ: sector[0], maxZ: sector[1] },
        directions: collection
            ? 'Begin with Mountain Trolls beyond Earth’s northern passage. Moon-Tide Pearls are chance drops from Water creatures: pick up the dropped quest item; not every kill yields one.'
            : enemy === 'MountainTroll'
                ? 'Cross Earth’s northern passage into Water and search the first snowfield. You do not need to reach the Abyssal Well for this hunt.'
                : enemy === 'AquaGolem'
                    ? 'Travel north through the first snowfield to the Aqua Golem grounds before the Abyssal Well. Stay in the overworld for this hunt.'
                    : 'Search the marked northern Water sector. Check enemy levels before leaving the southern snowfields.'
    };
}
