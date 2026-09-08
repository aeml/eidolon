import { Actor } from '../src/entities/Actor.js';

test.each(['DEAD', 'zero-health'])('%s recovery refills both bars but not cooldowns or rates', state => {
    const player = new Actor('recovery', { STATS: { STRENGTH: 10, DEXTERITY: 10,
        INTELLIGENCE: 10, WISDOM: 10, STAMINA: 10 } });
    try {
        player.state = state === 'DEAD' ? 'DEAD' : 'IDLE';
        player.stats.hp = state === 'DEAD' ? 1 : 0;
        player.stats.mana = 7;
        player.abilityCooldown = 8;
        player.respawn(-1.25, 200);
        expect(player.stats.hp).toBe(player.stats.maxHp);
        expect(player.stats.mana).toBe(player.stats.maxMana);
        expect(player.abilityCooldown).toBe(8);
        expect(player.stats.hpRegen).toBe(.1);
        expect(player.stats.manaRegen).toBe(.1);
        player.stats.mana = 9;
        player.respawn(-1.25, 200);
        expect(player.stats.mana).toBe(9);
    } finally { player.dispose(); }
});
