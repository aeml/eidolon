import { WORLD_REGIONS } from './worldGeography.js';

// Search guidance, not spawn promises or quest eligibility. These sector edges
// mirror spawnEnemies in world.go; contract tests detect drift. Starter enemies
// are weaker near town, so the first hunt points beyond the level-one ward band.
export const EARTH_HUNT_SECTORS = Object.freeze({
    Skeleton: [-200, 200], Imp: [-600, -200], DemonOrc: [200, 600],
    Construct: [-1000, -600], InfernoTitan: [600, 1000]
});

export function earthQuestSearch(quest, hunt) {
    const realm = WORLD_REGIONS.earth;
    const enemy = hunt?.enemy || quest.target;
    const sector = EARTH_HUNT_SECTORS[enemy];
    if (!sector && quest.target !== 'Verdant Memory Seed') return null;
    const area = sector ? { ...realm, minX: sector[0], maxX: sector[1] } : realm;
    let x = sector ? (sector[0] + sector[1]) / 2 : 175, z = 200;
    if (enemy === 'Skeleton') {
        x = 175;
        if ((hunt?.minEnemyLevel || 0) >= 10) { x = 125; z = -150; }
    }
    if (quest.id === 'chronicle_01_bell_below') { x = 125; z = 180; }
    const directions = quest.target === 'Verdant Memory Seed'
        ? 'Begin with creatures beyond the east gate. Seeds are chance drops: collect the dropped quest item; not every kill yields one.'
        : enemy === 'Skeleton' ? (z < 0 ? 'Search north of town in the marked central Earth sector.'
            : 'Search beyond the east gate; enemies grow stronger farther from the town wards.')
            : x < 0 ? 'Leave by the west gate and search the marked Earth sector.'
                : 'Leave by the east gate and search the marked Earth sector.';
    return { x, z, area, directions };
}
