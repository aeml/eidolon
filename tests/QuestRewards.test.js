import { formatQuestRewards } from '../src/ui/questRewards.js';
import { QuestUI } from '../src/ui/QuestUI.js';

const quest = { id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, title: 'The Bell That Rang Below', type: 'KILL', target: 'Skeleton', count: 3, maxCount: 3, accepted: true, completed: false, rewardGold: 100, rewardXP: 500 };

test('quests show gold plus XP while leveling and gold plus Resonance XP at the cap', () => {
    expect(formatQuestRewards(quest, { level: 1 })).toBe('100 gold · 500 XP');
    expect(formatQuestRewards(quest, { level: 99 })).toBe('100 gold · 500 XP');
    expect(formatQuestRewards(quest, { level: 100 })).toBe('100 gold · 500 Resonance XP');
    expect(formatQuestRewards({ rewardGold: 200, rewardXp: 300 }, { level: 100 })).toBe('200 gold · 300 Resonance XP');
});

test('completion uses the authoritative split even when turn-in crosses level 100', () => {
    document.body.innerHTML = '<div id="quest-window"><div class="window-header"><span></span></div><div id="quest-list"></div></div><div id="quest-journal"><div id="journal-list"></div></div><div id="objectives-panel"><div id="objectives-list"></div></div>';
    const player = { level: 99, quests: [{ ...quest }] };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.questKind = 'story';
    ui.updateQuestWindow(player.quests);
    expect(document.querySelector('.quest-dialogue__reward').textContent).toContain('100 gold · 500 XP');
    document.querySelector('#quest-list button').click();
    player.level = 100;
    player.quests = [{ ...quest, completed: true, grantedGold: 100, grantedXP: 50, grantedResonanceXP: 450 }];
    ui.updateQuestWindow(player.quests);
    expect(document.querySelector('.quest-dialogue__reward').textContent).toBe('Reward received · 100 gold · 50 XP · 450 Resonance XP');
});

test('level changes refresh reward labels without needing different quest progress', () => {
    document.body.innerHTML = '<div id="quest-window"><div class="window-header"><span></span></div><div id="quest-list"></div></div>';
    const player = { level: 99 };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.questKind = 'story';
    ui.updateQuestWindow([quest]);
    player.level = 100;
    ui.updateQuestWindow([quest]);
    expect(document.querySelector('.quest-dialogue__reward').textContent).toContain('100 gold · 500 Resonance XP');
});
