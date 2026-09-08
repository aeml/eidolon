import { getBasicAttackDamage } from '../src/core/BasicAttackDamage.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';
import fs from 'node:fs';
import { jest } from '@jest/globals';
import { Actor } from '../src/entities/Actor.js';

const sharedFixtures = JSON.parse(fs.readFileSync('server/internal/game/testdata/basic_attack_damage.json', 'utf8'));

test.each(sharedFixtures)('$className matches the shared authoritative equipment fixture', fixture => {
    expect(getBasicAttackDamage(fixture.className, fixture.stats, fixture.flatDamage)).toBe(fixture.damage);
});

const stats = { strength: 19, dexterity: 27, intelligence: 39, wisdom: 47 };

test.each([['Fighter', 4], ['Rogue', 6], ['Wizard', 9], ['Cleric', 11]])(
    '%s uses its own primary stat and server integer rounding', (name, expected) => {
        expect(getBasicAttackDamage(name, stats)).toBe(expected);
        expect(getBasicAttackDamage(name, stats, 17)).toBe(expected + 17);
    });

test.each(['Actor', 'Skeleton', 'AvengingSeraph', 'DwarfSalesman'])(
    '%s retains non-player damage', name => {
        expect(getBasicAttackDamage(name, stats, 17)).toBe(55);
    });

test.each([Fighter, Rogue, Wizard, Cleric])('%p construction and equipment refresh keep hero damage authoritative', Hero => {
    const hero = new Hero('damage-parity');
    try {
        expect(hero.stats.damage).toBe(getBasicAttackDamage(Hero.name, hero.baseStats));
        Object.assign(hero.baseStats, stats);
        hero.equipment = { mainHand: { level: 1, stats: { damage: 17 } } };
        hero.recalculateStats();
        expect(hero.stats.damage).toBe(getBasicAttackDamage(Hero.name, stats, 17));
    } finally { hero.dispose(); }
});

test.each([Fighter, Rogue, Wizard, Cleric])('%p applies the derived damage through the actual offline hit callback', Hero => {
    const hero = new Hero('damage-hit'), target = new Actor('damage-recipient', {});
    const random = jest.spyOn(Math, 'random').mockReturnValue(.5);
    try {
        Object.assign(hero.baseStats, stats);
        hero.recalculateStats();
        hero.lastAttackTime = 0;
        target.stats.hp = target.stats.maxHp = 1000;
        const callbacks = [];
        hero.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
        expect(hero.attack(target)).toBe(true);
        expect(target.stats.hp).toBe(1000);
        callbacks[0]();
        expect(target.stats.hp).toBe(1000 - getBasicAttackDamage(Hero.name, stats));
    } finally {
        hero.dispose();
        target.dispose();
        random.mockRestore();
    }
});
