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
    test('renders active quest progress and ready-to-turn-in state in objectives panel', () => {
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
                completed: false,
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

    test('removes turned-in quests from objectives panel and journal entries', () => {
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
                count: 4,
                maxCount: 4,
                rewardXP: 500
            },
            {
                id: 'q2',
                target: 'TempestSpireBoss',
                accepted: true,
                completed: true,
                count: 5,
                maxCount: 5,
                rewardXP: 900
            }
        ]);

        const objectivesList = document.getElementById('objectives-list');
        const journalList = document.getElementById('journal-list');
        expect(objectivesList.children).toHaveLength(1);
        expect(objectivesList.textContent).toContain('Kill Dungeon Bosses');
        expect(objectivesList.textContent).not.toContain('Tempest Spire Boss');
        expect(journalList.textContent).toContain('Kill Dungeon Bosses');
        expect(journalList.textContent).not.toContain('Tempest Spire Boss');
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

    test('renders dungeon objective entries with status badges for routing states', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] })
        });

        questUI.renderObjectivesPanel([
            {
                id: 'dungeon-route-open',
                title: 'Push deeper into Tempest Spire',
                progressLabel: '2 / 4',
                progressPct: 50,
                rewardXP: 0,
                completed: false,
                badge: 'Objective',
                badgeClass: 'is-objective',
                hint: 'Boss path open — one room remains'
            },
            {
                id: 'dungeon-route-boss',
                title: 'Confront the boss',
                progressLabel: '3 / 4',
                progressPct: 75,
                rewardXP: 0,
                completed: false,
                badge: 'Boss',
                badgeClass: 'is-boss',
                hint: 'Boss room discovered'
            }
        ]);

        const badges = Array.from(document.querySelectorAll('.objective-entry__badge')).map((node) => ({
            text: node.textContent,
            className: node.className
        }));
        expect(badges).toEqual([
            expect.objectContaining({ text: 'Objective', className: expect.stringContaining('is-objective') }),
            expect.objectContaining({ text: 'Boss', className: expect.stringContaining('is-boss') })
        ]);
    });

    test('builds dungeon routing objectives from live room state alongside quests', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', explored: true, cleared: true },
                    { index: 2, type: 'boss', explored: true, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'tempest_spire'
        });

        const summary = questUI.buildObjectiveSummary([
            {
                id: 'q1',
                target: 'TempestSpireBoss',
                accepted: true,
                completed: false,
                count: 0,
                maxCount: 1,
                rewardXP: 900
            }
        ]);

        expect(summary).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'dungeon-route-tempest_spire',
                title: 'Confront the boss',
                badge: 'Boss',
                badgeClass: 'is-boss',
                hint: 'Boss room discovered'
            }),
            expect.objectContaining({
                id: 'q1',
                title: 'Kill Tempest Spire Boss'
            })
        ]));
    });
});
