import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Imp } from '../src/entities/Imp.js';
import { getWizardAbilityDamageMultiplier, WIZARD_DAMAGE_PROFILES } from '../src/skills/wizardAbilityDamage.js';
import { CONSTANTS } from '../src/core/Constants.js';

// The same contract is checked against real server casts, not only metadata.
const contract = JSON.parse(readFileSync('server/internal/game/testdata/wizard_damage.json', 'utf8'));
const spells = contract.map(p => [p.skill, p.id, p.base + 40 * p.intelligence, p.kind, p.count]);

test.each(contract)('$skill uses the same base coefficients as the actual server contract', profile => {
    expect(WIZARD_DAMAGE_PROFILES[profile.skill]).toEqual({ base: profile.base, intelligence: profile.intelligence });
});

function fixture() {
    const source = new Wizard('mastery-source'), target = new Imp('mastery-target'), spawned = [];
    source.mesh = new THREE.Group(); source.level = 100;
    source.stats.intelligence = 40; source.stats.mana = source.stats.maxMana = 10000;
    source.unlockedSkills.push(...spells.map(([skill]) => skill), 'Spell Focus');
    target.position.set(0, 0, 4); target.stats.hp = target.stats.maxHp = 10000;
    const hit = jest.spyOn(target, 'takeDamage');
    const engine = { isMultiplayer: false, currentInstanceId: '',
        chunkManager: { getActiveEntities: () => [target] },
        isHostileActorTarget: entity => entity === target,
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
        addEntity: entity => spawned.push(entity) };
    return { source, target, spawned, hit, engine,
        cast: skill => source.useAbility(target.position.clone(), engine, skill),
        dispose: () => { for (const entity of spawned) entity.dispose(); source.dispose(); target.dispose(); } };
}

