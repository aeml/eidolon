import { QuestUI } from '../src/ui/QuestUI.js';

function buildQuestDom() {
    document.body.innerHTML = `
        <div id="quest-window" style="display:none"></div>
        <div id="quest-list"></div>
        <div id="quest-journal" style="display:none"></div>
        <div id="journal-list"></div>
        <div id="objectives-panel" style="display:none"></div>
        <div id="objectives-list"></div>
        <button id="btn-close-quest"></button>
        <button id="btn-close-journal"></button>
    `;
}

describe('QuestUI objectives panel', () => {
    test('renders active quest progress and completion state in objectives panel', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] })
        });

        questUI.updateJournal([
            {
                id: 'q1',
                target: 'DungeonBoss',
                accepted: true,
                completed: false,
                count: 1,
                maxCount: 3,
                rewardXP: 250
            },
            {
                id: 'q2',
                target: 'AbyssalWellBoss',
                accepted: true,
                completed: true,
                count: 1,
                maxCount: 1,
                rewardXP: 900
            },
            {
                id: 'q3',
                target: 'MoltenCoreBoss',
                accepted: false,
                completed: false,
                count: 0,
                maxCount: 1,
                rewardXP: 500
            }
        ]);

        const panel = document.getElementById('objectives-panel');
        const list = document.getElementById('objectives-list');
        expect(panel.style.display).toBe('flex');
        expect(list.children).toHaveLength(2);
        expect(list.innerHTML).toContain('Kill Dungeon Bosses');
        expect(list.innerHTML).toContain('1 / 3');
        expect(list.innerHTML).toContain('2 remaining');
        expect(list.innerHTML).toContain('Kill Abyssal Well Boss');
        expect(list.innerHTML).toContain('Reward: 900 XP');
        expect(list.querySelectorAll('.objective-entry__status.is-complete')).toHaveLength(1);
    });

    test('hides objectives panel when there are no accepted quests', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] })
        });

        questUI.updateJournal([
            {
                id: 'q1',
                target: 'DungeonBoss',
                accepted: false,
                completed: false,
                count: 0,
                maxCount: 1,
                rewardXP: 100
            }
        ]);

        expect(document.getElementById('objectives-panel').style.display).toBe('none');
        expect(document.getElementById('objectives-list').children).toHaveLength(0);
    });
});
