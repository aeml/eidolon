import { Actor } from '../src/entities/Actor.js';
import { PASSIVE_REGEN_PER_STAT } from '../src/core/Regeneration.js';

function actor() {
    return new Actor('regen', { STATS: { STRENGTH: 10, DEXTERITY: 10,
        INTELLIGENCE: 10, WISDOM: 10, STAMINA: 10 } });
}

test('constructor and recalculated rates use .01 per point', () => {
    const player = actor();
    try {
        expect(PASSIVE_REGEN_PER_STAT).toBe(.01);
        expect(player.stats.hpRegen).toBe(.1);
        expect(player.stats.manaRegen).toBe(.1);
        player.baseStats.vitality = 73;
        player.baseStats.wisdom = 251;
        player.recalculateStats();
        expect(player.stats.hpRegen).toBeCloseTo(.73);
        expect(player.stats.manaRegen).toBeCloseTo(2.51);
    } finally { player.dispose(); }
});

test('offline ticks retain fractional recovery and cap resources', () => {
    const player = actor();
    try {
        player.stats.hp = player.stats.mana = 50;
        for (let i = 0; i < 10; i++) player.update(1, null, null, null);
        expect(player.stats.hp).toBeCloseTo(51);
        expect(player.stats.mana).toBeCloseTo(51);
        player.stats.hp = player.stats.mana = 99.95;
        player.update(1, null, null, null);
        expect(player.stats.hp).toBe(100);
        expect(player.stats.mana).toBe(100);
    } finally { player.dispose(); }
});

test.each(['isMultiplayer', 'isRemote', 'dead', 'zeroHealth'])('%s prevents local passive recovery', mode => {
    const player = actor();
    try {
        player.stats.hp = player.stats.mana = 50;
        if (mode === 'dead') player.state = 'DEAD';
        else if (mode === 'zeroHealth') player.stats.hp = 0;
        else player[mode] = true;
        const hp = player.stats.hp;
        for (let i = 0; i < 10; i++) player.update(1, null, null, null);
        expect(player.stats.hp).toBe(hp);
        expect(player.stats.mana).toBe(50);
    } finally { player.dispose(); }
});
