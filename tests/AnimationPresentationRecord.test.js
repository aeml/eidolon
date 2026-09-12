import { readAnimationCastState, readAnimationPresentation } from './animationPresentationRecord.js';

afterEach(() => { delete window.game; });

test('cast diagnostics retain transient guard values without modifying the player', () => {
    const player = {
        state: 'IDLE', stunTimer: 0.3, stats: { hp: 50, mana: 60 },
        cooldowns: { 'Meteor Drop': 0 }, skillRunes: { 'Meteor Drop': 'impact' },
        unlockedSkills: ['Meteor Drop'], hotbar: ['Meteor Drop']
    };
    window.game = { player, uiManager: { isEscMenuOpen: true } };
    const snapshot = readAnimationCastState('Meteor Drop');
    expect(snapshot).toMatchObject({ stunTimer: 0.3, rune: 'impact', unlocked: true, escapeMenu: true });
    expect(player.stunTimer).toBe(0.3);
    player.stunTimer = 0;
    expect(snapshot.stunTimer).toBe(0.3);
});

test('Teleport waits for the accepted endpoint presentation, not local prediction', () => {
    const local = { skillName: 'Teleport', timestamp: 10, layerCount: 2 };
    window.game = { player: { lastAbilityPresentation: local } };
    expect(readAnimationPresentation('Teleport')).toBeNull();
    const accepted = { skillName: 'Teleport', timestamp: 20, layerCount: 4, fallback: false };
    window.game.player.lastRemoteAbilityPresentation = accepted;
    expect(readAnimationPresentation('Teleport')).toBe(accepted);
});

test.each(['Fireball', 'Dragonfire Lance', 'Charge', 'Healing Light'])('%s still requires its local input presentation', skillName => {
    const local = { skillName, timestamp: 10, layerCount: 2 };
    window.game = { player: { lastRemoteAbilityPresentation: { skillName, timestamp: 20 } } };
    expect(readAnimationPresentation(skillName)).toBeNull();
    window.game.player.lastAbilityPresentation = local;
    expect(readAnimationPresentation(skillName)).toBe(local);
});

test('missing actors and stale accepted records are not fabricated into successful casts', () => {
    expect(readAnimationPresentation('Teleport')).toBeNull();
    const stale = { skillName: 'Dragonfire Lance', timestamp: 4 };
    window.game = { player: { lastRemoteAbilityPresentation: stale } };
    expect(readAnimationPresentation('Teleport')).toBe(stale);
    // The caller still checks both expected skill and a newer timestamp.
    expect(readAnimationPresentation('Teleport').skillName).not.toBe('Teleport');
});
