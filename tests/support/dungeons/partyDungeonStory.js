import { DUNGEON_PLAYTHROUGHS } from './dungeonPlaythroughCatalog.js';

export const PARTY_DUNGEON_CHAPTERS = Object.freeze({
    verdant_bastion_catacombs: 'chronicle_03_roots_remember',
    abyssal_well: 'chronicle_05_drowned_name',
    molten_core: 'chronicle_07_crown_of_embers',
    tempest_spire: 'chronicle_09_sky_answers',
    umbral_nexus: 'chronicle_14_resonance_gate'
});

// Prepared encounter context only, never an earned campaign receipt. Read the
// actual server catalog; seed prerequisites on newly registered isolated actors,
// leaving the dungeon objective uncleared and every later chapter unavailable.
export function partyDungeonStory(catalog, dungeonType) {
    const chapterId = PARTY_DUNGEON_CHAPTERS[dungeonType];
    const index = catalog?.findIndex(quest => quest.id === chapterId) ?? -1;
    if (!chapterId || index < 0 || !catalog[index + 1]?.id ||
        catalog[index].target !== DUNGEON_PLAYTHROUGHS[dungeonType].bosses.at(-1)) {
        throw new Error('Missing or mismatched dungeon story catalog');
    }
    return {
        chapterId, nextChapterId: catalog[index + 1].id,
        laterChapterId: catalog[index + 2]?.id,
        quests: catalog.slice(0, index + 1).map((quest, i) => ({
            id: quest.id, accepted: true, completed: i < index,
            count: i < index ? quest.maxCount : 0
        }))
    };
}
