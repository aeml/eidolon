import { jest } from '@jest/globals';
import { Fighter } from '../src/entities/Fighter.js';
import { GameEngine } from '../src/core/GameEngine.js';

afterEach(() => jest.restoreAllMocks());
test.each(['syncPlayerSupportEffects', 'syncRemoteSupportEffects'])('%s presents real Roar protection and clears it', method => {
    const actor = new Fighter('roar-replica');
    const engine = Object.assign(Object.create(GameEngine.prototype), { player: actor, showRemoteSupportStateReadability: jest.fn() });
    try {
        actor.isMultiplayer = true;
        const hp = actor.stats.hp, armor = actor.stats.defense;
        engine[method](actor, { guardianRoarActive: true, guardianRoarDuration: 12 });
        expect(actor.guardianRoarReduction).toBe(.3);
        expect(engine.getActiveBuffs().find(b => b.id === 'guardian_roar'))
            .toMatchObject({ detail: '30% damage reduction', durationSeconds: 12 });
        actor.takeDamage(100);
        expect(actor.stats.hp).toBe(hp); expect(actor.stats.defense).toBe(armor);
        engine[method](actor, { guardianRoarDuration: 4 });
        expect(actor.guardianRoarReduction).toBe(.3);
        engine[method](actor, { guardianRoarActive: false, guardianRoarDuration: 0 });
        expect(actor.guardianRoarReduction).toBe(0);
        expect(engine.getActiveBuffs().some(b => b.id === 'guardian_roar')).toBe(false);
    } finally { actor.dispose(); }
});

test.each([[1, 0, 0, 930, 0], [1, 1, 0, 900, 0], [0, 0, 0, 900, 0],
    [1, 0, 50, 980, 0], [1, 0, 100, 1000, 30]])(
    'Roar impact deadline and shield order timer%s elapsed%s shield%s', (timer, elapsed, shield, hp, remaining) => {
        const actor = new Fighter('roar-impact');
        try {
            actor.guardianRoarTimer = timer; actor.guardianRoarReduction = .3;
            actor.stats.hp = actor.stats.maxHp = 1000; actor.shieldHP = shield;
            actor.takeDamage(100, null, elapsed);
            expect(actor.stats.hp).toBe(hp); expect(actor.shieldHP).toBe(remaining);
        } finally { actor.dispose(); }
    });

test('Roar rounds every incoming amount like the server and composes after Fortress', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const actor = new Fighter('roar-rounding');
    try {
        actor.guardianRoarTimer = 5; actor.guardianRoarReduction = .3;
        for (const fortress of [false, true]) for (let amount = 1; amount <= 201; amount++) {
            actor.ironFortressTimer = fortress ? 5 : 0; actor.ironFortressReduction = .2;
            actor.stats.hp = actor.stats.maxHp = 1000;
            actor.takeDamage(amount);
            const protectedAmount = fortress ? Math.floor(amount * 80 / 100) : amount;
            expect(1000 - actor.stats.hp).toBe(Math.floor(protectedAmount * 70 / 100));
        }
    } finally { actor.dispose(); }
});

test('slow-frame Roar periodic hits respect the actual protection deadline', () => {
    const actor = new Fighter('roar-periodic');
    try {
        actor.baseStats.vitality = 100; actor.recalculateStats();
        actor.stats.hp = actor.stats.maxHp; actor.guardianRoarTimer = 1.5; actor.guardianRoarReduction = .3;
        actor.bleedTimer = 2; actor.bleedTickTimer = 0; actor.bleedTickDamage = 100; actor.stunTimer = 3;
        const original = actor.takeDamage.bind(actor), hits = [];
        jest.spyOn(actor, 'takeDamage').mockImplementation((...args) => {
            const hp = actor.stats.hp; original(...args); hits.push(hp - actor.stats.hp);
        });
        actor.update(2, null, null, null, null);
        expect(hits).toEqual([70, 100]);
        expect(actor.guardianRoarTimer).toBe(0); expect(actor.guardianRoarReduction).toBe(0);
    } finally { actor.dispose(); }
});
