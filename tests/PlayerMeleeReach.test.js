import { jest } from '@jest/globals';
import { Vector3 } from 'three';
import { getHeroBasicAttackReach } from '../src/core/BasicAttackReach.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';

test('melee reach follows replicated collision bodies while ranged basics retain their range', () => {
    const attacker = { authoritativeBodyRadius: 1.25, scale: 1 }, target = { radius: 8, scale: 4 };
    expect(getHeroBasicAttackReach('Fighter', attacker, target)).toBe(9.75);
    expect(getHeroBasicAttackReach('Cleric', attacker, target)).toBe(9.75);
    expect(getHeroBasicAttackReach('Wizard', attacker, { scale: 1 })).toBe(16);
    expect(getHeroBasicAttackReach('Rogue', attacker, { scale: 1 })).toBe(16);
});

test.each([Fighter, Cleric])('%p cannot begin or land an offline swing beyond contact reach', Hero => {
    const hero = new Hero('melee'), target = new Actor('recipient', {});
    const random = jest.spyOn(Math, 'random').mockReturnValue(.5);
    const callbacks = [];
    try {
        hero.position.set(300, 0, 200);
        target.position.copy(hero.position).add(new Vector3(4, 0, 0));
        target.stats.hp = target.stats.maxHp = 1000;
        hero.lastAttackTime = 0;
        hero.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
        expect(hero.attack(target)).toBe(false);
        expect(callbacks).toHaveLength(0);
        target.position.x = 303;
        expect(hero.attack(target)).toBe(true);
        target.position.x = 303.001;
        callbacks[0]();
        expect(target.stats.hp).toBe(1000);
    } finally { hero.dispose(); target.dispose(); random.mockRestore(); }
});
