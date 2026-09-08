import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';
import { questMarkerState } from '../src/entities/QuestNPC.js';
import { ILYRA_REPLIES, getIlyraCompletionReply } from '../src/ui/QuestConversation.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';

const story = (overrides = {}) => ({ id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, title: 'The Bell That Rang Below', description: 'I need your help to save Eidolon.', lore: 'The covenant of the four spirits.', type: 'KILL', target: 'Skeleton', count: 0, maxCount: 3, rewardXP: 500, accepted: false, completed: false, ...overrides });
const daily = (overrides = {}) => ({ ...story(), id: 'daily_skeleton', category: 'daily', title: 'Daily Hunt', ...overrides });

beforeEach(() => {
    document.body.innerHTML = '<div id="quest-window"><div class="window-header"><span></span></div><div id="quest-list"></div></div><div id="quest-journal"><div id="journal-list"></div></div><div id="objectives-panel"><div class="objectives-panel__header"></div><div id="objectives-list"></div></div>';
});

test('wizard accepts and completes only by click, waits for acknowledgement, then holds authored dialogue', () => {
    const player = { quests: [story()], position: { x: 20, z: 200 }, level: 1 };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.questKind = 'story';
    ui.onAcceptQuest = jest.fn();
    ui.onCompleteQuest = jest.fn();
    ui.updateQuestWindow(player.quests);
    expect(document.body.textContent).toContain('ARCHMAGE ILYRA');
    expect(document.body.textContent).toContain('save Eidolon');
    document.querySelector('#quest-list button').click();
    expect(ui.onAcceptQuest).toHaveBeenCalledTimes(1);
    player.quests = [story({ accepted: true, count: 3 })];
    ui.updateQuestWindow(player.quests);
    expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Reward received');
    document.querySelector('#quest-list button').click();
    expect(ui.onCompleteQuest).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#quest-list button').disabled).toBe(true);
    player.quests = [story({ accepted: true, completed: true, count: 3 }), story({ id: 'chronicle_02_seeds_first_grove', chapter: 2, title: 'Seeds of the First Grove' })];
    ui.updateQuestWindow(player.quests);
    expect(document.body.textContent).toContain(ILYRA_REPLIES[0]);
    expect(document.body.textContent).toContain('Reward received · 500 XP');
    ui.updateQuestWindow(player.quests);
    expect(document.body.textContent).toContain(ILYRA_REPLIES[0]);
    document.querySelector('#quest-list button').click();
    expect(document.body.textContent).toContain('Seeds of the First Grove');
    expect(document.querySelector('#quest-list button').textContent).toBe('Accept Quest');
    expect(ui.onAcceptQuest).toHaveBeenCalledTimes(1);
});

test('markers prioritize ready turn-ins, separate story/dailies, and disappear when none are offered', () => {
    expect(questMarkerState([daily(), story()], false)).toBe('!');
    expect(questMarkerState([daily(), story()], true)).toBe('!');
    expect(questMarkerState([daily({ accepted: true, count: 3 }), daily({ id: 'daily_other' })])).toBe('?');
    expect(questMarkerState([story({ accepted: true, count: 3 })], true)).toBe('?');
    expect(questMarkerState([story({ accepted: true, count: 2 })], true)).toBe('');
    expect(questMarkerState([daily({ completed: true }), story({ accepted: true, count: 3 })])).toBe('');
});

test('reopening a conversation requests fresh state and unlocks a lost acknowledgement', () => {
    const player = { quests: [story()], position: { x: 20, z: 215 } };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.onRequestQuests = jest.fn();
    ui.pendingQuestAction = { quest: story(), complete: false };
    ui.closeQuestWindow();
    ui.toggleQuestWindow('story');
    expect(ui.onRequestQuests).toHaveBeenCalledTimes(1);
    expect(ui.pendingQuestAction).toBeNull();
    expect(document.querySelector('#quest-list button').disabled).toBe(false);
});

test('many accepted quests remain in the Journal but only three compact cards appear in tracker', () => {
    const player = { quests: [story({ accepted: true }), ...Array.from({ length: 26 }, (_, i) => daily({ id: `daily_${i}`, accepted: true }))], position: { x: 250, z: 200 } };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.updateJournal(player.quests);
    expect(document.querySelectorAll('#objectives-list .objective-entry')).toHaveLength(3);
    expect(document.querySelector('.objectives-panel__more').textContent).toContain('Choose tracked quests');
    const button = document.querySelector('.objectives-panel__more');
    ui.updateJournal(player.quests);
    expect(document.querySelector('.objectives-panel__more')).toBe(button);
    button.click();
    expect(ui.isJournalOpen).toBe(true);
    expect(document.querySelector('#journal-list').textContent.match(/Daily Hunt/g)).toHaveLength(26);
});

