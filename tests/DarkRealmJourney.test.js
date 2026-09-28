import { getAtlasLocations } from '../src/ui/AtlasNavigation.js';
import { getAtlasQuestLocations } from '../src/ui/AtlasQuestMarkers.js';
import { darkRealmChapters } from '../src/data/chronicleCatalog.js';
import { WORLD_LOCATIONS } from '../src/data/worldLocations.js';
import { DARK_REALM_WITNESSES } from '../src/data/darkRealmWitnesses.js';
import { darkRealmFixture } from './darkRealmFixture.js';

const game = quests => ({ currentInstanceId: 'dark-realm', currentInstanceType: 'dark_realm',
    currentDungeonLayout: darkRealmFixture(), player: { level: 100, quests } });
const quest = chapter => ({ id: chapter.id, title: chapter.title, category: 'chronicle',
    type: chapter.type, target: chapter.item || `DarkRealmHunt:${chapter.id}`,
    accepted: true, completed: false, count: 0, maxCount: chapter.count });

test('camp people remain searchable without a tracked quest and use canonical physical positions', () => {
    const engine = game([]), before = JSON.stringify(engine);
    const locations = getAtlasLocations(engine);
    const projection = WORLD_LOCATIONS.find(p => p.id === 'story-wizard-dark-realm');
    for (const person of [projection, ...DARK_REALM_WITNESSES.filter(p => ['dark-witness-maelin', 'dark-witness-ren'].includes(p.id))]) {
        expect(locations.find(p => p.id === person.id)).toMatchObject({ name: person.name, x: person.x, z: person.z,
            instanceId: 'dark-realm', category: 'services' });
    }
    const ilyra = locations.find(p => p.id === projection.id);
    expect(ilyra.purpose).toContain('click Complete Quest');
    expect(ilyra.purpose).toContain('Resonance XP; Gold is a separate reward');
    expect(locations.find(p => p.id === 'dark-witness-maelin').purpose).toContain('not a new quest giver');
    expect(locations.find(p => p.id === 'dark-witness-ren').purpose).toContain('no quest credit');
    expect(locations.find(p => p.id === 'district-0').purpose).toContain('inside the lantern circle');
    expect(locations.find(p => p.id === 'district-0').purpose).toContain('Return to Lanternhold');
    expect(locations.find(p => p.id === 'district-4').purpose).toContain('not a dungeon entrance');
    expect(JSON.stringify(engine)).toBe(before);
    engine.currentDungeonLayout = null;
    expect(getAtlasLocations(engine)).toEqual([]);
    engine.currentInstanceId = 'private-run'; engine.currentInstanceType = 'umbral_nexus';
    expect(getAtlasLocations(engine)).toEqual([]);
});

test.each(darkRealmChapters.filter(q => q.type !== 'INVESTIGATE').map(chapter => [chapter.id, chapter]))(
    '%s directs eligible kills or physical item pickup within its own district', (_id, chapter) => {
        const q = quest(chapter), engine = game([q]), marker = getAtlasQuestLocations(engine)[0];
        const index = ['unwritten_shore', 'tithe_of_names', 'stillwater_foundry', 'city_without_tomorrow'].indexOf(chapter.district) + 1;
        const room = engine.currentDungeonLayout.rooms[index];
        expect(marker).toMatchObject({ x: room.x, z: room.z, area: { minX: room.x - 250, maxX: room.x + 250,
            minZ: room.z - 250, maxZ: room.z + 250 } });
        expect(marker.purpose).toContain(chapter.enemy.replace(/([a-z\d])([A-Z])/g, '$1 $2'));
        expect(marker.purpose).toContain('not a safe path');
        expect(marker.purpose).toContain('click Complete Quest');
        expect(marker.purpose).not.toContain(chapter.completion);
        if (chapter.type === 'COLLECT') {
            expect(marker.purpose).toContain(chapter.item);
            expect(marker.purpose).toContain('chance drops');
            expect(marker.purpose).toContain('kills alone do not collect it');
        } else expect(marker.purpose).toContain('level-100-or-higher');
        q.objectiveText = 'Saved quest instructions';
        expect(getAtlasQuestLocations(engine)[0].purpose).toContain('Saved quest instructions');
        q.count = q.maxCount;
        expect(getAtlasQuestLocations(engine)[0]).toMatchObject({ x: 40012, z: 40800, symbol: '?' });
        q.completed = true;
        expect(getAtlasQuestLocations(engine)).toEqual([]);
    });
