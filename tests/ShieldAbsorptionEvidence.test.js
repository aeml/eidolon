import { jest } from '@jest/globals';
import { observeShieldAbsorption, readShieldAbsorptionEvidence } from './shieldAbsorptionEvidence.js';

function fixture() {
    const scene = { visible: true };
    const group = { parent: scene, visible: true, userData: { ownerId: 'wizard' } };
    const effect = { isActive: true, disposed: false, group };
    const player = { id: 'wizard', arcaneShieldActive: true, shieldHP: 524,
        stats: { hp: 3000 }, attachedStatusEffects: new Map([['arcane_shield', effect]]) };
    const game = { player, renderSystem: { scene } };
    const state = { id: 'wizard', arcaneShieldActive: true, arcaneShieldHp: 524 };
    return { game, player, state, scene, effect, group };
}

test('coherent partial absorption requires the actual visible owner effect and matching replicated HP', () => {
    const { game, state } = fixture();
    expect(readShieldAbsorptionEvidence(game, state, 834, 12)).toEqual({
        at: 12, active: true, visual: true, remaining: 524, absorbed: 310, health: 3000
    });
});

test.each([
    f => { f.game.player = null; },
    f => { f.state = null; },
    f => { f.player.stats.hp = 0; },
    f => { delete f.player.stats; },
    f => { f.player.arcaneShieldActive = false; f.player.shieldHP = 0; },
    f => { f.player.shieldHP = 400; },
    f => { f.state.id = 'other'; },
    f => { f.state.arcaneShieldActive = false; },
    f => { f.state.arcaneShieldHp = 0; },
    f => { f.state.arcaneShieldHp = 834; },
    f => { f.state.arcaneShieldHp = NaN; },
    f => { f.player.attachedStatusEffects.clear(); },
    f => { f.effect.isActive = false; },
    f => { f.effect.disposed = true; },
    f => { f.group.parent = null; },
    f => { f.group.parent = { visible: true }; },
    f => { f.group.visible = false; },
    f => { f.scene.visible = false; },
    f => { f.group.userData.ownerId = 'other'; }
])('stale, incomplete, foreign or invisible evidence cannot pass (%#)', change => {
    const f = fixture(); change(f);
    expect(readShieldAbsorptionEvidence(f.game, f.state, 834, 12)).toBeNull();
});

test.each([0, -1, NaN, Infinity])('invalid capacity %s is rejected', capacity => {
    const { game, state } = fixture();
    expect(readShieldAbsorptionEvidence(game, state, capacity, 12)).toBeNull();
    expect(() => observeShieldAbsorption(game, capacity)).toThrow('Positive shield capacity');
});

test.each(['state', 'delta'])('observe after normal %s delivery, retaining same-moment evidence after later depletion', type => {
    const { game, player, state } = fixture();
    player.shieldHP = 834;
    const original = jest.fn(function (message) {
        expect(this).toBe(game);
        const value = (type === 'state' ? message.payload : message.payload.u)[0];
        player.shieldHP = value.arcaneShieldHp;
        player.arcaneShieldActive = value.arcaneShieldActive;
        if (!player.arcaneShieldActive) player.attachedStatusEffects.clear();
        return 'forwarded';
    });
    game.handleServerMessage = original;
    const observation = observeShieldAbsorption(game, 834, () => 12);
    const send = value => game.handleServerMessage({ type, payload: type === 'state' ? [value] : { u: [value] } });
    expect(send(state)).toBe('forwarded');
    const sample = { ...observation.sample };
    expect(sample).toMatchObject({ remaining: 524, absorbed: 310, visual: true });
    send({ ...state, arcaneShieldActive: false, arcaneShieldHp: 0 });
    expect(observation.sample).toEqual(sample);
    expect(player.shieldHP).toBe(0);
    expect(player.attachedStatusEffects.size).toBe(0);
    expect(original).toHaveBeenCalledTimes(2);
    observation.stop();
    expect(game.handleServerMessage).toBe(original);
});

test('failed delivery cannot become accepted evidence', () => {
    const { game, state } = fixture();
    game.handleServerMessage = () => { throw new Error('delivery failed'); };
    const observation = observeShieldAbsorption(game, 834);
    expect(() => game.handleServerMessage({ type: 'state', payload: [state] })).toThrow('delivery failed');
    expect(observation.sample).toBeNull();
});

test('stopping observation preserves a newer wrapper and continues normal delivery', () => {
    const { game, state } = fixture();
    game.handleServerMessage = jest.fn(() => 'forwarded');
    const observation = observeShieldAbsorption(game, 834);
    const observed = game.handleServerMessage;
    const outer = message => observed(message);
    game.handleServerMessage = outer;
    observation.stop();
    expect(game.handleServerMessage).toBe(outer);
    expect(game.handleServerMessage({ type: 'state', payload: [state] })).toBe('forwarded');
    expect(observation.sample).toBeNull();
});
