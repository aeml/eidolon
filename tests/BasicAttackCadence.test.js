import { basicAttackInterval } from '../src/core/BasicAttackCadence.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';

test.each(['Wizard', 'Fighter', 'Rogue', 'Cleric'])('%s has a monotonic two-second base and unchanged one-second floor', className => {
    let previous = Infinity;
    for (let dex = 0; dex <= 300; dex++) {
        const interval = basicAttackInterval(dex, className);
        expect(interval).toBeGreaterThanOrEqual(1);
        expect(interval).toBeLessThanOrEqual(previous);
        previous = interval;
    }
    expect(basicAttackInterval(10, className)).toBeCloseTo(2 / 1.05);
    expect(basicAttackInterval(199, className)).toBeGreaterThan(1);
    expect(basicAttackInterval(200, className)).toBe(1);
});
test.each([Wizard, Fighter, Rogue, Cleric])('%p initializes and recalculates its actual offline cadence without resource grants', Class => {
    const player = new Class('cadence');
    try {
        expect(player.stats.attackSpeed).toBe(basicAttackInterval(player.baseStats.dexterity, Class.name));
        player.stats.hp = player.stats.mana = 1;
        player.baseStats.dexterity = 10;
        player.recalculateStats();
        expect(player.stats.attackSpeed).toBeCloseTo(2 / 1.05);
        expect(player.stats.hp).toBe(1);
        expect(player.stats.mana).toBe(1);
        expect(player.stats.hpRegen).toBeCloseTo(player.baseStats.vitality * .01);
        expect(player.stats.manaRegen).toBeCloseTo(player.baseStats.wisdom * .01);
    } finally { player.dispose(); }
});
test.each(['Skeleton', 'Imp', 'Actor', 'AvengingSeraph'])('%s does not acquire the hero curve', className => {
    expect(basicAttackInterval(10, className)).toBeCloseTo(5 / 1.2);
});
test.each([NaN, Infinity, -100])('invalid/negative Dexterity %s cannot bypass cadence', dex => {
    expect(basicAttackInterval(dex, 'Wizard')).toBe(2);
});

test('non-player constructor and recalculation retain both legacy timing paths', () => {
    const actor = new Actor('enemy-cadence', { STATS: { STRENGTH: 15, DEXTERITY: 9,
        INTELLIGENCE: 6, WISDOM: 6, STAMINA: 15 } });
    try {
        expect(actor.stats.attackSpeed).toBeCloseTo(1 + 9 / 5 * .05);
        actor.recalculateStats();
        expect(actor.stats.attackSpeed).toBeCloseTo(5 / 1.18);
    } finally { actor.dispose(); }
});
