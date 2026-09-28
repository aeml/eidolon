import fs from 'node:fs';
import { FIRE_HUNT_SECTORS, fireQuestSearch } from '../src/data/fireQuestSearch.js';
import { getAtlasQuestLocations } from '../src/ui/AtlasQuestMarkers.js';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';
import { getOverworldRegion } from '../src/data/worldGeography.js';
import { TOWN_SERVICE_POINTS } from '../src/ui/townServiceConfig.js';

const marker = quest => getAtlasQuestLocations({ player: { quests: [quest] }, currentInstanceType: 'overworld' })[0];
const active = (id, target, type = 'KILL') => ({ id, target, type, accepted: true, count: 0, maxCount: 8 });

test('Fire search sectors agree with authoritative spawnFireArea bands', () => {
    const source = fs.readFileSync('server/internal/game/world.go', 'utf8');
    for (const [enemy, [minX, maxX]] of Object.entries(FIRE_HUNT_SECTORS)) {
        expect(source).toContain(`spawnFireArea("${enemy}", ${minX - 5}.0+5.0, ${maxX + 5}.0-5.0,`);
        const point = fireQuestSearch({ target: enemy });
        expect(point.area).toMatchObject({ minX, maxX, minZ: -595, maxZ: 995 });
        expect(getOverworldRegion(point.x, point.z)).toBe('fire');
        expect(point.directions).toContain('not a safe path');
    }
    expect(source).toContain('minZ := -600.0 + 5.0');
    expect(source).toContain('maxZ := 1000.0 - 5.0');
});

test('the Magma hunt points before the Wraith sector and preserves manual turn-in', () => {
    const hunt = chronicleHunts.find(q => q.id === 'chronicle_fire_unending_war');
    const quest = active(hunt.id, `ChronicleHunt:${hunt.id}`), point = marker(quest);
    expect(point).toMatchObject({ x: -1600, z: 200 });
    expect(point.purpose).toContain('Magma Golem enemies of level 75 or higher');
    expect(point.purpose).toContain('not a specific spawn');
    expect(point.purpose).toContain('do not need to reach the Molten Core');
    quest.count = quest.maxCount;
    const wizard = TOWN_SERVICE_POINTS.find(p => p.id === 'story-wizard');
    expect(marker(quest)).toMatchObject({ symbol: '?', x: wizard.x, z: wizard.z });
});

test('Ore starts in the first Fire sector while the dungeon and crystal retain their admission points', () => {
    const ore = marker(active('chronicle_06_ash_refuses_cool', 'Cinderheart Ore', 'COLLECT'));
    expect(ore).toMatchObject({ x: -1200, z: 200 });
    expect(ore.purpose).toContain('chance drop'); expect(ore.purpose).toContain('pick up the dropped quest item');
    expect(ore.purpose).toContain('Watch for lava and hazard warnings');
    expect(marker(active('chronicle_07_crown_of_embers', 'LordInfernax'))).toMatchObject({ x: -2400, z: 200 });
    expect(marker(active('chronicle_12_ember_crown_raid', 'FireCrystal', 'REPAIR')).name).toContain('Dungeon Guide');
    expect(fireQuestSearch({ target: 'unknown' })).toBeNull();
});
