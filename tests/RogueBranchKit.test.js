import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Actor } from '../src/entities/Actor.js';
import { Imp } from '../src/entities/Imp.js';
import { CONSTANTS } from '../src/core/Constants.js';

function fixture() {
    const rogue = new Rogue('trickster'); rogue.mesh = new THREE.Group();
    rogue.level = 40; rogue.recalculateStats(); rogue.stats.mana = rogue.stats.maxMana;
    const tree = CONSTANTS.SKILL_TREES.Rogue;
    rogue.unlockedSkills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree.BranchC[`Tier${t}`].name)];
    const engine = { effectScene: new THREE.Group(), chunkManager: { getActiveEntities: () => [] },
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    return { rogue, engine, cast: (skill, x = 0) => rogue.useAbility(new THREE.Vector3(x, 0, 0), engine, skill) };
}

test.each(['combo', 'expired', 'cancelled'])('aimed Venom Burst trap: %s', mode => {
    const { rogue, engine, cast } = fixture();
    const enemy = new Actor('trap-enemy', {});
    try {
        jest.spyOn(Math, 'random').mockReturnValue(.99);
        cast('Poison Coating');
        if (mode === 'expired') rogue.lastOfflineRogueSkillAt -= 3001;
        if (mode === 'cancelled') rogue.cancelAbilities();
        cast('Tripwire', 100);
        expect(rogue.traps).toHaveLength(1);
        const trap = rogue.traps[0], damage = (20 + rogue.stats.dexterity) * (mode === 'combo' ? 2 : 1);
        expect(trap.position.x).toBe(6); expect(trap.damage).toBe(damage);
        enemy.position.set(6, 0, 0); enemy.stats.hp = 10000; enemy.stats.defense = 0; enemy.ccImmune = true;
        engine.chunkManager.getActiveEntities = () => [enemy]; engine.isHostileActorTarget = () => true;
        rogue.update(0, null, null, engine.chunkManager, engine.floatingTextManager, engine);
        expect(enemy.stats.hp).toBe(10000 - damage); expect(enemy.rootTimer).toBe(0);
        expect(rogue.traps).toHaveLength(0);
    } finally { jest.restoreAllMocks(); enemy.dispose(); rogue.dispose(); }
});

test('Shadow Dance pays normal Smoke cost/cooldown, rearms one trap, and consumes once', () => {
    const { rogue, cast } = fixture();
    try {
        rogue.cooldowns.Tripwire = 10;
        cast('Cloak & Vanish');
        const mana = rogue.stats.mana;
        cast('Smoke Bomb');
        expect(rogue.stats.mana).toBe(mana - 35);
        expect(rogue.cooldowns['Smoke Bomb']).toBeGreaterThan(0);
        expect(rogue.cooldowns.Tripwire).toBe(0);
        rogue.cooldowns.Tripwire = 10; rogue.cooldowns['Smoke Bomb'] = 0;
        cast('Smoke Bomb'); expect(rogue.cooldowns.Tripwire).toBe(10);
    } finally { rogue.dispose(); }
});

test('Tripwire placement stops at a disconnected dungeon wall', () => {
    const { rogue, engine, cast } = fixture();
    try {
        engine.currentInstanceId = 'trap-wall'; engine.currentInstanceType = 'dungeon';
        engine.currentDungeonLayout = { walkRects: [{ x: 0, z: 0, width: 4, height: 4 }, { x: 5, z: 0, width: 4, height: 4 }] };
        cast('Tripwire', 5);
        expect(rogue.traps).toHaveLength(1); expect(rogue.traps[0].position.x).toBeLessThanOrEqual(2);
    } finally { rogue.dispose(); }
});

function throwingFixture() {
    const f = fixture(), projectiles = [], tasks = [];
    const tree = CONSTANTS.SKILL_TREES.Rogue;
    f.rogue.unlockedSkills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree.BranchB[`Tier${t}`].name)];
    f.engine.addEntity = p => projectiles.push(p);
    f.rogue.scheduleTask = task => tasks.push(task);
    return { ...f, projectiles, tasks };
}

