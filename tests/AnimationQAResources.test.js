import { jest } from '@jest/globals';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

class Harness {}
installGameEngineNetworkMessages(Harness);
function fixture() {
    const g = new Harness();
    g.player = { stats: { hp: 100, maxHp: 1100, mana: 100, maxMana: 1743 }, cooldowns: { old: 3 } };
    g.abilityController = { inputBuffer: [1] };
    g.uiManager = { updateHotbarCooldowns: jest.fn() };
    return g;
}
test.each([1, 250, 1000])('QA acknowledgement uses actual resources, including health%s, not stale rested maxima', health => {
    const g = fixture();
    g.handleServerMessage({ type: 'qa_animation_ready', payload: { health, maxHealth: 1000, mana: 1585, maxMana: 1585 } });
    expect(g.player.stats).toEqual({ hp: health, maxHp: 1000, mana: 1585, maxMana: 1585 });
    expect(g.animationQAReadySequence).toBe(1); expect(g.player.cooldowns).toEqual({});
    expect(g.abilityController.inputBuffer).toEqual([]);
    g.handleServerMessage({ type: 'ability_result', payload: { skillName: 'Cloak & Vanish', accepted: true, mana: 1558, cooldownRemaining: 11.25 } });
    expect(1585 - g.player.stats.mana).toBe(27);
});
test('legacy or malformed readiness payload cannot invent a refill', () => {
    const g = fixture();
    g.handleServerMessage({ type: 'qa_animation_ready', payload: { lowHealth: true, mana: -1, maxMana: null, health: NaN } });
    expect(g.player.stats).toEqual({ hp: 100, maxHp: 1100, mana: 100, maxMana: 1743 });
});
