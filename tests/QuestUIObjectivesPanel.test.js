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

    test('renders a next-step handoff above active objectives for first-session guidance', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getCurrentInstanceId: () => null,
            getCurrentInstanceType: () => 'overworld'
        });

        questUI.updateJournal([
            {
                id: 'q1',
                target: 'DungeonBoss',
                accepted: true,
                completed: false,
                count: 0,
                maxCount: 3,
                rewardXP: 250
            }
        ]);

        const panel = document.getElementById('objectives-panel');
        const guidance = panel.querySelector('.objective-guidance');
        expect(panel.style.display).toBe('flex');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Next Step');
        expect(guidance.textContent).toContain('Kill Dungeon Bosses');
        expect(guidance.textContent).toContain('World Map (M)');
        expect(guidance.textContent).toContain('Journal (J)');
    });

    test('renders a starter town objective when the player has no active quests in town', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({
                quests: [],
                position: { x: 0, z: 200 }
            }),
            getCurrentInstanceId: () => null,
            getCurrentInstanceType: () => 'overworld'
        });

        questUI.updateJournal([]);

        const panel = document.getElementById('objectives-panel');
        const guidance = panel.querySelector('.objective-guidance');
        const list = document.getElementById('objectives-list');
        expect(panel.style.display).toBe('flex');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Meet the Quest Giver');
        expect(guidance.textContent).toContain('Quest Giver');
        expect(guidance.textContent).toContain('Forge');
        expect(guidance.textContent).toContain('Stash');
        expect(guidance.textContent).toContain('Vendor / Repair');
        expect(guidance.textContent).toContain('Trading House');
        expect(guidance.textContent).toContain('World Map (M)');
        expect(guidance.textContent).toContain('Quest Giver by the Forge');
        expect(list.textContent).toContain('Meet the Quest Giver');
        expect(list.textContent).toContain('Head to the Quest Giver by the Forge');
        expect(list.textContent).toContain('Stash');
        expect(list.textContent).toContain('sort gear');
        expect(list.textContent).toContain('sell junk to Vendor / Repair');
        expect(list.textContent).toContain('save valuable drops for the Trading House');
    });

    test('hides objectives panel when there are no accepted quests outside town', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({
                quests: [],
                position: { x: 800, z: -400 }
            }),
            getCurrentInstanceId: () => null,
            getCurrentInstanceType: () => 'overworld'
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
        expect(document.querySelector('.objective-guidance')).toBeNull();
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
                    { index: 1, type: 'elite', explored: true, cleared: true },
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
                hint: 'Boss room discovered',
                routeTone: 'danger'
            }),
            expect.objectContaining({
                id: 'q1',
                title: 'Kill Tempest Spire Boss'
            })
        ]));
    });

    test('builds a live boss objective when the player is already in the boss room', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 2,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'elite', explored: true, cleared: true },
                    { index: 2, type: 'boss', explored: true, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'tempest_spire'
        });

        const summary = questUI.buildObjectiveSummary([]);

        expect(summary).toEqual([
            expect.objectContaining({
                id: 'dungeon-route-tempest_spire',
                title: 'Survive the boss fight',
                badge: 'Boss Now',
                badgeClass: 'is-boss',
                hint: 'You are in the boss room — commit and survive',
                routeTone: 'danger',
                sequenceHint: ''
            })
        ]);
    });

    test('builds an exit objective when the dungeon is fully cleared', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 2,
                objectiveRoomIndex: -1,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', explored: true, cleared: true },
                    { index: 2, type: 'boss', explored: true, cleared: true }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'tempest_spire'
        });

        const summary = questUI.buildObjectiveSummary([]);

        expect(summary).toEqual([
            expect.objectContaining({
                id: 'dungeon-route-tempest_spire',
                title: 'Return to the entrance',
                progressLabel: '2 / 2',
                progressPct: 100,
                badge: 'Exit',
                badgeClass: 'is-exit',
                completed: true,
                hint: 'Dungeon cleared — head back to the entrance',
                routeTone: 'support'
            })
        ]);
    });

    test('builds an elite routing objective when the next discovered room is elite', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', explored: true, cleared: true },
                    { index: 2, type: 'elite', explored: true, cleared: false },
                    { index: 3, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'molten_core'
        });

        const summary = questUI.buildObjectiveSummary([]);

        expect(summary).toEqual([
            expect.objectContaining({
                id: 'dungeon-route-molten_core',
                title: 'Clear the elite room',
                badge: 'Elite',
                badgeClass: 'is-elite',
                hint: 'Elite room discovered',
                routeTone: 'warning'
            })
        ]);
    });

    test('builds a treasure-room routing objective before the deeper shrine reset room', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'chest', explored: false, cleared: false },
                    { index: 2, type: 'elite', hook: 'elite_ambush', explored: false, cleared: false },
                    { index: 3, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                    { index: 4, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'verdant_bastion_catacombs'
        });

        const summary = questUI.buildObjectiveSummary([]);

        expect(summary).toEqual([
            expect.objectContaining({
                id: 'dungeon-route-verdant_bastion_catacombs',
                title: 'Secure the treasure room',
                badge: 'Chest',
                badgeClass: 'is-chest',
                hint: 'Quick score before the ambush spike',
                routeTone: 'support',
                sequenceHint: 'Route: Chest -> Ambush -> Shrine -> Boss'
            })
        ]);
    });

    test('renders route preview guidance for staged dungeon beats', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'chest', explored: false, cleared: false },
                    { index: 2, type: 'elite', hook: 'elite_ambush', explored: false, cleared: false },
                    { index: 3, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                    { index: 4, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'verdant_bastion_catacombs'
        });

        questUI.updateJournal([]);

        const guidance = document.querySelector('.objective-guidance');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Secure the treasure room');
        expect(guidance.textContent).toContain('Quick score before the ambush spike');
        expect(guidance.textContent).toContain('Route: Chest -> Ambush -> Shrine -> Boss');
    });

    test('builds a shrine routing objective as the last reset before a boss push', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'elite', explored: true, cleared: true },
                    { index: 2, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                    { index: 3, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'molten_core'
        });

        const summary = questUI.buildObjectiveSummary([]);

        expect(summary).toEqual([
            expect.objectContaining({
                id: 'dungeon-route-molten_core',
                title: 'Reach the shrine room',
                badge: 'Shrine',
                badgeClass: 'is-shrine',
                hint: 'Last reset before the boss push',
                routeTone: 'support',
                sequenceHint: 'Route: Shrine -> Boss'
            })
        ]);
    });

    test('renders last-reset guidance for shrine rooms that directly precede the boss', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'elite', explored: true, cleared: true },
                    { index: 2, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                    { index: 3, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'molten_core'
        });

        questUI.updateJournal([]);

        const guidance = document.querySelector('.objective-guidance');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Reach the shrine room');
        expect(guidance.textContent).toContain('Last reset before the boss push');
        expect(guidance.textContent).toContain('Route: Shrine -> Boss');
    });

    test('renders execution guidance instead of route preview for a live boss objective', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 2,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'elite', explored: true, cleared: true },
                    { index: 2, type: 'boss', explored: true, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'tempest_spire'
        });

        questUI.updateJournal([]);

        const guidance = document.querySelector('.objective-guidance');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Survive the boss fight');
        expect(guidance.textContent).toContain('You are in the boss room — commit and survive');
        expect(guidance.textContent).not.toContain('Route:');
    });
});
