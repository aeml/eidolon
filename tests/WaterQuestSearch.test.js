import fs from 'node:fs';
import { WATER_HUNT_SECTORS, waterQuestSearch } from '../src/data/waterQuestSearch.js';
import { getAtlasQuestLocations } from '../src/ui/AtlasQuestMarkers.js';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';
import { getOverworldRegion } from '../src/data/worldGeography.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../src/data/dungeonEntrances.js';
import { TOWN_SERVICE_POINTS } from '../src/ui/townServiceConfig.js';

const marker = quest => getAtlasQuestLocations({ player: { quests: [quest] }, currentInstanceType: 'overworld' })[0];
const active = (id, target, type = 'KILL') => ({ id, target, type, accepted: true, count: 0, maxCount: 8 });

test('Water search areas match authoritative initial spawn bands', () => {
    const source = fs.readFileSync('server/internal/game/world.go', 'utf8');
    for (const [enemy, [minZ, maxZ]] of Object.entries(WATER_HUNT_SECTORS)) {
        const prefix = { MountainTroll: '', AquaGolem: 'ag', Siren: 'siren', FrostGuardian: 'fg' }[enemy];
        const minName = prefix ? `${prefix}MinZ` : 'minZ', maxName = prefix ? `${prefix}MaxZ` : 'maxZ';
        expect(source).toContain(`${minName} := ${minZ - 5}.0 + 5.0`);
        expect(source).toContain(`${maxName} := ${maxZ + 5}.0 - 5.0`);
        expect(source).toContain(`rollWorldPopulationSpawn(minX, maxX, ${minName}, ${maxName})`);
        const destination = waterQuestSearch({ target: enemy });
        expect(destination.area).toMatchObject({ minX: -995, maxX: 995, minZ, maxZ });
        expect(getOverworldRegion(destination.x, destination.z)).toBe('water');
    }
});

test.each(chronicleHunts.filter(h => h.huntingRealm === 'water'))('$id points to its own grounds, not the dungeon entrance', hunt => {
    const quest = active(hunt.id, `ChronicleHunt:${hunt.id}`);
    const destination = marker(quest), band = WATER_HUNT_SECTORS[hunt.enemy];
    expect(destination.z).toBe((band[0] + band[1]) / 2);
    expect(destination.purpose).toContain(`level ${hunt.minEnemyLevel} or higher`);
    expect(destination.purpose).toContain('not a specific spawn');
    expect(destination.z).not.toBe(DUNGEON_ENTRANCE_DEFINITIONS.abyssal_well.position[2]);
    quest.count = quest.maxCount;
    const wizard = TOWN_SERVICE_POINTS.find(p => p.id === 'story-wizard');
    expect(marker(quest)).toMatchObject({ symbol: '?', x: wizard.x, z: wizard.z });
});

test('Pearls guide to the first Water grounds; real dungeon and Earth transit hunts retain their destinations', () => {
    const pearl = marker(active('chronicle_04_pearls_without_tides', 'Moon-Tide Pearl', 'COLLECT'));
    expect(pearl.z).toBe(-800); expect(pearl.purpose).toContain('chance drops');
    expect(pearl.purpose).toContain('pick up the dropped quest item');
    expect(marker(active('chronicle_05_drowned_name', 'Thalorath'))).toMatchObject({ x: 0, z: -1400 });
    const ferry = chronicleHunts.find(h => h.id === 'chronicle_water_missing_ferry');
    expect(marker(active(ferry.id, `ChronicleHunt:${ferry.id}`))).toMatchObject({ x: -800, z: 200 });
    expect(waterQuestSearch({ target: 'unrecognized' })).toBeNull();
});