test('all fifteen chapters have distinct substantial completion dialogue', () => {
    expect(new Set(ILYRA_REPLIES).size).toBe(15);
    expect(ILYRA_REPLIES.every((reply) => reply.length > 180)).toBe(true);
});

test.each([
    ['chronicle_earth_keepers_house', 'Memory Seeds', 'chronicle_02_seeds_first_grove', 'The Scar That Grows Back'],
    ['chronicle_water_flood_shelter', 'Moon-Tide Pearls', 'chronicle_04_pearls_without_tides', 'A Reflection Out of Time'],
    ['chronicle_fire_cold_kiln', 'Cinderheart Ore', 'chronicle_06_ash_refuses_cool', 'An Ember That Obeys'],
    ['chronicle_air_weatherkeeper', 'Stormglass Pinions', 'chronicle_08_feathers_thunder', 'The Stolen Horizon']
])('fresh %s dialogue directs collection before its linked investigation', (diaryId, material, collectionId, nextTitle) => {
    const diary = chronicleInvestigations.find(chapter => chapter.id === diaryId);
    expect(diary.beforeQuestId).toBe(collectionId);
    const diaryHunt = chronicleHunts.find(hunt => hunt.previousQuestId === diaryId);
    const collectionHunt = chronicleHunts.find(hunt => hunt.previousQuestId === collectionId);
    if (diaryHunt) expect(getIlyraCompletionReply({ id: diaryId })).toBe(diaryHunt.handoff);
    else expect(getIlyraCompletionReply({ id: diaryId })).toContain(material);
    if (collectionHunt) expect(getIlyraCompletionReply({ id: collectionId })).toBe(collectionHunt.handoff);
    else expect(getIlyraCompletionReply({ id: collectionId })).toContain(nextTitle);
    // Veteran replies remain retrospective; missing lore must not demand
    // resubmitting already-consumed collection items.
    expect(getIlyraCompletionReply({ id: diaryId, legacyOptional: true })).toBe(diary.catchupCompletion);
});

test('completion dialogue follows stable quest identity after chapters are inserted', () => {
    expect(getIlyraCompletionReply(story({ chapter: 23 }))).toBe(ILYRA_REPLIES[0]);
    expect(getIlyraCompletionReply({ id: 'chronicle_15_dark_king', chapter: 23 })).toBe(ILYRA_REPLIES[14]);
    for (const investigation of chronicleInvestigations) {
        const nextHunt = chronicleHunts.find(hunt => hunt.previousQuestId === investigation.id);
        expect(getIlyraCompletionReply({ id: investigation.id, chapter: 2 })).toBe(nextHunt?.handoff || investigation.completion);
    }
    expect(getIlyraCompletionReply({ id: 'unknown', chapter: 1 })).not.toBe(ILYRA_REPLIES[0]);
});

test('investigation turn-in keeps its authored paragraphs and manual continuation', () => {
    const investigation = chronicleInvestigations[0];
    const quest = story({ id: investigation.id, chapter: 2, title: investigation.title, completed: true });
    const ui = new QuestUI({ getLastPlayer: () => ({ quests: [quest] }) });
    ui.questKind = 'story';
    ui.completedDialogue = quest;
    ui.updateQuestWindow([quest]);
    const paragraphs = [...document.querySelectorAll('.quest-dialogue__speech')].map(element => element.textContent);
    expect(paragraphs).toEqual(chronicleHunts[0].handoff.split(/\n\s*\n/));
    expect(document.querySelector('#quest-list button').textContent).toBe('Continue conversation');
    expect(ui.completedDialogue).toBe(quest);
});

test('Ilyra keeps the required chapter primary while offering earlier lore separately', () => {
    const chapter = chronicleInvestigations[0];
    const optional = story({ id: chapter.id, legacyOptional: true, type: 'INVESTIGATE', chapter: 2,
        title: chapter.title, lore: chapter.summary });
    const current = story({ id: 'chronicle_07_crown_of_embers', chapter: 13, title: 'The Crown of Embers' });
    const quests = [optional, current];
    const ui = new QuestUI({ getLastPlayer: () => ({ quests }) });
    ui.questKind = 'story';
    ui.updateQuestWindow(quests);
    expect(document.querySelector('.quest-dialogue h3').textContent).toBe(current.title);
    const choose = [...document.querySelectorAll('#quest-list button')].find(button => button.textContent === optional.title);
    choose.click();
    expect(document.querySelector('.quest-dialogue h3').textContent).toBe(optional.title);
    expect(document.querySelector('#quest-list').textContent).not.toContain(chapter.summary);
    [...document.querySelectorAll('#quest-list button')].find(button => button.textContent === 'Return to main story').click();
    expect(document.querySelector('.quest-dialogue h3').textContent).toBe(current.title);
});

