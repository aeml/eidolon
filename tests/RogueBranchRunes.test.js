import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityAoeRadius, getAbilityAoeArc } from '../src/skills/abilityRadii.js';
import { getAbilityRange } from '../src/core/AbilityRange.js';
const rows = JSON.parse(readFileSync('server/internal/game/testdata/rogue_branch_runes.json', 'utf8'));
const economy = { 'Weak Point Mark': [25, 12], 'Death Spiral': [35, 20], 'Serrated Edges': [30, 20], 'Blade Storm': [30, 15], 'Phantom Volley': [40, 18], 'Poison Coating': [30, 30], 'Smoke Bomb': [35, 20], Tripwire: [25, 15] };
function fixture(row) {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const source = new Rogue('branch-rogue'), target = new Imp('branch-target');
    source.mesh = new THREE.Group(); source.level = 100; source.unlockedSkills.push(row.skill);
    Object.assign(source.stats, { damage: 100, dexterity: 40, mana: 100, cooldownReduction: 0, critChanceBonus: 0 });
    source.skillRunes = { [row.skill]: row.rune };
    source.cooldowns['Fan of Knives'] = 12; if (row.skill !== 'Tripwire') source.cooldowns.Tripwire = 12;
    target.mesh = new THREE.Group(); target.position.set(2, 0, 0); Object.assign(target.stats, { hp: 10000, maxHp: 10000, defense: 0 });
    const projectiles = [], tasks = [], engine = { effectScene: new THREE.Group(), floatingTextManager: { spawn: jest.fn() },
        chunkManager: { getActiveEntities: () => [target] }, isHostileActorTarget: e => e === target,
        spawnTransientEffect: jest.fn(() => true), addEntity: p => projectiles.push(p) };
    source.scheduleTask = (fn, delay) => { tasks.push({ fn, delay }); return tasks.length; };
    return { source, target, engine, projectiles, tasks, cast: () => source.useAbility(target.position.clone(), engine, row.skill),
        dispose: () => { projectiles.forEach(p => p.dispose()); source.dispose(); target.dispose(); jest.restoreAllMocks(); } };
}
test.each(rows)('$rune reaches a paid action with its distinct effect', row => {
    const f = fixture(row);
    try {
        f.cast(); expect(f.source.stats.mana).toBe(100 - economy[row.skill][0]); expect(f.source.cooldowns[row.skill]).toBeCloseTo(economy[row.skill][1] * row.cooldown);
        if (row.skill === 'Weak Point Mark') { expect(f.target.weakPointMarkTimer).toBe(10 * row.duration); expect(getAbilityRange(f.source, row.skill, 10)).toBe(10 * row.reach); }
        if (row.skill === 'Death Spiral') { expect(10000 - f.target.stats.hp).toBe(Math.floor(200 * row.damage)); expect(getAbilityAoeRadius('Rogue', row.skill, f.source)).toBe(4 * row.radius); }
        if (row.skill === 'Serrated Edges') { expect(f.source.serratedEdgesTimer).toBe(10 * row.duration); expect(f.source.cooldowns['Fan of Knives']).toBe(row.resetFan ? 0 : 12); }
        if (row.skill === 'Poison Coating') { expect(f.source.poisonCoatingTimer).toBe(15 * row.duration); expect(f.source.cooldowns.Tripwire).toBe(row.resetTripwire ? 0 : 12); }
        if (row.skill === 'Smoke Bomb') { expect(f.target.slowTimer).toBe(5 * row.duration); expect(f.target.slowFactor).toBe(row.slow); expect(f.target.accuracyReductionFactor).toBe(row.accuracy); }
        if (row.skill === 'Blade Storm' || row.skill === 'Phantom Volley') {
            f.source.skillRunes = {}; f.source.stats.damage = 999; f.source.stats.dexterity = 999;
            f.tasks.forEach(t => t.fn()); expect(f.projectiles).toHaveLength(row.skill === 'Blade Storm' ? 5 : row.count);
            for (const p of f.projectiles) expect(p.damage).toBe(Math.floor((row.skill === 'Blade Storm' ? 50 : 105) * row.damage));
            if (row.skill === 'Blade Storm') {
                expect(f.projectiles[0].maxTravelDistance).toBe(10 * row.radius);
                const first = f.projectiles[0].velocity.clone().normalize(), last = f.projectiles[4].velocity.clone().normalize();
                expect(first.angleTo(last)).toBeCloseTo(Math.PI / 2 * row.spread);
            } else { expect(f.tasks.at(-1).delay).toBeCloseTo((row.count - 1) * row.spacing * 1000); expect(f.projectiles[0].projectilePierce).toBe(row.pierce); }
        }
        if (row.skill === 'Tripwire') {
            expect(f.source.traps[0].damage).toBe(Math.floor(60 * row.damage)); f.source.skillRunes = {};
            f.source.update(0, null, null, f.engine.chunkManager, f.engine.floatingTextManager, f.engine);
            expect(10000 - f.target.stats.hp).toBe(Math.floor(60 * row.damage)); expect(f.target.rootTimer).toBe(row.root);
        }
    } finally { f.dispose(); }
});
test.each(rows)('$rune rejection spends and resets nothing', row => {
    const f = fixture(row);
    try { f.source.cooldowns[row.skill] = 10; f.cast(); expect(f.source.stats.mana).toBe(100); expect(f.target.stats.hp).toBe(10000); expect(f.projectiles).toHaveLength(0); expect(f.source.traps).toHaveLength(0); expect(f.source.cooldowns['Fan of Knives']).toBe(12); if (row.skill !== 'Tripwire') expect(f.source.cooldowns.Tripwire).toBe(12); }
    finally { f.dispose(); }
});
test.each(rows.filter(r => ['Death Spiral', 'Smoke Bomb'].includes(r.skill)))('$rune respects its body-padded boundary', row => {
    for (const outside of [false, true]) {
        const f = fixture(row);
        try {
            const radius = (row.skill === 'Death Spiral' ? 4 : 5) * row.radius;
            f.target.position.x = radius + f.target.radius + (outside ? .001 : -.001); f.cast();
            expect(row.skill === 'Death Spiral' ? f.target.stats.hp < 10000 : f.target.accuracyReductionTimer > 0).toBe(!outside);
            expect(getAbilityAoeRadius('Rogue', row.skill, f.source)).toBe(radius); expect(getAbilityAoeArc('Rogue', row.skill, f.source)).toBe(2 * Math.PI);
        } finally { f.dispose(); }
    }
});

test('pending Barrage cancels after controlled actor replacement', () => {
    const f = fixture(rows.find(row => row.rune === 'phantomvolley_barrage'));
    try { f.engine.player = f.source; f.cast(); f.engine.player = {}; f.tasks.forEach(t => t.fn()); expect(f.projectiles).toHaveLength(0); }
    finally { f.dispose(); }
});
test.each([false, true])('Death Spiral consumes the authoritative wound budget, set=%s', set => {
    const f = fixture(rows.find(row => row.rune === 'deathspiral_wide'));
    try {
        f.target.bleedStacks = 7; f.target.bleedTimer = 4.2; f.target.bleedTickDamage = 11;
        f.target.poisonTimer = 2.2; f.target.poisonTickDamage = 13;
        if (set) f.source.activeSetBonuses = { assassin: { specials: { deathSpiralConsume: 1 } } };
        f.cast(); expect(10000 - f.target.stats.hp).toBe(150 + (set ? 11 * 5 + 13 * 3 : 20));
        expect(f.target.bleedTimer).toBe(0); expect(f.target.bleedTickDamage).toBe(0);
        expect(f.target.poisonTimer).toBe(set ? 0 : 2.2);
    } finally { f.dispose(); }
});
