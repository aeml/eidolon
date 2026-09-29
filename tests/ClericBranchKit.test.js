import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { CONSTANTS } from '../src/core/Constants.js';

function fixture(branch) {
    const p = new Cleric('kit-cleric'), target = new Imp('kit-enemy'), ally = new Fighter('kit-ally');
    const tree = CONSTANTS.SKILL_TREES.Cleric;
    p.unlockedSkills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree[`Branch${branch}`][`Tier${t}`].name)];
    p.mesh = new THREE.Group(); p.level = 40; p.baseStats.intelligence = 100;
    p.recalculateStats(); p.stats.mana = p.stats.maxMana;
    target.position.set(0, 0, 2); target.stats.hp = 10000; target.stats.defense = 0; target.ccImmune = true;
    ally.position.set(1, 0, 0);
    const engine = { effectScene: new THREE.Group(), chunkManager: { getActiveEntities: () => [target, ally] },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() },
        isHostileActorTarget: e => e === target };
    return { p, target, ally, engine, cast: skill => p.useAbility(target.position.clone(), engine, skill),
        dispose: () => { p.dispose(); target.dispose(); ally.dispose(); jest.restoreAllMocks(); } };
}

test.each([
    ['A', 'Healing Light', 'Guardian Embrace'],
    ['B', 'Consecrated Ground', 'Radiant Strike'],
    ['C', 'Blessing of Zeal', 'Spirit Guardians']
])('learned Cleric %s consumes its combo exactly once', (branch, first, second) => {
    const { p, target, ally, engine, cast, dispose } = fixture(branch);
    try {
        jest.spyOn(Math, 'random').mockReturnValue(.99);
        if (branch === 'C') { p.cooldowns['Spirit Guardians'] = 10; ally.cooldowns['Spirit Guardians'] = 10; }
        cast(first);
        if (branch === 'C') {
            expect(p.cooldowns['Spirit Guardians']).toBe(0);
            expect(ally.cooldowns['Spirit Guardians']).toBe(10);
            p.cooldowns['Spirit Guardians'] = 10;
            cast(first); // Rejected while Zeal is cooling down: no second refresh.
            expect(p.cooldowns['Spirit Guardians']).toBe(10);
        }
        for (let i = 0; i < 2; i++) {
            p.cooldowns[second] = 0; p.invulnerabilityTimer = 0;
            p.stats.damage = 50; p.stats.wisdom = 25;
            const hp = target.stats.hp, mana = p.stats.mana;
            cast(second);
            expect(p.stats.mana).toBeLessThan(mana); expect(p.cooldowns[second]).toBeGreaterThan(0);
            if (branch === 'A') {
                expect(p.invulnerabilityTimer).toBe(i ? 0 : 3);
                expect(ally.invulnerabilityTimer || 0).toBe(0);
            } else if (branch === 'B') {
                expect(hp - target.stats.hp).toBe(i ? 100 : 200);
                expect(target.markWeaknessTimer).toBe(0);
            } else {
                expect(p.spiritBoosted).toBe(!i);
                expect(p.spiritRadius).toBe(i ? 16 : 20);
                expect(p.spiritEffect.effectRadius).toBe(p.spiritRadius);
                if (!i) {
                    const ring = engine.spawnTransientEffect.mock.calls.filter(call => call[0] === 'ring').at(-1);
                    expect(ring[3].radius).toBe(20);
                }
            }
        }
    } finally { dispose(); }
});

test.each(['expired', 'cancelled'])('Cleric combo does not survive %s history', mode => {
    const { p, cast, dispose } = fixture('A');
    try {
        cast('Healing Light');
        if (mode === 'expired') p.lastOfflineClericCast.at -= 3001;
        else p.cancelAbilities();
        cast('Guardian Embrace');
        expect(p.invulnerabilityTimer || 0).toBe(0);
    } finally { dispose(); }
});

test.each(['normal', 'immune', 'wall', 'existing'])('Purifying Wave cleanses allies and delivers a legal pressure pulse: %s', mode => {
    const { p, target, ally, engine, cast, dispose } = fixture('A');
    try {
        jest.spyOn(Math, 'random').mockReturnValue(.99);
        target.ccImmune = mode === 'immune';
        target.position.set(0, 0, 6);
        ally.poisonTimer = 10;
        if (mode === 'existing') { target.slowTimer = 9; target.slowFactor = .6; }
        if (mode === 'wall') {
            engine.currentInstanceId = 'wave-wall'; engine.currentInstanceType = 'dungeon';
            engine.currentDungeonLayout = { walkRects: [{ x: 0, z: 0, width: 10, height: 4 }, { x: 0, z: 6, width: 10, height: 4 }] };
        }
        cast('Purifying Wave');
        expect(ally.poisonTimer).toBe(0);
        expect(target.stats.hp).toBe(mode === 'wall' ? 10000 : 10000 - 20 - p.stats.wisdom);
        expect(target.slowTimer).toBe(mode === 'existing' ? 9 : mode === 'normal' ? 2 : 0);
        if (mode === 'normal' || mode === 'existing') expect(target.slowFactor).toBe(mode === 'normal' ? .3 : .6);
    } finally { dispose(); }
});

test('Divine Storm uses rune/Ministry area and starter duration, not unlearned Boost technique', () => {
    const { p, cast, dispose } = fixture('C');
    try {
        p.talentRanks = { CLR_02: 5, CLR_16: 1, CLR_34: 5 };
        p.skillRunes = { 'Spirit Guardians': 'spirits_expanded' };
        cast('Blessing of Zeal'); cast('Spirit Guardians');
        expect(p.spiritRadius).toBeCloseTo(30 * 1.15);
        expect(p.spiritDuration).toBeCloseTo(8 * 1.1);
        expect(p.spiritEffect.effectRadius).toBeCloseTo(p.spiritRadius);
    } finally { dispose(); }
});

test.each(['ally', 'wall', 'range', 'remote', 'instance'])('invalid Mark target preserves mana and combo history: %s', mode => {
    const { p, target, ally, engine, cast, dispose } = fixture('C');
    try {
        cast('Blessing of Zeal');
        const mana = p.stats.mana, history = p.lastOfflineClericCast;
        if (mode === 'ally') engine.chunkManager.getActiveEntities = () => [ally];
        if (mode === 'range') target.position.z = 50;
        if (mode === 'remote') target.isRemote = true;
        if (mode === 'instance') target.instanceId = 'elsewhere';
        if (mode === 'wall') {
            target.position.z = 6;
            engine.currentInstanceId = 'mark-wall'; engine.currentInstanceType = 'dungeon';
            engine.currentDungeonLayout = { walkRects: [{ x: 0, z: 0, width: 10, height: 4 }, { x: 0, z: 6, width: 10, height: 4 }] };
        }
        cast('Mark of Weakness');
        expect(p.stats.mana).toBe(mana); expect(p.lastOfflineClericCast).toBe(history);
        expect(target.markWeaknessTimer).toBe(0); expect(ally.markWeaknessTimer).toBe(0);
    } finally { dispose(); }
});
