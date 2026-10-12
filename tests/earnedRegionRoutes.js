import { chronicleExpeditions } from '../src/data/chronicleExpeditions.generated.js';

// QA route selections only; objectives/rewards still come from the server and
// are earned through the existing normal-input helpers.
const regions = {
    water: {
        previous: 'chronicle_water_missing_ferry',
        investigation: 'chronicle_water_flood_shelter', hunt: 'chronicle_water_snow_debts',
        collection: 'chronicle_04_pearls_without_tides', item: 'Moon-Tide Pearl',
        reflection: 'chronicle_water_false_reflection', finalHunt: 'chronicle_water_unmastered_current',
        dungeon: 'chronicle_05_drowned_name', dungeonType: 'abyssal_well', level: 60
    },
    fire: {
        previous: 'chronicle_05_drowned_name',
        investigation: 'chronicle_fire_cold_kiln', hunt: 'chronicle_fire_unending_war',
        collection: 'chronicle_06_ash_refuses_cool', item: 'Cinderheart Ore',
        reflection: 'chronicle_fire_obedient_ember',
        dungeon: 'chronicle_07_crown_of_embers', dungeonType: 'molten_core', level: 70
    },
    air: {
        previous: 'chronicle_07_crown_of_embers',
        investigation: 'chronicle_air_weatherkeeper', hunt: 'chronicle_air_unstolen_hours',
        collection: 'chronicle_08_feathers_thunder', item: 'Stormglass Pinion',
        reflection: 'chronicle_air_stolen_horizon',
        dungeon: 'chronicle_09_sky_answers', dungeonType: 'tempest_spire', level: 70
    }
};

const baseOrder = ['chronicle_03_roots_remember', regions.water.previous];
for (const route of Object.values(regions)) {
    baseOrder.push(route.investigation, route.hunt, route.collection, route.reflection);
    if (route.finalHunt) baseOrder.push(route.finalHunt);
    baseOrder.push(route.dungeon);
}
baseOrder.push('chronicle_10_rootheart_raid', 'chronicle_11_tidestar_raid',
    'chronicle_12_ember_crown_raid', 'chronicle_13_skyglass_raid', 'chronicle_14_resonance_gate');
const before = new Map(chronicleExpeditions.map(q => [q.beforeQuestId, q.id]));
const order = [];
function insert(id) {
    if (before.has(id)) insert(before.get(id));
    order.push(id);
}
order.push(baseOrder[0]); // The saved Earth dungeon is this continuation's starting milestone.
baseOrder.slice(1).forEach(insert);

export function earnedRegionRoute(realm) {
    if (!Object.hasOwn(regions, realm)) throw new Error('Unknown earned story region');
    const route = regions[realm];
    return { ...route, steps: order.slice(order.indexOf(route.previous) + 1, order.indexOf(route.dungeon)) };
}

export function earnedRegionalDungeonRoute(dungeonType) {
    for (const [realm, route] of Object.entries(regions)) {
        if (route.dungeonType === dungeonType) return { ...earnedRegionRoute(realm), realm,
            prior: order.slice(0, order.indexOf(route.dungeon)) };
    }
    if (dungeonType === 'umbral_nexus') return {
        realm: 'dark', dungeonType, level: 100, dungeon: 'chronicle_14_resonance_gate',
        prior: order.slice(0, order.indexOf('chronicle_14_resonance_gate'))
    };
    throw new Error('Unknown earned regional dungeon');
}