beforeEach(() => { jest.useFakeTimers(); jest.spyOn(Math, 'random').mockReturnValue(.5); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe.each(spells)('%s named Mastery', (skill, id, base, kind, count) => {
    test('canonical metadata describes the actual named damage upgrade', () => {
        const talent = CONSTANTS.PASSIVE_TALENTS.Wizard.find(t => t.id === id);
        expect(talent.abilityDamage).toEqual({ skill, damage: .04 });
        expect(talent.maxRank).toBe(5);
    });
    test.each([[0, 1], [1, 1.04], [5, 1.2], [99, 1.2], [-1, 1], [Infinity, 1]]
        .flatMap(([rank, multiplier]) => [[rank, multiplier, false], [rank, multiplier, true]]))(
        'paid cast at rank %s snapshots damage multiplier %s, Focus=%s', (rank, multiplier, focused) => {
            const f = fixture();
            try {
                f.source.talentRanks = { [id]: rank };
                if (focused) {
                    f.source.talentRanks.WIZ_15 = 5;
                    f.cast('Spell Focus');
                    expect(f.source.spellFocusMultiplier).toBe(3);
                }
                const mana = f.source.stats.mana;
                const expected = Math.trunc(base * (multiplier * (focused ? 3 : 1)));
                f.cast(skill);
                expect(f.source.stats.mana).toBeLessThan(mana);
                expect(f.source.spellFocusActive).toBe(false);
                // Delayed missiles must retain cast-time training, not current ranks.
                f.source.talentRanks = {};
                f.source.stats.intelligence = 999;
                jest.advanceTimersByTime(450);
                if (kind === 'instant') {
                    expect(f.hit).toHaveBeenCalledTimes(count);
                    expect(f.hit.mock.calls[0][0]).toBe(expected);
                    expect(10000 - f.target.stats.hp).toBe(expected);
                } else {
                    expect(f.spawned).toHaveLength(count);
                    for (const entity of f.spawned) expect(entity.damage).toBe(expected);
                    if (kind === 'zone') {
                        f.spawned[0].performTick(f.engine.chunkManager);
                        expect(f.hit).toHaveBeenCalledTimes(1);
                        expect(f.hit.mock.calls[0][0]).toBe(expected);
                    } else {
                        for (const projectile of f.spawned) {
                            const previousHits = f.hit.mock.calls.length;
                            for (let frame = 0; frame < 600 && projectile.isActive && f.hit.mock.calls.length === previousHits; frame++) {
                                projectile.update(.02, null, null, f.engine.chunkManager, f.engine.floatingTextManager, f.engine);
                            }
                            expect(f.hit.mock.calls.length).toBeGreaterThan(previousHits);
                            expect(f.hit.mock.calls[previousHits][0]).toBe(expected);
                        }
                    }
                }
            } finally { f.dispose(); }
        });
});

test.each([
    [{ WIZ_1: 5 }, 1.2], [{ WIZ_01: 2, WIZ_1: 5 }, 1.2],
    [{ WIZ_01: 5, WIZ_1: 5 }, 1.2], [{ WIZ_01: 1.9 }, 1.04],
    [{ WIZ_01: NaN, WIZ_1: Infinity }, 1], [{ WIZ_03: 5, FTR_01: 5 }, 1]
])('named Mastery reads bounded ranks without double-counting aliases: %j', (ranks, multiplier) => {
    const source = { meshType: 'Wizard', talentRanks: ranks, spellFocusActive: true, spellFocusMultiplier: 3 };
    const before = { ...ranks };
    expect(getWizardAbilityDamageMultiplier(source, 'Fireball')).toBeCloseTo(multiplier);
    expect(source.talentRanks).toEqual(before);
    expect(source.spellFocusActive).toBe(true);
    for (const skill of ['Spell Focus', 'Time Warp', 'Teleport', 'Arcane Shield', 'unknown']) {
        expect(getWizardAbilityDamageMultiplier(source, skill)).toBe(1);
    }
});

test.each([{}, { meshType: 'Fighter' }, { meshType: 'Wizard', isRemote: true },
    { meshType: 'Wizard', isMultiplayer: true }, { meshType: 'Wizard', gameEngine: { isMultiplayer: true } }])(
    'wrong-class or authoritative sources never apply local training: %j', source => {
        source.talentRanks = { WIZ_01: 5 };
        expect(getWizardAbilityDamageMultiplier(source, 'Fireball')).toBe(1);
    });

test('focused Fireball composes its own Mastery once before actual critical shield absorption', () => {
    const f = fixture();
    try {
        f.source.talentRanks = { WIZ_01: 5, WIZ_15: 5 };
        f.source.stats.critChanceBonus = 1;
        f.target.shieldHP = 500; f.target.arcaneShieldActive = true;
        f.cast('Spell Focus');
        expect(f.source.spellFocusMultiplier).toBe(3);
        f.cast('Fireball');
        expect(f.source.spellFocusActive).toBe(false);
        const projectile = f.spawned[0];
        const amplified = Math.trunc(100 * (1.2 * 3));
        expect(projectile.damage).toBe(amplified);
        f.source.talentRanks = {};
        for (let i = 0; i < 120 && projectile.isActive && !f.hit.mock.calls.length; i++) {
            projectile.update(.02, null, null, f.engine.chunkManager, f.engine.floatingTextManager, f.engine);
        }
        expect(f.hit).toHaveBeenCalledTimes(1);
        expect(f.hit.mock.calls[0][0]).toBe(amplified * 2);
        expect(f.target.shieldHP).toBe(0);
        expect(10000 - f.target.stats.hp).toBe(amplified * 2 - 500);
    } finally { f.dispose(); }
});

test.each(['mana', 'locked', 'cooldown', 'dead', 'stunned', 'remote', 'multiplayer', 'engine'])('%s rejection cannot grant trained offline damage', reason => {
    const f = fixture();
    try {
        f.source.talentRanks = { WIZ_11: 5 };
        if (reason === 'mana') f.source.stats.mana = 0;
        if (reason === 'locked') f.source.unlockedSkills = [];
        if (reason === 'cooldown') f.source.cooldowns['Scorch Beam'] = 10;
        if (reason === 'dead') f.source.state = 'DEAD';
        if (reason === 'stunned') f.source.stunTimer = 10;
        if (reason === 'remote') f.source.isRemote = true;
        if (reason === 'multiplayer') f.source.isMultiplayer = true;
        if (reason === 'engine') f.engine.isMultiplayer = true;
        f.cast('Scorch Beam'); jest.advanceTimersByTime(450);
        expect(f.hit).not.toHaveBeenCalled(); expect(f.spawned).toEqual([]);
    } finally { f.dispose(); }
});
