import { jest } from '@jest/globals';
import { Actor } from '../src/entities/Actor.js';

afterEach(() => jest.restoreAllMocks());

test.each([
    ['Rogue', 'ROG_32'], ['Rogue', 'ROG_39'], ['Fighter', 'FTR_39'], ['Wizard', 'WIZ_39']
])('%s %s affects actual offline basic attack damage, not unrelated Technique ranks', (className, talent) => {
    jest.spyOn(Math, 'random').mockReturnValue(.5); // 1.0 variance, then fixed critical roll.
    for (const rank of [0, 1, 5]) {
        const actor = new Actor('critical-attacker', {});
        const target = new Actor('critical-target', {});
        try {
            actor.meshType = className;
            actor.stats.damage = 100;
            actor.stats.critChanceBonus = .49;
            actor.talentRanks = { [talent]: rank, ROG_04: 5 };
            actor.lastAttackTime = 0;
            target.stats.hp = target.stats.maxHp = 1000;
            const callbacks = [];
            actor.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
            const onHit = jest.fn();
            expect(actor.attack(target, onHit)).toBe(true);
            expect(target.stats.hp).toBe(1000); // Still awaiting the real hit callback.
            callbacks[0]();
            const damage = rank > 0 ? 200 : 100;
            expect(target.stats.hp).toBe(1000 - damage);
            expect(onHit).toHaveBeenCalledWith(damage, target);
        } finally {
            actor.dispose();
            target.dispose();
        }
    }
});

test('offline basic critical composes once with Lucky before shield absorption and reflection', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(.5).mockReturnValueOnce(.05).mockReturnValue(.5);
    const actor = new Actor('lucky-attacker', {});
    const target = new Actor('shielded-target', {});
    try {
        actor.meshType = 'Rogue';
        actor.stats.damage = 100;
        actor.stats.hp = actor.stats.maxHp = 1000;
        actor.stats.critChanceBonus = 1;
        actor.talentRanks = { ROG_32: 5, ROG_39: 5 };
        actor.hasLuckyEffect = true;
        actor.lastAttackTime = 0;
        target.stats.hp = target.stats.maxHp = 1000;
        target.shieldHP = 50;
        target.hasThornsEffect = true;
        const callbacks = [];
        actor.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
        expect(actor.attack(target)).toBe(true);
        callbacks[0]();
        expect(target.shieldHP).toBe(0);
        expect(target.stats.hp).toBe(650); // 100 * Lucky 2 * critical 2 - shield 50.
        expect(actor.stats.hp).toBe(965); // 10% reflection of the 350 received.
    } finally {
        actor.dispose();
        target.dispose();
    }
});
