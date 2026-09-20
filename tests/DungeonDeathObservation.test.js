import { installDungeonObservationInPage, readDungeonTargetStateInPage } from './dungeonDeathObservation.js';

beforeEach(() => {
    window.game = { currentInstanceId: 'raid-a', remotePlayers: new Map(), player: { id: 'player' },
        handleServerMessage(message) {
            for (const [id, entity] of Object.entries(message.payload?.u || {})) this.remotePlayers.set(id, entity);
            for (const id of message.payload?.r || []) this.remotePlayers.delete(id);
        } };
    installDungeonObservationInPage();
});
const update = (u = {}, r = []) => window.game.handleServerMessage({ type: 'delta', payload: { u, r } });

test('retains a confirmed death while awaited support input outlasts corpse cleanup', () => {
    update({ enemy: { state: 'ATTACKING', stats: { hp: 318 } } });
    expect(readDungeonTargetStateInPage('enemy').health).toBe(318);
    update({ enemy: { state: 'DEAD', stats: { hp: 0 } } });
    update({}, ['enemy']);
    expect(readDungeonTargetStateInPage('enemy')).toEqual({ health: 0, state: 'DEAD' });
});

test('disappearance or stream-out alone is never a kill', () => {
    update({ enemy: { state: 'IDLE', health: 318 } });
    update({}, ['enemy']);
    expect(readDungeonTargetStateInPage('enemy')).toBeNull();
});

test('an old instance or living same-ID actor cannot inherit a recorded death', () => {
    update({ enemy: { state: 'DEAD', health: 0 } });
    update({}, ['enemy']);
    window.game.currentInstanceId = 'raid-b';
    expect(readDungeonTargetStateInPage('enemy')).toBeNull();
    window.game.currentInstanceId = 'raid-a';
    update({ enemy: { state: 'IDLE', health: 500 } });
    expect(readDungeonTargetStateInPage('enemy').health).toBe(500);
    update({}, ['enemy']);
    expect(readDungeonTargetStateInPage('enemy')).toBeNull();
});

test('unknown health is not zero and observations are bounded', () => {
    update({ unknown: { state: 'IDLE', health: null } });
    for (let i = 0; i < 300; i++) update({ [`dead-${i}`]: { health: 0 } });
    expect(window.__dungeonConfirmedDeaths.has('unknown')).toBe(false);
    expect(window.__dungeonConfirmedDeaths.size).toBe(256);
});
