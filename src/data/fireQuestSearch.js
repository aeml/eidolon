import { WORLD_REGIONS } from './worldGeography.js';

// Initial spawnFireArea bounds, with the server's five-metre margins. These
// are broad hunting grounds, never exact/live enemy positions or safe routes.
export const FIRE_HUNT_SECTORS = Object.freeze({
    SandstormDjinn: [-1395, -1005], MagmaGolem: [-1795, -1405],
    ScorchedWraith: [-2195, -1805], InfernalBehemoth: [-2595, -2205],
    PhoenixSentinel: [-2995, -2605]
});

export function fireQuestSearch(quest, hunt) {
    const collection = quest.target === 'Cinderheart Ore';
    const enemy = collection ? 'SandstormDjinn' : hunt?.enemy || quest.target;
    const sector = FIRE_HUNT_SECTORS[enemy];
    if (!sector) return null;
    const directions = collection
        ? 'Begin with creatures beyond Earth’s western passage into Fire. Cinderheart Ore is a chance drop: pick up the dropped quest item; not every kill yields one.'
        : enemy === 'MagmaGolem'
            ? 'Cross Earth’s western passage, then continue west beyond the Djinn grounds to the Magma Golem sector. You do not need to reach the Molten Core for this hunt.'
            : 'Search the marked Fire sector west of Earth. Stronger creatures live farther west.';
    return {
        x: (sector[0] + sector[1]) / 2, z: 200,
        area: { ...WORLD_REGIONS.fire, minX: sector[0], maxX: sector[1], minZ: -595, maxZ: 995 },
        directions: `${directions} Watch for lava and hazard warnings; the waypoint is not a safe path.`
    };
}
