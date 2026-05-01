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
        expect(guidance.textContent).toContain('vendor obvious Common junk');
        expect(guidance.textContent).toContain('Shards');
        expect(guidance.textContent).toContain('Hearts');
        expect(guidance.textContent).toContain('Gems');
        expect(guidance.textContent).toContain('World Map (M)');
        expect(guidance.textContent).toContain('Quest Giver by the Forge');
        expect(list.textContent).toContain('Meet the Quest Giver');
        expect(list.textContent).toContain('Head to the Quest Giver by the Forge');
        expect(list.textContent).toContain('Stash');
        expect(list.textContent).toContain('vendor obvious Common junk');
        expect(list.textContent).toContain('check stronger drops before selling');
        expect(list.textContent).toContain('keep Shards, Hearts, and Gems for the Forge');
    });

    test('renders a town recovery objective above active quests after a starter-town respawn', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({
                level: 8,
                quests: [],
                position: { x: -1.25, z: 200 }
            }),
            getCurrentInstanceId: () => null,
            getCurrentInstanceType: () => 'overworld',
            getOnboardingRecoveryContext: () => ({ reason: 'respawn' })
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
        const list = document.getElementById('objectives-list');
        expect(panel.style.display).toBe('flex');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Recover in town and re-orient');
        expect(guidance.textContent).toContain('Respawned in town');
        expect(guidance.textContent).toContain('Stash');
        expect(guidance.textContent).toContain('Vendor / Repair');
        expect(guidance.textContent).toContain('Forge');
        expect(guidance.textContent).toContain('World Map (M)');
        expect(guidance.textContent).toContain('Journal (J)');
        expect(guidance.textContent).toContain('Closed a menu or got turned around?');
        expect(list.children).toHaveLength(2);
        expect(list.firstChild.textContent).toContain('Recover in town and re-orient');
        expect(list.textContent).toContain('Kill Dungeon Bosses');
    });

    test('renders a post-level-30 town objective that points the player toward the Dungeon Guide', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({
                level: 36,
                quests: [],
                position: { x: 2, z: 210 }
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
        expect(guidance.textContent).toContain('Check the Dungeon Guide');
        expect(guidance.textContent).toContain('Level 30 unlocked all base dungeons');
        expect(guidance.textContent).toContain('Dungeon Guide');
        expect(guidance.textContent).toContain('World Map (M)');
        expect(guidance.textContent).toContain('Journal (J)');
        expect(list.children).toHaveLength(1);
        expect(list.textContent).toContain('Check the Dungeon Guide');
    });

    test('renders a post-level-100 town objective that points the player toward Heroic and Mythic runs', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({
                level: 100,
                quests: [],
                position: { x: -8, z: 220 }
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
        expect(guidance.textContent).toContain('Push Heroic and Mythic runs');
        expect(guidance.textContent).toContain('Level 100 unlocked Heroic and Mythic');
        expect(guidance.textContent).toContain('Dungeon Guide');
        expect(guidance.textContent).toContain('Skills (K)');
        expect(guidance.textContent).toContain('Forge');
        expect(list.children).toHaveLength(1);
        expect(list.textContent).toContain('Push Heroic and Mythic runs');
    });

    test('renders a repeatable ladder summary in the journal for the highest-value dailies', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getServerEpochSeconds: () => Date.UTC(2026, 3, 19, 3, 30, 15) / 1000
        });

        questUI.updateJournal([
            {
                id: 'daily_dungeon_bosses_mythic',
                target: 'DungeonBossMythic',
                accepted: true,
                completed: false,
                count: 1,
                maxCount: 4,
                rewardXP: 15000000
            },
            {
                id: 'daily_dungeon_bosses_heroic',
                target: 'DungeonBossHeroic',
                accepted: false,
                completed: false,
                count: 0,
                maxCount: 4,
                rewardXP: 10000000
            },
            {
                id: 'daily_tempest_spire_bosses',
                target: 'TempestSpireBoss',
                accepted: true,
                completed: true,
                count: 5,
                maxCount: 5,
                rewardXP: 9000000
            }
        ]);

        const journal = document.getElementById('journal-list');
        expect(journal.textContent).toContain('Repeatable Ladder');
        expect(journal.textContent).toContain('Accepted now: 1');
        expect(journal.textContent).toContain('Ready to claim: 1');
        expect(journal.textContent).toContain('Daily reset:');
        expect(journal.textContent).toContain('00:29:45 remaining');
        expect(journal.textContent).toContain('Dungeon Boss (Mythic) • Active');
        expect(journal.textContent).toContain('1 / 4 • 15,000,000 XP');
        expect(journal.textContent).toContain('Dungeon Boss (Heroic) • Available');
        expect(journal.textContent).toContain('Tempest Spire Bosses • Ready');
        expect(journal.textContent).toContain('Server clock says the daily ladder rolls in 00:29:45');
    });

    test('keeps the repeatable ladder visible even when no dailies are currently accepted', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getServerEpochSeconds: () => Date.UTC(2026, 3, 19, 3, 30, 15) / 1000
        });

        questUI.updateJournal([
            {
                id: 'daily_molten_core_bosses',
                target: 'MoltenCoreBoss',
                accepted: false,
                completed: false,
                count: 0,
                maxCount: 5,
                rewardXP: 9000000
            }
        ]);

        const journal = document.getElementById('journal-list');
        expect(journal.textContent).toContain('Repeatable Ladder');
        expect(journal.textContent).toContain('Accepted now: 0');
        expect(journal.textContent).toContain('Molten Core Bosses • Available');
        expect(journal.textContent).toContain('No active quests.');
    });

    test('falls back to static reset guidance when authoritative server time is unavailable', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] })
        });

        questUI.updateJournal([
            {
                id: 'daily_molten_core_bosses',
                target: 'MoltenCoreBoss',
                accepted: false,
                completed: false,
                count: 0,
                maxCount: 5,
                rewardXP: 9000000
            }
        ]);

        const journal = document.getElementById('journal-list');
        expect(journal.textContent).toContain('Daily quests reset at 12:00 AM Eastern Time');
        expect(journal.textContent).toContain('Highest-value dailies reset tomorrow, so this is the fastest XP ladder to pick back up.');
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
                title: 'Commit to the boss room',
                progressLabel: '3 / 4',
                progressPct: 75,
                rewardXP: 0,
                completed: false,
                badge: 'Boss',
                badgeClass: 'is-boss',
                hint: 'Boss room ahead — reset and commit'
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
                title: 'Commit to the boss room',
                badge: 'Boss',
                badgeClass: 'is-boss',
                hint: 'Boss room ahead — reset and commit Boss lair: commit to the encounter and survive.',
                routeTone: 'danger',
                cadenceLabel: 'Climax • Boss Lair'
            }),
            expect.objectContaining({
                id: 'q1',
                title: 'Kill Tempest Spire Boss'
            })
        ]));
    });

    test('builds a bridge-to-boss routing objective when one approach room remains', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', explored: false, cleared: false },
                    { index: 2, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'tempest_spire'
        });

        const summary = questUI.buildObjectiveSummary([]);

        expect(summary).toEqual([
            expect.objectContaining({
                id: 'dungeon-route-tempest_spire',
                title: 'Break through the last approach room',
                badge: 'Objective',
                badgeClass: 'is-objective',
                hint: 'Boss path open — one last room before the boss Route hall: clear forward and watch for the next named beat.',
                routeTone: 'neutral',
                sequenceHint: 'Route: Route Hall -> Boss Lair',
                cadenceLabel: 'Build • Route Hall'
            })
        ]);
    });

    test('renders clear-through guidance for transitional rooms before the shrine route', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', explored: false, cleared: false },
                    { index: 2, type: 'normal', explored: false, cleared: false },
                    { index: 3, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                    { index: 4, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'molten_core'
        });

        questUI.updateJournal([]);

        const guidance = document.querySelector('.objective-guidance');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Clear through to the shrine route');
        expect(guidance.textContent).toContain('3 rooms remain before the shrine reset');
        expect(guidance.textContent).toContain('Route hall: clear forward and watch for the next named beat.');
        expect(guidance.textContent).toContain('Cadence: Build • Route Hall');
        expect(guidance.textContent).toContain('Route: Route Hall -> Restorative Shrine -> Boss Lair');
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
                hint: 'You are in the boss room — commit and survive Boss lair: commit to the encounter and survive.',
                routeTone: 'danger',
                sequenceHint: '',
                cadenceLabel: 'Climax • Boss Lair'
            })
        ]);
    });

    test('builds an extraction objective when the dungeon is fully cleared', () => {
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
                title: 'Extract through the entrance',
                progressLabel: '2 / 2',
                progressPct: 100,
                badge: 'Exit',
                badgeClass: 'is-exit',
                completed: true,
                hint: 'Boss down — backtrack to the entrance and leave with the loot',
                routeTone: 'support'
            })
        ]);
    });

    test('renders extraction guidance instead of generic completed turn-in copy for a cleared dungeon', () => {
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

        questUI.updateJournal([]);

        const guidance = document.querySelector('.objective-guidance');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Extract through the entrance');
        expect(guidance.textContent).toContain('Boss down — backtrack to the entrance and leave with the loot');
        expect(guidance.textContent).not.toContain('Turn this in for 0 XP');
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
                hint: 'Elite room discovered Elite guard: a heavier combat check on the route.',
                routeTone: 'warning',
                cadenceLabel: 'Pressure • Elite Guard'
            })
        ]);
    });

    test('builds an ambush routing objective with pressure-spike guidance', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: true },
                    { index: 2, type: 'elite', hook: 'elite_ambush', explored: true, cleared: false },
                    { index: 3, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                    { index: 4, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'molten_core'
        });

        const summary = questUI.buildObjectiveSummary([]);

        expect(summary).toEqual([
            expect.objectContaining({
                id: 'dungeon-route-molten_core',
                title: 'Survive the ambush room',
                badge: 'Ambush',
                badgeClass: 'is-ambush',
                hint: 'Elite room ahead — pressure spike incoming Ambush chamber: expect elite pressure and limited reset time.',
                routeTone: 'warning',
                sequenceHint: 'Route: Ambush Chamber -> Restorative Shrine -> Boss Lair',
                cadenceLabel: 'Spike • Ambush Chamber'
            })
        ]);
    });

    test('renders pressure-spike guidance for ambush rooms in the journal', () => {
        buildQuestDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: true },
                    { index: 2, type: 'elite', hook: 'elite_ambush', explored: true, cleared: false },
                    { index: 3, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                    { index: 4, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'molten_core'
        });

        questUI.updateJournal([]);

        const guidance = document.querySelector('.objective-guidance');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Survive the ambush room');
        expect(guidance.textContent).toContain('Elite room ahead — pressure spike incoming');
        expect(guidance.textContent).toContain('Ambush chamber: expect elite pressure and limited reset time.');
        expect(guidance.textContent).toContain('Cadence: Spike • Ambush Chamber');
        expect(guidance.textContent).toContain('Route: Ambush Chamber -> Restorative Shrine -> Boss Lair');
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
                hint: 'Quick score before the ambush spike Treasure cache: a short payoff beat before route pressure returns.',
                routeTone: 'support',
                sequenceHint: 'Route: Treasure Cache -> Ambush Chamber -> Restorative Shrine -> Boss Lair',
                cadenceLabel: 'Payoff • Treasure Cache'
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
        expect(guidance.textContent).toContain('Treasure cache: a short payoff beat before route pressure returns.');
        expect(guidance.textContent).toContain('Cadence: Payoff • Treasure Cache');
        expect(guidance.textContent).toContain('Route: Treasure Cache -> Ambush Chamber -> Restorative Shrine -> Boss Lair');
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
                hint: 'Last reset before the boss push Restorative shrine: stabilize resources before the next push.',
                routeTone: 'support',
                sequenceHint: 'Route: Restorative Shrine -> Boss Lair',
                cadenceLabel: 'Reset • Restorative Shrine'
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
        expect(guidance.textContent).toContain('Restorative shrine: stabilize resources before the next push.');
        expect(guidance.textContent).toContain('Cadence: Reset • Restorative Shrine');
        expect(guidance.textContent).toContain('Route: Restorative Shrine -> Boss Lair');
    });

    test('renders commit guidance for a discovered boss objective before the fight goes live', () => {
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

        questUI.updateJournal([]);

        const guidance = document.querySelector('.objective-guidance');
        expect(guidance).not.toBeNull();
        expect(guidance.textContent).toContain('Commit to the boss room');
        expect(guidance.textContent).toContain('Boss room ahead — reset and commit');
        expect(guidance.textContent).not.toContain('Boss Now');
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