test('future saved offers do not put an exclamation over an active required investigation', () => {
    const active = story({ id: 'chronicle_earth_keepers_house', chapter: 2, accepted: true, count: 0, maxCount: 1 });
    const future = story({ id: 'chronicle_02_seeds_first_grove', chapter: 3 });
    expect(questMarkerState([future, active], true)).toBe('');
    expect(questMarkerState([future, { ...active, count: 1 }], true)).toBe('?');
});

test.each([
    ['finished campaign', ['chronicle_15_dark_king'], 'Eidolon is free'],
    ['four repaired crystals', ['chronicle_10_rootheart_raid', 'chronicle_11_tidestar_raid',
        'chronicle_12_ember_crown_raid', 'chronicle_13_skyglass_raid'], 'four crystals sing again'],
    ['opened portal', ['chronicle_14_resonance_gate'], 'portal is open']
])('optional discoveries do not rewind Ilyra’s greeting after %s', (_label, completed, expected) => {
    const optional = story({ id: chronicleInvestigations[0].id, legacyOptional: true,
        type: 'INVESTIGATE', title: chronicleInvestigations[0].title });
    const quests = [...completed.map(id => story({ id, accepted: true, completed: true })), optional];
    const ui = new QuestUI({ getLastPlayer: () => ({ quests }) });
    ui.questKind = 'story';
    ui.updateQuestWindow(quests);
    const intro = document.querySelector('.quest-conversation__intro').textContent;
    expect(intro).toContain(expected);
    expect(intro).not.toContain('crystals cannot heal');
    expect(document.querySelector('#quest-list').textContent).toContain('Optional catch-up lore');
    expect(quests.at(-1).accepted).toBe(false);
});

test('unclaimed repair objectives and missing quest state do not announce a saved world', () => {
    for (const quests of [[], ['chronicle_10_rootheart_raid', 'chronicle_11_tidestar_raid',
        'chronicle_12_ember_crown_raid', 'chronicle_13_skyglass_raid'].map(id =>
        story({ id, accepted: true, count: 1, maxCount: 1, completed: false }))]) {
        const ui = new QuestUI({ getLastPlayer: () => ({ quests }) });
        ui.questKind = 'story';
        ui.updateQuestWindow(quests);
        expect(document.querySelector('.quest-conversation__intro').textContent).toContain('crystals cannot heal');
        expect(document.querySelector('#quest-list').textContent).not.toContain('crystals sing freely');
    }
});

test.each(chronicleInvestigations)('$id has deliberate retrospective catch-up dialogue without resetting its objectives', chapter => {
    expect(chapter.catchupAcceptance.length).toBeGreaterThan(150);
    expect(chapter.catchupCompletion.length).toBeGreaterThan(200);
    expect(chapter.catchupCompletion).not.toBe(chapter.completion);
    const quest = story({ id: chapter.id, legacyOptional: true, type: 'INVESTIGATE',
        title: chapter.title, description: chapter.acceptance, maxCount: chapter.sites.length });
    const ui = new QuestUI({ getLastPlayer: () => ({ quests: [quest] }) });
    ui.questKind = 'story';
    ui.updateQuestWindow([quest]);
    expect(document.querySelector('.quest-dialogue__speech').textContent).toBe(chapter.catchupAcceptance);
    expect(getIlyraCompletionReply(quest)).toBe(chapter.catchupCompletion);
    const nextHunt = chronicleHunts.find(hunt => hunt.previousQuestId === chapter.id);
    expect(getIlyraCompletionReply({ ...quest, legacyOptional: false })).toBe(nextHunt?.handoff || chapter.completion);
    expect(quest.accepted).toBe(false);
    expect(quest.completed).toBe(false);
    expect(quest.count).toBe(0);
});

test('optional hunt dialogue and journal identify an expedition without replacing the required story', () => {
    const hunt = chronicleHunts[0];
    const optional = story({ id: hunt.id, legacyOptional: true, chapter: 3, title: hunt.title,
        description: hunt.acceptance, count: 0, maxCount: hunt.count });
    const current = story({ id: 'chronicle_07_crown_of_embers', chapter: 21, title: 'The Crown of Embers' });
    const player = { quests: [optional, current], level: 70, position: { x: 20, z: 215 } };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.questKind = 'story';
    ui.selectedQuestId = hunt.id;
    ui.updateQuestWindow(player.quests);
    expect(document.querySelector('.quest-dialogue__eyebrow').textContent).toContain('OPTIONAL EXPEDITION');
    expect(document.querySelector('.quest-dialogue__speech').textContent).toBe(hunt.catchupAcceptance);
    ui.updateJournal(player.quests);
    expect(document.querySelector('.chronicle-journal').textContent).toContain('Optional earlier story chapters');
    expect(ui.buildObjectiveSummary(player.quests)[0].id).toBe(current.id);
    expect(optional.accepted).toBe(false);
});
