import { readAnimationPresentation } from './animationPresentationRecord.js';

afterEach(() => { delete window.game; });

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
