import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';

function fixture() {
    const wizard = new Wizard('precision');
    wizard.mesh = new THREE.Group(); wizard.level = 40; wizard.recalculateStats();
    wizard.stats.hp = wizard.stats.maxHp; wizard.stats.mana = wizard.stats.maxMana;
    const tree = CONSTANTS.SKILL_TREES.Wizard;
    wizard.unlockedSkills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree.BranchB[`Tier${t}`].name)];
    const engine = { isMultiplayer: false, currentInstanceId: '',
        chunkManager: { getActiveEntities: () => [] }, floatingTextManager: { spawn: jest.fn() },
        spawnTransientEffect: jest.fn(() => true), addEntity: jest.fn() };
    return { wizard, engine, cast: skill => wizard.useAbility(new THREE.Vector3(8, 0, 0), engine, skill),
        dispose() { for (const [entity] of engine.addEntity.mock.calls) entity.dispose?.(); wizard.dispose(); } };
}

afterEach(() => jest.useRealTimers());

test.each(['enemy', 'immune', 'ally', 'existing slow'])('beam gives breathing room for %s without harming allies or overwriting control', kind => {
    const f = fixture();
    const target = new Actor('beam-target', CONSTANTS.ENTITIES.SKELETON);
    try {
        target.position.set(5, 0, 0); target.stats.hp = target.stats.maxHp = 10000;
        target.isActive = true; target.ccImmune = kind === 'immune';
        if (kind === 'existing slow') { target.slowTimer = 10; target.slowFactor = .6; }
        f.engine.chunkManager.getActiveEntities = () => [target];
        f.engine.isHostileActorTarget = () => kind !== 'ally';
        f.cast('Scorch Beam');
        if (kind === 'ally') {
            expect(target.stats.hp).toBe(10000); expect(target.armorReductionTimer || 0).toBe(0);
        } else expect(target.stats.hp).toBeLessThan(10000);
        expect(target.slowTimer).toBe(kind === 'enemy' ? 3 : kind === 'existing slow' ? 10 : 0);
        expect(target.slowFactor).toBe(kind === 'enemy' ? .30 : kind === 'existing slow' ? .6 : 0);
    } finally { target.dispose(); f.dispose(); }
});

test('precision branch has its own reachable paid five-missile combo and ordinary followup', () => {
    jest.useFakeTimers();
    const f = fixture();
    try {
        f.cast('Scorch Beam');
        const before = f.wizard.stats.mana;
        f.cast('Arcane Missiles');
        jest.advanceTimersByTime(650);
        expect(f.engine.addEntity).toHaveBeenCalledTimes(5);
        expect(f.wizard.stats.mana).toBe(before - 30);
        expect(f.wizard.cooldowns['Arcane Missiles']).toBeGreaterThan(0);
        expect(f.engine.floatingTextManager.spawn).toHaveBeenCalledWith('ARCANE BARRAGE!', f.wizard.position, '#c66bff');
        f.wizard.cooldowns['Arcane Missiles'] = 0;
        f.cast('Arcane Missiles');
        jest.advanceTimersByTime(650);
        expect(f.engine.addEntity).toHaveBeenCalledTimes(8);
    } finally { f.dispose(); }
});

test('expired beam preparation does not empower missiles', () => {
    jest.useFakeTimers();
    const f = fixture();
    try {
        f.cast('Scorch Beam'); jest.advanceTimersByTime(3100);
        f.cast('Arcane Missiles'); jest.advanceTimersByTime(650);
        expect(f.engine.addEntity).toHaveBeenCalledTimes(3);
    } finally { f.dispose(); }
});

test('ability cancellation clears prepared combo history', () => {
    const f = fixture();
    try {
        f.cast('Scorch Beam');
        expect(Number.isFinite(f.wizard.lastOfflineScorchBeamAt)).toBe(true);
        f.wizard.cancelAbilities();
        expect(f.wizard.lastOfflineScorchBeamAt).toBeNull();
        expect(f.wizard.lastOfflineGravityWellAt).toBeNull();
        expect(f.wizard.lastOfflineFireballAt).toBeNull();
        expect(f.wizard.lastOfflineFlameTornadoAt).toBeNull();
    } finally { f.dispose(); }
});

test('rejected missiles preserve the preparation but another successful cast consumes the sequence', () => {
    jest.useFakeTimers();
    const f = fixture();
    try {
        f.cast('Scorch Beam');
        const preparedAt = f.wizard.lastOfflineScorchBeamAt;
        f.wizard.cooldowns['Arcane Missiles'] = 1;
        f.cast('Arcane Missiles');
        expect(f.wizard.lastOfflineScorchBeamAt).toBe(preparedAt);
        f.cast('Fireball');
        expect(f.wizard.lastOfflineScorchBeamAt).toBeNull();
        f.wizard.cooldowns['Arcane Missiles'] = 0;
        f.cast('Arcane Missiles'); jest.advanceTimersByTime(650);
        expect(f.engine.addEntity.mock.calls.filter(([e]) => e.meshType === 'ArcaneMissile' || e.type === 'ArcaneMissile')).toHaveLength(3);
    } finally { f.dispose(); }
});

test('Focus ward absorbs damage without consuming the next-spell charge or replacing an active shield', () => {
    const f = fixture();
    try {
        f.cast('Spell Focus');
        const ward = 40 + 2 * f.wizard.stats.intelligence, hp = f.wizard.stats.hp;
        expect(f.wizard.shieldHP).toBe(ward);
        expect(f.wizard.arcaneShieldTimer).toBe(6);
        f.wizard.takeDamage(20);
        expect(f.wizard.stats.hp).toBe(hp);
        expect(f.wizard.shieldHP).toBe(ward - 20);
        expect(f.wizard.spellFocusActive).toBe(true);
        f.wizard.shieldHP = 999; f.wizard.arcaneShieldTimer = 20;
        f.wizard.cooldowns['Spell Focus'] = 0;
        f.cast('Spell Focus');
        expect(f.wizard.shieldHP).toBe(999);
        expect(f.wizard.arcaneShieldTimer).toBe(20);
    } finally { f.dispose(); }
});
