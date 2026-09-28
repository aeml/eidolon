import fs from 'node:fs';
import { AIR_HUNT_SECTORS, airQuestSearch } from '../src/data/airQuestSearch.js';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';
import { getOverworldRegion } from '../src/data/worldGeography.js';
import { getAtlasQuestLocations } from '../src/ui/AtlasQuestMarkers.js';
import { TOWN_SERVICE_POINTS } from '../src/ui/townServiceConfig.js';

const marker = quest => getAtlasQuestLocations({ player: { quests: [quest] }, currentInstanceType: 'overworld' })[0];
const active = (id, target, type = 'KILL') => ({ id, target, type, accepted: true, count: 0, maxCount: 8 });

test('Air search sectors agree with authoritative spawnAirArea bands', () => {
    const source = fs.readFileSync('server/internal/game/world.go', 'utf8');
    const airSource = source.slice(source.indexOf('func (w *World) spawnAirRealm()'));
    expect(airSource).toContain('minZ := -600.0 + 5.0');
    expect(airSource).toContain('maxZ := 1000.0 - 5.0');
    for (const [enemy, [minX, maxX]] of Object.entries(AIR_HUNT_SECTORS)) {
        expect(airSource).toContain(`spawnAirArea("${enemy}", ${minX - 5}.0+5.0, ${maxX + 5}.0-5.0,`);
        const point = airQuestSearch({ target: enemy });
        expect(point.area).toMatchObject({ minX, maxX, minZ: -595, maxZ: 995 });
        expect(getOverworldRegion(point.x, point.z)).toBe('air');
        expect(point.directions).toContain('not a safe path');
    }
});

test('the Thunder Roc hunt keeps its actual sector and distinguishes Tempest admission', () => {
    const hunt = chronicleHunts.find(q => q.id === 'chronicle_air_unstolen_hours');
    expect(hunt).toMatchObject({ enemy: 'ThunderRoc', minEnemyLevel: 80 });
    const point = airQuestSearch({ target: `ChronicleHunt:${hunt.id}` }, hunt);
    expect(point).toMatchObject({ x: 2000, z: 200 });
    expect(point.directions).toContain('Stay in the overworld');
    expect(point.directions).toContain('Tempest Spire is farther east');
});

test('Pinion collection starts with nearer Harpies and explains chance drops and pickup', () => {
    const point = airQuestSearch({ target: 'Stormglass Pinion' });
    expect(point).toMatchObject({ x: 1200, z: 200 });
    expect(point.directions).toContain('Storm Harpies');
    expect(point.directions).toContain('chance drops');
    expect(point.directions).toContain('pick up the dropped quest item');
    expect(airQuestSearch({ target: 'Zephyrion' })).toBeNull();
    expect(airQuestSearch({ target: 'AirCrystal' })).toBeNull();
    expect(airQuestSearch({ target: 'unknown' })).toBeNull();
});

test('runtime atlas preserves Air hunt levels, personal turn-ins and separate dungeon/raid destinations', () => {
    const quest = active('chronicle_air_unstolen_hours', 'ChronicleHunt:chronicle_air_unstolen_hours');
    expect(marker(quest)).toMatchObject({ x: 2000, z: 200 });
    expect(marker(quest).purpose).toContain('Thunder Roc enemies of level 80 or higher');
    expect(marker(quest).purpose).toContain('not a specific spawn');
    quest.count = quest.maxCount;
    const wizard = TOWN_SERVICE_POINTS.find(p => p.id === 'story-wizard');
    expect(marker(quest)).toMatchObject({ symbol: '?', x: wizard.x, z: wizard.z });
    expect(marker(active('chronicle_08_feathers_thunder', 'Stormglass Pinion', 'COLLECT'))).toMatchObject({ x: 1200, z: 200 });
    expect(marker(active('chronicle_09_sky_answers', 'Zephyrion'))).toMatchObject({ x: 2400, z: 200 });
    expect(marker(active('chronicle_13_skyglass_raid', 'AirCrystal', 'REPAIR')).name).toContain('Dungeon Guide');
});
