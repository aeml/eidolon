import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';
import { getAbilityRange } from '../src/core/AbilityRange.js';
import { advanceOfflineCharge } from '../src/skills/offlineCharge.js';
import { advanceOfflineShatteringCharge } from '../src/skills/offlineShatteringCharge.js';

const rows = JSON.parse(readFileSync('server/internal/game/testdata/fighter_branch_runes.json', 'utf8'));
const economy = { 'Guardian Roar': [35, 30], 'Sweeping Strike': [30, 4], 'Unbreakable Grip': [35, 15],
    'Juggernaut Charge': [30, 20], 'Berserker Edge': [0, 45], 'Shattering Charge': [30, 12],
    'Executioner Spin': [40, 15], 'Last Stand Rampage': [0, 120] };
function fixture(row) {
    const source = new Fighter('rune-fighter'), target = new Imp('rune-target'), ally = new Fighter('rune-ally');
    source.mesh = new THREE.Group(); source.level = 100; source.recalculateStats();
    Object.assign(source.stats, { damage: 100, strength: 40, mana: 100, maxMana: 1000, cooldownReduction: 0 });
    source.stats.hp = source.stats.maxHp;
    source.unlockedSkills = [row.skill]; source.skillRunes = { [row.skill]: row.rune };
    source.partyId = ally.partyId = 'party'; ally.position.set(20, 0, 0);
    target.position.set(2, 0, 0); target.stats.hp = target.stats.maxHp = 10000;
    target.weakPointMarkTimer = 5;
    const engine = { currentInstanceId: 'rune-room', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => [source, target, ally] }, isHostileActorTarget: e => e === target,
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    for (const actor of [source, target, ally]) actor.gameEngine = engine;
    return { source, target, ally, engine,
        cast: () => source.useAbility(target.position.clone(), engine, row.skill),
        dispose() { for (const actor of [source, target, ally]) actor.dispose(); } };
}
beforeEach(() => { jest.spyOn(Math, 'random').mockReturnValue(.99); jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test.each(rows)('$rune reaches paid combat/support behavior and keeps its tradeoff', row => {
    const f = fixture(row);
    try {
        f.source.cooldowns['Shattering Charge'] = row.skill === 'Shattering Charge' ? 0 : 12;
        f.cast();
        expect(f.source.stats.mana).toBe(100 - economy[row.skill][0]);
        expect(f.source.cooldowns[row.skill]).toBeCloseTo(economy[row.skill][1] * row.cooldown);
        if (row.skill === 'Juggernaut Charge' || row.skill === 'Shattering Charge') {
            f.source.skillRunes = {};
            if (row.skill === 'Juggernaut Charge') advanceOfflineCharge(f.source, 1, f.engine, e => e === f.ally);
            else advanceOfflineShatteringCharge(f.source, 1, f.engine, e => e === f.ally);
            if (row.skill === 'Juggernaut Charge') {
                const shape = f.engine.spawnTransientEffect.mock.calls.findLast(args => args[3]?.requestedAbilityName === row.skill && args[3]?.radius);
                expect(shape[3].radius).toBe(10 * row.radius);
            }
        }
        const base = { 'Sweeping Strike': 148, 'Unbreakable Grip': 140, 'Juggernaut Charge': 140, 'Shattering Charge': 195, 'Executioner Spin': 286 }[row.skill];
        if (base) {
            let damage = Math.floor(base * row.damage);
            if (row.skill === 'Executioner Spin') damage = Math.floor(damage * row.marked);
            expect(10000 - f.target.stats.hp).toBe(damage);
        }
        if (row.skill === 'Unbreakable Grip') {
            expect(f.target.rootTimer || 0).toBe(row.root);
            expect(getAbilityRange(f.source, row.skill, 10)).toBe(10 * row.reach);
        } else if (row.skill === 'Juggernaut Charge') {
            expect(f.target.slowFactor || 0).toBe(row.slow);
        } else if (row.skill === 'Shattering Charge') {
            expect(f.target.armorReductionTimer).toBe(5 * row.duration);
        } else if (row.skill === 'Guardian Roar') {
            expect(f.source.guardianRoarTimer).toBeCloseTo(10 * row.duration);
            expect(f.ally.guardianRoarTimer > 0).toBe(row.radius * 15 >= 20);
            expect(getAbilityAoeRadius('Fighter', row.skill, f.source)).toBe(15 * row.radius);
        } else if (row.skill === 'Berserker Edge') {
            expect(f.source.berserkerEdgeTimer).toBeCloseTo(15 * row.duration);
            expect(f.ally.berserkerEdgeActive || false).toBe(row.share && row.radius * 15 >= 20);
        } else if (row.skill === 'Last Stand Rampage') {
            expect(f.source.lastStandTimer).toBeCloseTo(10 * row.duration);
            expect(f.source.lastStandMultiplier).toBe(2);
            expect(f.source.cooldowns['Shattering Charge']).toBe(row.resetShattering ? 0 : 12);
        }
        expect(f.ally.stats.hp).toBe(f.ally.stats.maxHp);
    } finally { f.dispose(); }
});

test.each(rows)('$rune cannot bypass an existing cooldown', row => {
    const f = fixture(row);
    try { f.source.cooldowns[row.skill] = 10; f.cast();
        expect(f.target.stats.hp).toBe(10000); expect(f.source.stats.mana).toBe(100);
        expect(f.source.berserkerEdgeActive || false).toBe(false); expect(f.source.lastStandTimer || 0).toBe(0);
        expect(f.source.isCharging).toBeFalsy();
    } finally { f.dispose(); }
});

const radii = { 'Sweeping Strike': 5, 'Juggernaut Charge': 10, 'Shattering Charge': 16, 'Executioner Spin': 6 };
test.each(rows.filter(row => radii[row.skill]))('$rune actual impacts respect its body-padded edge', row => {
    for (const outside of [false, true]) {
        const f = fixture(row);
        try {
            f.target.position.x = radii[row.skill] * row.radius + f.target.radius + (outside ? .001 : -.001);
            const travelling = row.skill.endsWith('Charge');
            f.source.useAbility(travelling ? f.source.position.clone() : f.target.position.clone(), f.engine, row.skill);
            if (row.skill === 'Juggernaut Charge') advanceOfflineCharge(f.source, 1, f.engine, e => e === f.ally);
            if (row.skill === 'Shattering Charge') advanceOfflineShatteringCharge(f.source, 1, f.engine, e => e === f.ally);
            expect(f.target.stats.hp < 10000).toBe(!outside);
        } finally { f.dispose(); }
    }
});
