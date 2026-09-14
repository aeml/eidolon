import { PARTY_DUNGEON_CHAPTERS, partyDungeonStory } from './partyDungeonStory.js';
import { DUNGEON_PLAYTHROUGHS } from './dungeonPlaythroughCatalog.js';

const catalog = Object.entries(PARTY_DUNGEON_CHAPTERS).flatMap(([type, id]) => [
    { id: `${id}_preceding`, target: 'Imp', maxCount: 40 },
    { id, target: DUNGEON_PLAYTHROUGHS[type].bosses.at(-1), maxCount: 1 }
]).concat([{ id: 'finale', target: 'UmbraPrime', maxCount: 1 }]);

test.each(Object.keys(PARTY_DUNGEON_CHAPTERS))('%s prepares only prerequisites and an uncleared target', type => {
    const original = JSON.stringify(catalog);
    const story = partyDungeonStory(catalog, type);
    const index = catalog.findIndex(q => q.id === story.chapterId);
    expect(story.quests).toHaveLength(index + 1);
    expect(story.quests.at(-1)).toEqual({ id: PARTY_DUNGEON_CHAPTERS[type], accepted: true, completed: false, count: 0 });
    expect(story.quests.slice(0, -1)).toEqual(catalog.slice(0, index).map(q => ({
        id: q.id, accepted: true, completed: true, count: q.maxCount
    })));
    expect(story.nextChapterId).toBe(catalog[index + 1].id);
    expect(story.quests.some(q => q.id === story.nextChapterId)).toBe(false);
    expect(JSON.stringify(catalog)).toBe(original);
});

test('unknown, missing, truncated and wrong-boss catalogs fail closed', () => {
    const type = 'abyssal_well';
    expect(() => partyDungeonStory(catalog, 'unknown')).toThrow();
    expect(() => partyDungeonStory(undefined, type)).toThrow();
    expect(() => partyDungeonStory([], type)).toThrow();
    expect(() => partyDungeonStory(catalog.slice(0, 4), type)).toThrow();
    expect(() => partyDungeonStory(catalog.map(q => ({ ...q, target: 'WrongBoss' })), type)).toThrow();
});
