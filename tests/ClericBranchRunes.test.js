import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';
import { getAbilityRange } from '../src/core/AbilityRange.js';
const rows = JSON.parse(readFileSync('server/internal/game/testdata/cleric_branch_runes.json', 'utf8'));
const economy = { 'Guardian Embrace': [40, 30], 'Purifying Wave': [30, 12], 'Spirit Guardians Boost': [40, 20], 'Avenging Seraph': [60, 45], 'Blessing of Resolve': [35, 45], 'Blessing of Zeal': [35, 25], 'Mark of Weakness': [30, 20], "Heaven's Trumpet": [50, 60] };
function fixture(row) {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const source = new Cleric('branch-cleric'), target = new Imp('branch-enemy'), ally = new Fighter('branch-ally');
    source.mesh = new THREE.Group(); source.level = 100; source.unlockedSkills.push(row.skill);
    Object.assign(source.stats, { damage: 100, wisdom: 40, mana: 200, cooldownReduction: 0, critChanceBonus: 0 });
    source.skillRunes = { [row.skill]: row.rune }; source.cooldowns['Spirit Guardians'] = 12;
    target.mesh = new THREE.Group(); target.position.set(2, 0, 0); Object.assign(target.stats, { hp: 10000, maxHp: 10000, defense: 0 });
    ally.position.set(2, 0, 0); Object.assign(ally.stats, { hp: 1000, maxHp: 10000 }); ally.poisonTimer = 0;
    const spawned = [], engine = { effectScene: new THREE.Group(), floatingTextManager: { spawn: jest.fn() },
        chunkManager: { getActiveEntities: () => [target, ally] }, isHostileActorTarget: e => e === target,
        spawnTransientEffect: jest.fn(() => true), addEntity: e => spawned.push(e) };
    return { source, target, ally, engine, spawned, cast: () => source.useAbility(target.position.clone(), engine, row.skill),
        pulse: () => source.update(0, null, null, engine.chunkManager, engine.floatingTextManager),
        dispose: () => { spawned.forEach(e => e.dispose()); source.dispose(); target.dispose(); ally.dispose(); jest.restoreAllMocks(); } };
}
test.each(rows)('$rune reaches an ordinary paid effect', row => {
    const f = fixture(row);
    try {
        if (row.skill === 'Purifying Wave') f.ally.poisonTimer = 10;
        f.cast(); expect(f.source.stats.mana).toBe(200 - economy[row.skill][0]); expect(f.source.cooldowns[row.skill]).toBeCloseTo(economy[row.skill][1] * row.cooldown);
        if (row.skill === 'Guardian Embrace') {
            expect(f.source.guardianEmbraceTimer).toBe(10 * row.duration); expect(f.source.guardianEmbraceRadius).toBe(10 * row.radius);
            f.source.skillRunes = {}; f.pulse(); expect(f.ally.stats.hp).toBe(1000 + Math.floor(100 * row.healing));
        }
        if (row.skill === 'Purifying Wave') { expect(10000 - f.target.stats.hp).toBe(Math.floor(60 * row.damage)); expect(f.target.slowTimer).toBe(row.slowDuration); expect(f.ally.poisonTimer).toBe(0); }
        if (row.skill === 'Spirit Guardians Boost') {
            expect(f.source.spiritDuration).toBe(10 * row.duration); expect(f.source.spiritRadius).toBe(20 * row.radius);
            f.source.skillRunes = {}; f.pulse(); expect(10000 - f.target.stats.hp).toBe(Math.floor(80 * row.damage)); expect(f.target.slowFactor || 0).toBe(row.slow);
        }
        if (row.skill === 'Avenging Seraph') { expect(f.spawned).toHaveLength(1); const summon = f.spawned[0]; expect(summon.summonDamage).toBe(Math.floor(130 * row.damage)); expect(summon.stats.maxHp).toBe(Math.floor(900 * row.health)); expect(summon.summonRemaining).toBe(15 * row.duration); }
        if (row.skill === 'Blessing of Resolve') { expect(f.ally.blessingResolveTimer).toBe(20 * row.duration); expect(f.ally.blessingResolvePower).toBe(1); }
        if (row.skill === 'Blessing of Zeal') { expect(f.ally.blessingZealTimer).toBe(8 * row.duration); expect(f.ally.zealPower).toBe(1); expect(f.source.cooldowns['Spirit Guardians']).toBe(0); }
        if (row.skill === 'Mark of Weakness') { expect(f.target.markWeaknessTimer).toBe(10 * row.duration); expect(f.target.markWeaknessFactor).toBe(.2); expect(getAbilityRange(f.source, row.skill, 15)).toBe(15 * row.reach); }
        if (row.skill === "Heaven's Trumpet") { expect(10000 - f.target.stats.hp).toBe(Math.floor(120 * row.damage)); expect(f.target.stunTimer).toBe(row.stun); expect(f.target.markWeaknessTimer).toBe(5 * row.duration); expect(f.target.markWeaknessFactor).toBe(.5); }
    } finally { f.dispose(); }
});
test.each(rows)('$rune rejects without spending or triggering support', row => {
    const f = fixture(row);
    try { f.source.cooldowns[row.skill] = 10; f.cast(); expect(f.source.stats.mana).toBe(200); expect(f.target.stats.hp).toBe(10000); expect(f.spawned).toHaveLength(0); expect(f.source.spiritsActive).toBe(false); expect(f.source.cooldowns['Spirit Guardians']).toBe(12); }
    finally { f.dispose(); }
});
const radii = { 'Purifying Wave': 8, "Heaven's Trumpet": 12, 'Blessing of Resolve': 10, 'Blessing of Zeal': 10 };
test.each(['', 'weakness_distant'])('Mark rune %s admits actual body-edge targets before payment', rune => {
    for (const outside of [false, true]) {
        const f = fixture({ skill: 'Mark of Weakness', rune });
        try {
            f.target.position.x = 22.5 + f.target.radius + (outside ? .001 : -.001);
            f.cast(); const accepted = !!rune && !outside;
            expect((f.target.markWeaknessTimer || 0) > 0).toBe(accepted);
            expect(f.source.stats.mana).toBe(accepted ? 170 : 200);
            expect((f.source.cooldowns['Mark of Weakness'] || 0) > 0).toBe(accepted);
        } finally { f.dispose(); }
    }
});
test.each(rows.filter(row => radii[row.skill]))('$rune uses its body-padded footprint', row => {
    for (const outside of [false, true]) {
        const f = fixture(row);
        try {
            const support = row.skill.startsWith('Blessing'), actor = support ? f.ally : f.target;
            actor.position.x = radii[row.skill] * row.radius + actor.radius + (outside ? .001 : -.001);
            f.cast(); expect(support ? (actor.blessingResolveTimer || actor.blessingZealTimer || 0) > 0 : actor.stats.hp < 10000).toBe(!outside);
            expect(getAbilityAoeRadius('Cleric', row.skill, f.source)).toBe(radii[row.skill] * row.radius);
        } finally { f.dispose(); }
    }
});
