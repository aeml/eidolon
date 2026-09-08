import { getBasicAttackDamage } from '../src/core/BasicAttackDamage.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';
import fs from 'node:fs';

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
