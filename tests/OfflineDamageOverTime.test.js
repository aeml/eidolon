import { jest } from '@jest/globals';
import { Actor } from '../src/entities/Actor.js';
import { applyOfflineStatus, updateOfflineDamageOverTime } from '../src/core/OfflineDamageOverTime.js';

let source, target;
beforeEach(() => {
    source = new Actor('wound-source', {}); source.meshType = 'Rogue';
    target = new Actor('wound-target', {});
    source.stats.hp = 100; source.stats.maxHp = 1000;
    target.stats.hp = target.stats.maxHp = 1000; target.stats.hpRegen = 0;
});
afterEach(() => { source.dispose(); target.dispose(); jest.restoreAllMocks(); });

test.each(['bleed', 'poison'])('%s clips elapsed time to its lifetime and clears its source', kind => {
    expect(applyOfflineStatus(source, target, kind, 10, 2.5, 'Shadow Lunge')).toBe(true);
    updateOfflineDamageOverTime(target, 10);
    expect(target.stats.hp).toBe(980);
    expect(target[`${kind}Timer`]).toBe(0);
    expect(target[`${kind}TickDamage`]).toBe(0);
    expect(target[`${kind}Source`]).toBeNull();
    updateOfflineDamageOverTime(target, 10);
    expect(target.stats.hp).toBe(980);
});

test('refresh replaces damage/source without postponing the existing cadence', () => {
    const second = new Actor('second-source', {});
    try {
        applyOfflineStatus(source, target, 'bleed', 10, 5, 'Shadow Lunge');
        updateOfflineDamageOverTime(target, .75);
        applyOfflineStatus(second, target, 'bleed', 25, 5, 'Shadow Lunge');
        const receive = jest.spyOn(target, 'takeDamage');
        updateOfflineDamageOverTime(target, .25);
        expect(receive).toHaveBeenCalledTimes(1);
        expect(receive).toHaveBeenCalledWith(25, second);
        expect(target.stats.hp).toBe(975);
    } finally { second.dispose(); }
});

test('a lethal tick gives the attacker its real on-kill effect exactly once', () => {
    source.hasVampiricEffect = true; target.stats.hp = 5;
    applyOfflineStatus(source, target, 'bleed', 10, 5, 'Shadow Lunge');
    applyOfflineStatus(source, target, 'poison', 10, 8, 'Poison Coating');
    const killed = jest.spyOn(target, 'triggerOnKillEffects');
    Actor.prototype.update.call(target, 2, null, null, null);
    expect(target.state).toBe('DEAD');
    expect(killed).toHaveBeenCalledTimes(1);
    expect(killed).toHaveBeenCalledWith(source);
    expect(source.stats.hp).toBe(150);
    expect(target.bleedSource).toBeNull(); expect(target.poisonSource).toBeNull();
    Actor.prototype.update.call(target, 2, null, null, null);
    expect(killed).toHaveBeenCalledTimes(1);
});

test.each(['isMultiplayer', 'isRemote', 'engine'])('%s authority prevents local applications and ticks', authority => {
    const enable = actor => { if (authority === 'engine') actor.gameEngine = { isMultiplayer: true }; else actor[authority] = true; };
    enable(source);
    expect(applyOfflineStatus(source, target, 'bleed', 10, 5, 'Shadow Lunge')).toBe(false);
    source.isMultiplayer = source.isRemote = false; source.gameEngine = null;
    applyOfflineStatus(source, target, 'bleed', 10, 5, 'Shadow Lunge');
    enable(target);
    const receive = jest.spyOn(target, 'takeDamage');
    updateOfflineDamageOverTime(target, 2);
    expect(receive).not.toHaveBeenCalled(); expect(target.stats.hp).toBe(1000);
    expect(applyOfflineStatus(source, target, 'poison', 10, 8, 'Poison Coating')).toBe(false);
});

test('invalid timing cannot create an unbounded tick loop or non-finite damage', () => {
    applyOfflineStatus(source, target, 'bleed', 10, 5, 'Shadow Lunge');
    target.bleedTickTimer = Infinity;
    updateOfflineDamageOverTime(target, 1);
    expect(target.stats.hp).toBe(990);
    target.bleedTimer = Infinity;
    updateOfflineDamageOverTime(target, 1);
    expect(target.stats.hp).toBe(990); expect(target.bleedSource).toBeNull();
    expect(applyOfflineStatus(source, target, 'poison', Infinity, 8, 'Poison Coating')).toBe(false);
});

test.each([false, true])('Dirty Tricks extends actual tick lifetime once, inherited=%s', inherited => {
    source.talentRanks = { ROG_28: 5 };
    expect(applyOfflineStatus(source, target, 'bleed', 10, 2.5, inherited ? 'Serrated Edges' : 'Shadow Lunge', inherited)).toBe(true);
    expect(target.bleedTimer).toBe(3);
    source.talentRanks = {};
    updateOfflineDamageOverTime(target, 4);
    expect(target.stats.hp).toBe(970);
    expect(target.bleedTimer).toBe(0);
    updateOfflineDamageOverTime(target, 4);
    expect(target.stats.hp).toBe(970);
});
