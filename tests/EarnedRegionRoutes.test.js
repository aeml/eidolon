import { readFileSync } from 'node:fs';
import { earnedRegionRoute } from './earnedRegionRoutes.js';
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

test.each(['earth', 'constructor', undefined])('rejects unsupported region %s', realm => {
    expect(() => earnedRegionRoute(realm)).toThrow('Unknown earned story region');
});
