import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';

describe('Actor ability config integration', () => {
    test.each([
        [Fighter, 'Unbreakable Grip', { FTR_16: 5, FTR_28: 5 }, 29, 10.2],
        [Rogue, 'Smoke Bomb', { ROG_20: 5 }, 35, 13.6],
        [Wizard, 'Flame Whip', { WIZ_04: 5, WIZ_27: 5 }, 24, 6.8],
        [Cleric, 'Healing Light', { CLR_04: 5, CLR_27: 5 }, 20, 5.44]
    ])('%p retains canonical talent economy through its multiplayer skill override', (Class, skill, ranks, mana, cooldown) => {
        const actor = new Class(`override-${skill}`);
        actor.talentRanks = ranks;
        actor.unlockedSkills.push(skill);
        actor.stats.mana = mana;
        actor.stats.cooldownReduction = 0.2;
        actor.stats.manaCostReduction = 0;
        try {
            expect(actor.useSkill(skill, new THREE.Vector3(4, 0, 0), { isMultiplayer: true })).toBe(true);
            expect(actor.stats.mana).toBe(0);
            expect(actor.cooldowns[skill]).toBeCloseTo(cooldown, 8);
        } finally { actor.dispose(); }
    });
    test.each([
        ['Fighter', 'Charge', { FTR_02: 5, FTR_28: 5 }, 17, 3.4],
        ['Rogue', 'Piercing Throw', { ROG_02: 5 }, 15, 0.68],
        ['Wizard', 'Fireball', { WIZ_02: 5, WIZ_27: 5 }, 21, 1.36],
        ['Cleric', 'Spirit Guardians', { CLR_02: 5, CLR_27: 5 }, 32, 6.8]
    ])('%s accepts the exact talent-reduced cost and predicts its cooldown', (className, skill, ranks, mana, cooldown) => {
        const actor = new Actor(`economy-${className}`, className);
        actor.meshType = className;
        actor.talentRanks = ranks;
        actor.stats.mana = mana;
        actor.stats.cooldownReduction = 0.2;
        actor.stats.manaCostReduction = 0;
        try {
            expect(actor.useAbility(null, null, skill)).toBe(true);
            expect(actor.stats.mana).toBe(0);
            expect(actor.cooldowns[skill]).toBeCloseTo(cooldown, 8);
        } finally { actor.dispose(); }
    });
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
