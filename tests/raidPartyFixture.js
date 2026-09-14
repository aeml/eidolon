import { partyDungeonCharacter } from './partyDungeonFixture.js';
import { PARTY_DUNGEON_CHAPTERS } from './partyDungeonStory.js';

export const RAID_PARTY_ROLES = Object.freeze(['Fighter', 'Cleric', 'Wizard', 'Rogue', 'Cleric']);

// Prepared encounter QA only. The five characters must still form/ready their
// raid, clear its rooms and guardian, and defend the complete crystal ritual.
// No cleared instance, repair receipt or later story chapter is prepared here.
export function raidPartyFixture(catalog, raidType, names) {
    const raid = catalog?.raids?.[raidType];
    const quests = catalog?.quests;
    const index = quests?.findIndex(q => q.id === raid?.RestoredQuest) ?? -1;
    const requiredDungeons = Object.entries(PARTY_DUNGEON_CHAPTERS)
        .filter(([type]) => type !== 'umbral_nexus').map(([, id]) => id);
    if (!raid || raid.Type !== raidType || index < 0 || !quests[index + 1]?.id ||
        quests[index].type !== 'REPAIR' || quests[index].target !== raid.RepairTarget ||
        quests[index].maxCount !== 1 || !Number.isInteger(raid.RequiredLevel) ||
        !requiredDungeons.includes(raid.RequiredDungeonQuest) ||
        requiredDungeons.some(id => !quests.slice(0, index).some(q => q.id === id)) ||
        !Number.isInteger(catalog.level) || catalog.level < Math.max(70, raid.RequiredLevel)) {
        throw new Error('Raid fixture requires the actual post-four-dungeon Vigil catalog and level');
    }
    if (!Array.isArray(names) || names.length !== 5 || new Set(names).size !== 5 ||
        names.some(name => typeof name !== 'string' || !name.trim())) {
        throw new Error('Raid fixture requires five distinct character names');
    }
    const prepared = quests.slice(0, index + 1).map((quest, i) => ({
        id: quest.id, accepted: true, completed: i < index,
        count: i < index ? quest.maxCount : 0
    }));
    const characters = RAID_PARTY_ROLES.map((role, i) => {
        const character = partyDungeonCharacter(catalog, prepared, role, names[i], 'progressed');
        // Repeated classes remain different owners with different item IDs.
        for (const [slot, item] of Object.entries(character.equipment)) {
            item.id = `raid-${i}-${slot}`;
            item.stats = { ...item.stats };
        }
        character.stats = { ...character.stats };
        return character;
    });
    return { raidType, chapterId: raid.RestoredQuest, nextChapterId: quests[index + 1].id,
        boss: raid.Boss, repairTarget: raid.RepairTarget, characters };
}
