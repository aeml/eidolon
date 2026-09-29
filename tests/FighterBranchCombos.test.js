import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';

function fixture(branch = 'C') {
    const fighter = new Fighter('fighter-combo');
    fighter.mesh = new THREE.Group();
    fighter.level = 40; fighter.recalculateStats();
    fighter.stats.hp = fighter.stats.maxHp; fighter.stats.mana = fighter.stats.maxMana;
    const tree = CONSTANTS.SKILL_TREES.Fighter;
    fighter.unlockedSkills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree[`Branch${branch}`][`Tier${t}`].name)];
    const engine = { chunkManager: { getActiveEntities: () => [] }, floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    return { fighter, engine, cast: skill => fighter.useAbility(fighter.position.clone(), engine, skill) };
}

test.each(['normal', 'expired', 'cancelled', 'existing shield'])('Iron Will learned-branch ward: %s', kind => {
    const { fighter, cast } = fixture();
    try {
        if (kind === 'existing shield') {
            fighter.arcaneShieldActive = true; fighter.shieldHP = 777; fighter.arcaneShieldTimer = 60;
        }
        cast('Berserker Edge');
        if (kind === 'expired') fighter.lastOfflineFighterCast.at -= 3001;
        if (kind === 'cancelled') fighter.cancelAbilities();
        cast('Last Stand Rampage');
        if (kind === 'existing shield') {
            expect(fighter.shieldHP).toBe(777); expect(fighter.arcaneShieldTimer).toBe(60);
        } else if (kind === 'normal') {
            expect(fighter.shieldHP).toBe(Math.floor(fighter.stats.maxHp / 5));
            expect(fighter.arcaneShieldTimer).toBe(fighter.lastStandTimer);
            fighter.arcaneShieldActive = false; fighter.shieldHP = 0; fighter.arcaneShieldTimer = 0;
            fighter.cooldowns['Last Stand Rampage'] = 0;
            cast('Last Stand Rampage');
            expect(fighter.shieldHP).toBe(0);
        } else expect(fighter.shieldHP).toBe(0);
        expect(fighter.ironFortressTimer).toBe(0);
    } finally { fighter.dispose(); }
});

test('Guardian combo gives learned shield branch longer protection', () => {
    const { fighter, cast } = fixture('A');
    try {
        cast('Shield Slam'); cast('Guardian Roar');
        expect(fighter.guardianRoarTimer).toBe(15);
    } finally { fighter.dispose(); }
});

test('offline death clears the Iron Will ward and its visible status', () => {
    const { fighter, cast } = fixture();
    try {
        cast('Berserker Edge'); cast('Last Stand Rampage');
        expect(fighter.shieldHP).toBeGreaterThan(0);
        fighter.die();
        expect(fighter.arcaneShieldActive).toBe(false);
        expect(fighter.shieldHP).toBe(0); expect(fighter.arcaneShieldTimer).toBe(0);
    } finally { fighter.dispose(); }
});

test.each(['counter', 'expired'])('Fortress refreshes a paid Shield Slam: %s', kind => {
    const { fighter, engine, cast } = fixture('A');
    const enemy = new Actor('counter-enemy', {});
    try {
        enemy.position.set(0, 0, 2); enemy.stats.hp = 10000; enemy.stats.defense = 0; enemy.ccImmune = true;
        engine.chunkManager.getActiveEntities = () => [enemy];
        fighter.cooldowns['Shield Slam'] = 4; fighter.cooldowns.Whirlwind = 4;
        cast('Iron Fortress');
        expect(fighter.cooldowns['Shield Slam']).toBe(0); expect(fighter.cooldowns.Whirlwind).toBe(4);
        fighter.stats.damage = 50; fighter.stats.strength = 10;
        jest.spyOn(Math, 'random').mockReturnValue(.99);
        if (kind === 'expired') fighter.lastOfflineFighterCast.at -= 3001;
        const mana = fighter.stats.mana;
        cast('Shield Slam');
        expect(enemy.stats.hp).toBe(10000 - (kind === 'counter' ? 97 : 65));
        expect(fighter.stats.mana).toBe(mana - 25); expect(enemy.stunTimer).toBe(0);
        const cooldown = fighter.cooldowns['Shield Slam'];
        cast('Iron Fortress');
        expect(fighter.cooldowns['Shield Slam']).toBe(cooldown);
        fighter.cooldowns['Shield Slam'] = 0;
        cast('Shield Slam');
        expect(enemy.stats.hp).toBe(10000 - (kind === 'counter' ? 97 : 65) - 65);
    } finally { jest.restoreAllMocks(); enemy.dispose(); fighter.dispose(); }
});
