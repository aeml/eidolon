import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Wizard } from '../src/entities/Wizard.js';

function fixture(rune = 'teleport_warp', trained = false) {
    const source = new Wizard('warp-caster'); source.mesh = new THREE.Group();
    source.position.set(60000, 40, 60000); source.level = 100;
    source.unlockedSkills.push('Teleport'); source.skillRunes = { Teleport: rune };
    source.talentRanks = trained ? { WIZ_19: 5, WIZ_36: 5, WIZ_38: 5 } : {};
    Object.assign(source.stats, { intelligence: 10, mana: 200, critChanceBonus: 0 });
    source.spellFocusActive = true; source.spellFocusTimer = 10; source.spellFocusMultiplier = 2.5;
    const entities = [];
    const engine = { currentInstanceId: 'warp-test', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => entities }, isHostileActorTarget: target => target.hostile,
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
    source.gameEngine = engine;
    const add = (x, z) => {
        const target = new Actor(`enemy-${entities.length}`, {});
        target.position.set(60000 + x, 0, 60000 + z); target.radius = 1.25;
        target.stats.hp = target.stats.maxHp = 1000; target.hostile = true;
        jest.spyOn(target, 'takeDamage'); entities.push(target); return target;
    };
    const cast = (x = 12, z = 0) => source.useAbility(new THREE.Vector3(60000 + x, 40, 60000 + z), engine, 'Teleport');
    return { source, engine, entities, add, cast,
        dispose: () => { source.dispose(); entities.forEach(target => target.dispose()); } };
}

test.each([[false, 25], [true, 30]])('paid Warp at both endpoints uses trained=%s and preserves Focus', (trained, damage) => {
    const f = fixture('teleport_warp', trained);
    try {
        const near = [f.add(0, 3), f.add(12, 3)];
        const annulus = [f.add(0, 5.75), f.add(12, 5.75)];
        const outside = [f.add(0, 6.3), f.add(12, 6.3)];
        f.cast();
        expect(f.source.position.x).toBe(60012); expect(f.source.stats.mana).toBe(160);
        expect(f.source.spellFocusActive).toBe(true); expect(f.source.spellFocusTimer).toBe(10);
        for (const target of near) expect(target.takeDamage).toHaveBeenCalledWith(damage, f.source);
        for (const target of annulus) expect(target.stats.hp).toBe(trained ? 1000 - damage : 1000);
        for (const target of outside) expect(target.takeDamage).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test('two overlapping bursts each pass once through actual shield absorption', () => {
    const f = fixture('teleport_warp', true);
    try {
        const target = f.add(3, 0); target.shieldHP = 40;
        f.cast(6);
        expect(target.takeDamage).toHaveBeenCalledTimes(2);
        expect(target.shieldHP).toBe(0); expect(target.stats.hp).toBe(980);
    } finally { f.dispose(); }
});

test.each([0, 8])('burst at z=%s respects walls and an actual doorway', burstZ => {
    for (const doorway of [false, true]) {
        const f = fixture();
        try {
            f.source.position.x += 9;
            f.engine.currentDungeonLayout = { walkRects: [
                { x: 60000, z: 60000, width: 20, height: 30 },
                { x: 60022, z: 60000, width: 20, height: 30 },
                ...(doorway ? [{ x: 60011, z: 60000 + burstZ, width: 4, height: 4 }] : [])
            ] };
            const target = f.add(12, burstZ); f.cast(9, 8);
            expect(target.stats.hp).toBe(doorway ? 975 : 1000);
        } finally { f.dispose(); }
    }
});

test.each(['', 'teleport_blink', 'teleport_phase'])('%s never gets the Warp damage', rune => {
    const f = fixture(rune, true);
    try { const target = f.add(0, 1); f.cast(); expect(target.takeDamage).not.toHaveBeenCalled(); }
    finally { f.dispose(); }
});

test('Warp excludes nonhostile, dead, inactive, remote and other-instance actors', () => {
    const f = fixture();
    try {
        const alive = f.add(1, 0), ally = f.add(1, 0), dead = f.add(1, 0), inactive = f.add(1, 0);
        const remote = f.add(1, 0), other = f.add(1, 0);
        ally.hostile = false; dead.state = 'DEAD'; inactive.isActive = false; remote.isRemote = true;
        other.gameEngine = { currentInstanceId: 'different-dungeon' };
        f.cast(); expect(alive.takeDamage).toHaveBeenCalledTimes(1);
        for (const target of [ally, dead, inactive, remote, other]) expect(target.takeDamage).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test.each(['locked', 'mana', 'cooldown', 'remote', 'multiplayer'])('%s cast cannot deal predicted Warp damage', mode => {
    const f = fixture();
    try {
        if (mode === 'locked') f.source.unlockedSkills = [];
        if (mode === 'mana') f.source.stats.mana = 39;
        if (mode === 'cooldown') f.source.cooldowns.Teleport = 1;
        if (mode === 'remote') f.source.isRemote = true;
        if (mode === 'multiplayer') f.engine.isMultiplayer = true;
        const target = f.add(1, 0); f.cast(); expect(target.takeDamage).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test.each([false, true])('Teleport movement and arrival burst use a wall-clipped landing, doorway=%s', doorway => {
    const f = fixture();
    try {
        f.source.position.x += 9;
        f.engine.currentDungeonLayout = { walkRects: [
            { x: 60000, z: 60000, width: 20, height: 20 },
            { x: 60030, z: 60000, width: 20, height: 20 },
            ...(doorway ? [{ x: 60015, z: 60000, width: 12, height: 6 }] : [])
        ] };
        const target = f.add(23, 0); f.cast(21);
        expect(f.source.position.x).toBe(doorway ? 60021 : 60010);
        expect(target.stats.hp).toBe(doorway ? 975 : 1000);
        expect(f.source.stats.mana).toBe(160);
    } finally { f.dispose(); }
});

test('Teleport range uses planar coordinates and preserves actor height like the server', () => {
    const f = fixture('');
    try {
        f.source.useAbility(new THREE.Vector3(60012, 0, 60000), f.engine, 'Teleport');
        expect(f.source.position.toArray()).toEqual([60012, 40, 60000]);
    } finally { f.dispose(); }
});
