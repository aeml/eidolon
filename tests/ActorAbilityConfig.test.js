import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';

describe('Actor ability config integration', () => {
    test('uses canonical mana/cooldown config for skill overrides', () => {
        const actor = new Actor('actor-fighter', CONSTANTS.ENTITIES.FIGHTER);
        actor.meshType = 'Fighter';
        actor.abilityName = 'Charge';
        actor.abilityManaCost = 1;
        actor.abilityMaxCooldown = 1;
        actor.stats.mana = 200;
        actor.stats.cooldownReduction = 0;
        actor.stats.manaCostReduction = 0;

        const ok = actor.useAbility(null, null, 'Whirlwind');

        expect(ok).toBe(true);
        expect(actor.cooldowns['Whirlwind']).toBe(8.0);
        expect(actor.stats.mana).toBe(170);
    });
});