test.each([false, true])('throwing Volley pierces only after paid Fan setup: %s', combo => {
    const { rogue, engine, cast, projectiles, tasks } = throwingFixture();
    const targets = [new Imp('front'), new Imp('back')];
    try {
        jest.spyOn(Math, 'random').mockReturnValue(.99);
        targets.forEach((t, i) => { t.position.set(4 + i * 4, 0, 0); t.stats.hp = 10000; t.stats.defense = 0; });
        engine.chunkManager.getActiveEntities = () => targets;
        engine.isHostileActorTarget = t => targets.includes(t);
        if (combo) cast('Fan of Knives');
        rogue.useAbility(new THREE.Vector3(10, 100, 0), engine, 'Phantom Volley');
        tasks.forEach(task => task());
        const arrows = projectiles.filter(p => p.type === 'PhantomArrow');
        expect(arrows).toHaveLength(3);
        const arrow = arrows[0];
        expect(arrow.velocity.y).toBe(0);
        for (let i = 0; i < 60 && arrow.isActive; i++) {
            arrow.update(.02, null, null, engine.chunkManager, engine.floatingTextManager, engine);
        }
        expect(targets[0].stats.hp).toBe(10000 - arrow.damage);
        expect(targets[1].stats.hp).toBe(10000 - (combo ? arrow.damage : 0));
        expect(arrow.hitEntities.size).toBe(combo ? 2 : 1);
    } finally { jest.restoreAllMocks(); projectiles.forEach(p => p.dispose()); targets.forEach(t => t.dispose()); rogue.dispose(); }
});

test.each(['cancel', 'death', 'scene', 'instance', 'authority'])('pending Volley stops after %s', reason => {
    const { rogue, engine, cast, projectiles, tasks } = throwingFixture();
    try {
        cast('Phantom Volley', 10);
        expect(tasks).toHaveLength(3);
        if (reason === 'cancel') rogue.cancelAbilities();
        if (reason === 'death') rogue.stats.hp = 0;
        if (reason === 'scene') engine.currentInstanceId = 'elsewhere';
        if (reason === 'instance') rogue.instanceId = 'elsewhere';
        if (reason === 'authority') engine.isMultiplayer = true;
        tasks.forEach(task => task());
        expect(projectiles).toHaveLength(0);
    } finally { projectiles.forEach(p => p.dispose()); rogue.dispose(); }
});

test.each(['coated', 'bare', 'immune', 'existing', 'weighted'])('Fan spacing slow: %s', mode => {
    const { rogue, engine, cast, projectiles } = throwingFixture();
    const target = new Imp('fan-target');
    try {
        jest.spyOn(Math, 'random').mockReturnValue(.99);
        target.position.set(4, 0, 0); target.stats.hp = 10000;
        target.ccImmune = mode === 'immune';
        if (mode === 'existing') { target.slowTimer = 9; target.slowFactor = .6; }
        if (mode === 'weighted') rogue.skillRunes = { 'Fan of Knives': 'fanofknives_weighted' };
        engine.chunkManager.getActiveEntities = () => [target];
        if (mode !== 'bare') cast('Serrated Edges');
        cast('Fan of Knives');
        const dagger = projectiles[0];
        for (let i = 0; i < 60 && target.stats.hp === 10000; i++) {
            dagger.update(.02, null, null, engine.chunkManager, engine.floatingTextManager, engine);
        }
        expect(target.stats.hp).toBeLessThan(10000);
        const duration = { coated: 2, bare: 0, immune: 0, existing: 9, weighted: 3 }[mode];
        expect(target.slowTimer).toBe(duration);
        if (duration) expect(target.slowFactor).toBe({ coated: .2, existing: .6, weighted: .3 }[mode]);
    } finally { jest.restoreAllMocks(); projectiles.forEach(p => p.dispose()); target.dispose(); rogue.dispose(); }
});
