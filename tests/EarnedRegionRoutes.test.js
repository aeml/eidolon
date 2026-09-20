import { readFileSync } from 'node:fs';
import { earnedRegionRoute, earnedRegionalDungeonRoute } from './earnedRegionRoutes.js';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { DUNGEON_PLAYTHROUGHS } from './dungeonPlaythroughCatalog.js';

const quests = readFileSync(new URL('../server/internal/game/quests.go', import.meta.url), 'utf8');

test.each(['water', 'fire', 'air'])('%s continuation matches the authored investigations, hunt, collection and entry level', realm => {
    const route = earnedRegionRoute(realm);
    expect(chronicleInvestigations.find(q => q.id === route.investigation))
        .toMatchObject({ realm, beforeQuestId: route.collection });
    expect(chronicleHunts.find(q => q.id === route.hunt))
        .toMatchObject({ realm, beforeQuestId: route.collection, previousQuestId: route.investigation });
    expect(quests).toContain(`ID: "${route.collection}", Type: "COLLECT", Target: "${route.item}", MaxCount: 8`);
    expect(chronicleInvestigations.find(q => q.id === route.reflection))
        .toMatchObject({ realm, beforeQuestId: route.dungeon });
    expect(DUNGEON_PLAYTHROUGHS[route.dungeonType].level).toBe(route.level);
    if (route.finalHunt) expect(chronicleHunts.find(q => q.id === route.finalHunt))
        .toMatchObject({ realm, beforeQuestId: route.dungeon, previousQuestId: route.reflection });
});

test('later regions require the preceding dungeon, not a manufactured story handoff', () => {
    expect(earnedRegionRoute('fire').previous).toBe(earnedRegionRoute('water').dungeon);
    expect(earnedRegionRoute('air').previous).toBe(earnedRegionRoute('fire').dungeon);
});

test('later dungeon entry requires every earlier regional chapter, not only the most recent hunt', () => {
    const water = earnedRegionalDungeonRoute('abyssal_well');
    const fire = earnedRegionalDungeonRoute('molten_core');
    const air = earnedRegionalDungeonRoute('tempest_spire');
    expect(water.prior).toHaveLength(7);
    expect(water.prior).not.toContain(water.dungeon);
    expect(fire.prior).toEqual(expect.arrayContaining([...water.prior, water.dungeon,
        'chronicle_fire_cold_kiln', 'chronicle_fire_unending_war', 'chronicle_06_ash_refuses_cool',
        'chronicle_fire_obedient_ember']));
    expect(air.prior).toEqual(expect.arrayContaining([...fire.prior, fire.dungeon,
        'chronicle_air_weatherkeeper', 'chronicle_air_unstolen_hours', 'chronicle_08_feathers_thunder',
        'chronicle_air_stolen_horizon']));
    expect(air.prior).not.toContain(air.dungeon);
    expect(new Set(air.prior).size).toBe(air.prior.length);
    expect(() => earnedRegionalDungeonRoute('weekly_raid')).toThrow('Unknown earned regional dungeon');
});

test('earned Umbral entry requires all four dungeon handoffs and all four saved crystal restorations', () => {
    const air = earnedRegionalDungeonRoute('tempest_spire');
    const dark = earnedRegionalDungeonRoute('umbral_nexus');
    expect(dark).toMatchObject({ realm: 'dark', dungeonType: 'umbral_nexus', level: 100,
        dungeon: 'chronicle_14_resonance_gate' });
    expect(dark.level).toBe(DUNGEON_PLAYTHROUGHS.umbral_nexus.level);
    expect(dark.prior).toEqual([...air.prior, air.dungeon, 'chronicle_10_rootheart_raid',
        'chronicle_11_tidestar_raid', 'chronicle_12_ember_crown_raid', 'chronicle_13_skyglass_raid']);
    expect(dark.prior).not.toContain(dark.dungeon);
    expect(dark.prior).not.toContain('chronicle_15_dark_king');
    dark.prior.pop();
    expect(earnedRegionalDungeonRoute('umbral_nexus').prior.at(-1)).toBe('chronicle_13_skyglass_raid');
});

test.each(['earth', 'constructor', undefined])('rejects unsupported region %s', realm => {
    expect(() => earnedRegionRoute(realm)).toThrow('Unknown earned story region');
});
