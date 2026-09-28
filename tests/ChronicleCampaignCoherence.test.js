import { QuestUI } from '../src/ui/QuestUI.js';
import { PORTAL_DIRECTIONS } from '../src/data/worldLocations.js';
import { getChronicleRecap } from '../src/ui/ChronicleRecap.js';
import { darkRealmChapters } from '../src/data/chronicleCatalog.js';

function greeting(quests) {
    document.body.innerHTML = '<div id="quest-window"><div class="window-header"><span></span></div><div id="quest-list"></div></div>';
    const player = { id: 'reader', level: 100, position: { x: 20, z: 215 }, quests };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.questKind = 'story'; ui.updateQuestWindow(quests);
    return ui.questList.textContent;
}
const repairs = ['chronicle_10_rootheart_raid', 'chronicle_11_tidestar_raid', 'chronicle_12_ember_crown_raid', 'chronicle_13_skyglass_raid']
    .map(id => ({ id, completed: true, category: 'chronicle' }));

test('four repair receipts still direct the first expedition to the physical town portal', () => {
    const text = greeting(repairs);
    expect(text).toContain(PORTAL_DIRECTIONS);
    expect(text).toContain('At level 100');
    expect(text).not.toContain('court is open to you');
});

test('a ready but unclaimed Fifth Note does not announce court admission', () => {
    const text = greeting([...repairs, { id: 'chronicle_14_resonance_gate', category: 'chronicle',
        accepted: true, completed: false, type: 'KILL', count: 1, maxCount: 1 }]);
    expect(text).not.toContain('court is open to you');
    expect(text).toContain('Complete Quest');
});

test('a personally claimed Fifth Note distinguishes private raid admission from the shared portal', () => {
    const quests = Object.freeze([...repairs, { id: 'chronicle_14_resonance_gate', category: 'chronicle', completed: true }]
        .map(q => Object.freeze(q)));
    const before = JSON.stringify(quests), text = greeting(quests);
    expect(text).toContain('Nexus has yielded its Fifth Note');
    expect(text).toContain('Dungeon Guide in Lanternhold');
    expect(text).toContain('shared expedition, not his throne');
    expect(text).not.toContain('Malachar waits beyond it');
    expect(JSON.stringify(quests)).toBe(before);
});

test('recap reveals no milestones for fresh, optional or ready-but-unclaimed snapshots', () => {
    for (const quests of [undefined, [], [null], [{ id: 'chronicle_earth_keepers_house', completed: true, legacyOptional: true }],
        repairs.map(q => ({ ...q, completed: false, accepted: true, count: 1, maxCount: 1 })),
        [{ id: 'chronicle_15_dark_king', completed: false, accepted: true, count: 1, maxCount: 1 }]]) {
        expect(getChronicleRecap(quests)).toEqual([]);
    }
});

test.each([
    ['chronicle_03_roots_remember', 0, 'Verdant Bastion', 'Rootheart'],
    ['chronicle_05_drowned_name', 1, 'Abyssal Well', 'Tidestar'],
    ['chronicle_07_crown_of_embers', 2, 'Molten Core', 'Ember Crown'],
    ['chronicle_09_sky_answers', 3, 'Tempest Spire', 'Skyglass']
])('recap distinguishes the %s road from its personally claimed repair', (id, index, dungeon, crystal) => {
    const road = Object.freeze({ id, completed: true });
    const beforeRepair = getChronicleRecap([road]);
    expect(beforeRepair).toHaveLength(1);
    expect(beforeRepair[0]).toContain(`${dungeon} cleared`);
    expect(beforeRepair[0]).toContain('did not repair the crystal');
    const afterRepair = getChronicleRecap([road, repairs[index]]);
    expect(afterRepair).toHaveLength(1);
    expect(afterRepair[0]).toContain(`${crystal} restored`);
    expect(afterRepair[0]).not.toContain('still awaits');
});

test('expedition, court and epilogue summaries require their own receipts and never infer earlier lore', () => {
    expect(getChronicleRecap(repairs.slice(0, 3)).join(' ')).not.toContain('At level 100');
    const expedition = getChronicleRecap(repairs).join(' ');
    expect(expedition).toContain(PORTAL_DIRECTIONS);
    expect(expedition).not.toContain('Fifth Note');
    expect(expedition).not.toContain('Malachar has fallen');
    const endingOnly = getChronicleRecap([{ id: 'chronicle_15_dark_king', completed: true }]);
    expect(endingOnly).toHaveLength(1);
    expect(endingOnly[0]).toContain('A Letter Without a Throne');
    expect(endingOnly[0]).not.toContain('Vigil');
});

test('Journal keeps recap control, paragraphs, focus and open state across updates without changing saves', () => {
    document.body.innerHTML = '<div id="quest-journal"></div><div id="journal-list"></div>';
    const quests = Object.freeze(repairs.map(q => Object.freeze({ ...q })));
    const before = JSON.stringify(quests);
    const ui = new QuestUI({ getLastPlayer: () => ({ level: 100, quests }) });
    ui.updateJournal(quests);
    const recap = document.querySelector('.quest-chronicle-recap');
    expect(recap.open).toBe(false);
    recap.open = true;
    const paragraph = recap.querySelector('p');
    recap.firstElementChild.focus();
    ui.updateJournal(quests);
    expect(document.querySelector('.quest-chronicle-recap')).toBe(recap);
    expect(recap.querySelector('p')).toBe(paragraph);
    expect(document.activeElement).toBe(recap.firstElementChild);
    expect(recap.open).toBe(true);
    expect(JSON.stringify(quests)).toBe(before);
    ui.updateJournal([]);
    expect(document.querySelector('.quest-chronicle-recap')).toBeNull();
});

test('expedition recap uses the latest personally completed authored account, not count or saved chapter number', () => {
    const early = darkRealmChapters[0], latest = darkRealmChapters[7], unseen = darkRealmChapters[8];
    const quests = Object.freeze([
        Object.freeze({ id: early.id, chapter: 999, completed: true }),
        Object.freeze({ id: latest.id, chapter: 1, completed: true, legacyOptional: true }),
        Object.freeze({ id: unseen.id, accepted: true, completed: false, count: 3, maxCount: 3 })
    ]);
    const lines = getChronicleRecap(quests);
    expect(lines).toEqual([`Last recovered expedition account · ${latest.title}: ${latest.summary}`]);
    expect(lines.join(' ')).not.toContain(unseen.summary);
    expect(lines.join(' ')).not.toContain('court raid');
});
