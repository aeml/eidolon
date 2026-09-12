import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';

function fixture() {
    const source = new Wizard('warp-source'), ally = new Fighter('warp-ally');
    for (const actor of [source, ally]) {
        actor.mesh = new THREE.Group(); actor.level = 30; actor.recalculateStats();
        actor.stats.hp = actor.stats.maxHp; actor.stats.mana = actor.stats.maxMana;
    }
    source.unlockedSkills.push('Time Warp'); ally.position.set(0, 0, 3);
    const engine = { currentInstanceId: 'warp-scene', isMultiplayer: false,
        chunkManager: { getActiveEntities: () => [ally] },
        isHostileActorTarget: () => false, floatingTextManager: { spawn: jest.fn() },
        spawnTransientEffect: jest.fn(() => true) };
    return { source, ally, engine, cast: () => source.useAbility(source.position.clone(), engine, 'Time Warp'),
        dispose: () => { source.dispose(); ally.dispose(); } };
}

test.each([[0, 0, 8], [1, 0, 8.32], [5, 0, 9.6], [99, 0, 9.6], [-1, 0, 8],
    [Infinity, 0, 8], [5, 5, 11.2]])('Time Warp Mastery %s plus general duration %s grants %ss, without stronger haste', (rank, general, duration) => {
    const f = fixture();
    try {
        f.source.talentRanks = { WIZ_25: rank, WIZ_34: general };
        f.ally.talentRanks = { WIZ_25: 5, WIZ_34: 5 };
        const mana = f.source.stats.mana, cdr = f.source.stats.cooldownReduction;
        const speed = f.ally.stats.speed, allyCdr = f.ally.stats.cooldownReduction;
        f.cast();
        expect(f.source.stats.mana).toBe(mana - 50);
        expect(f.source.cooldowns['Time Warp']).toBeCloseTo(60 * (1 - cdr));
        expect(f.source.hasteTimer).toBeCloseTo(duration);
        expect(f.ally.hasteTimer).toBeCloseTo(duration);
        expect(f.ally.hasteFactor).toBe(.5);
        expect(f.ally.stats.speed).toBeCloseTo(speed * 1.5);
        expect(f.ally.stats.cooldownReduction).toBeCloseTo(Math.min(.8, allyCdr + .2));
        f.source.talentRanks = {};
        Actor.prototype.update.call(f.ally, duration - .01, null, null, []);
        expect(f.ally.hasteTimer).toBeGreaterThan(0);
        Actor.prototype.update.call(f.ally, .02, null, null, []);
        expect(f.ally.hasteTimer).toBe(0);
        expect(f.ally.stats.speed).toBeCloseTo(speed);
        expect(f.ally.stats.cooldownReduction).toBeCloseTo(allyCdr);
    } finally { f.dispose(); }
});

test.each([[0, 8], [5, 9.6], [99, 9.6], [-1, 8], [Infinity, 8]])(
    'paid haste snapshots caster duration rank %s for self and allies', (rank, duration) => {
        const f = fixture();
        try {
            f.source.talentRanks = { WIZ_34: rank }; f.ally.talentRanks = { WIZ_34: 5 };
            const mana = f.source.stats.mana, cooldown = 60 * (1 - f.source.stats.cooldownReduction);
            f.cast();
            expect(f.source.stats.mana).toBe(mana - 50);
            expect(f.source.cooldowns['Time Warp']).toBeCloseTo(cooldown);
            expect(f.source.hasteTimer).toBeCloseTo(duration);
            expect(f.ally.hasteTimer).toBeCloseTo(duration);
            f.source.talentRanks = {};
            expect(f.ally.hasteTimer).toBeCloseTo(duration);
        } finally { f.dispose(); }
    });

test('Technique economy is committed before receiving Time Warp CDR', () => {
    const f = fixture();
    try {
        f.source.talentRanks = { WIZ_26: 5 };
        const mana = f.source.stats.mana, cdr = f.source.stats.cooldownReduction;
        f.cast();
        expect(f.source.stats.mana).toBe(mana - 45);
        expect(f.source.cooldowns['Time Warp']).toBeCloseTo(60 * (1 - cdr) * .85);
        expect(f.source.stats.cooldownReduction).toBeCloseTo(Math.min(.8, cdr + .2));
    } finally { f.dispose(); }
});

test.each([false, true])('speed, attack cadence and CDR return to baseline after expiry, stunned=%s', stunned => {
    const f = fixture();
    try {
        const { speed, cooldownReduction } = f.ally.stats;
        const hitDelay = f.ally.getAttackHitDelay();
        f.source.talentRanks = { WIZ_34: 5 }; f.cast();
        expect(f.ally.stats.speed).toBeCloseTo(speed * 1.5);
        expect(f.ally.stats.cooldownReduction).toBeCloseTo(Math.min(.8, cooldownReduction + .2));
        expect(f.ally.getAttackHitDelay()).toBeCloseTo(hitDelay / 1.5);
        f.ally.stunTimer = stunned ? 20 : 0;
        Actor.prototype.update.call(f.ally, 9.6, null, null, []);
        expect(f.ally.hasteTimer).toBe(0); expect(f.ally.hasteFactor).toBe(0);
        expect(f.ally.stats.speed).toBeCloseTo(speed);
        expect(f.ally.stats.cooldownReduction).toBeCloseTo(cooldownReduction);
        expect(f.ally.getAttackHitDelay()).toBeCloseTo(hitDelay);
        if (stunned) expect(f.ally.stunTimer).toBeCloseTo(10.4);
    } finally { f.dispose(); }
});

test.each(['hostile', 'dead', 'inactive', 'remote', 'multiplayer', 'engine-authoritative', 'other-scene'])('%s recipients are not buffed', mode => {
    const f = fixture();
    try {
        if (mode === 'hostile') f.engine.isHostileActorTarget = actor => actor === f.ally;
        if (mode === 'dead') f.ally.state = 'DEAD';
        if (mode === 'inactive') f.ally.isActive = false;
        if (mode === 'remote') f.ally.isRemote = true;
        if (mode === 'multiplayer') f.ally.isMultiplayer = true;
        if (mode === 'engine-authoritative') f.ally.gameEngine = { isMultiplayer: true };
        if (mode === 'other-scene') f.ally.gameEngine = { currentInstanceId: 'other-warp' };
        const stats = { ...f.ally.stats };
        f.cast();
        expect(f.ally.hasteTimer).toBe(0); expect(f.ally.stats).toEqual(stats);
        expect(f.source.hasteTimer).toBe(8);
    } finally { f.dispose(); }
});

test.each(['locked', 'mana', 'cooldown', 'dead', 'stunned'])('%s casts do not spend or grant support', mode => {
    const f = fixture();
    try {
        if (mode === 'locked') f.source.unlockedSkills = [];
        if (mode === 'mana') f.source.stats.mana = 49;
        if (mode === 'cooldown') f.source.cooldowns['Time Warp'] = 1;
        if (mode === 'dead') f.source.state = 'DEAD';
        if (mode === 'stunned') f.source.stunTimer = 1;
        const mana = f.source.stats.mana;
        f.cast();
        expect(f.source.stats.mana).toBe(mana); expect(f.source.hasteTimer).toBe(0);
        expect(f.ally.hasteTimer).toBe(0); expect(f.engine.spawnTransientEffect).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test('support never consumes the next-damage Spell Focus charge', () => {
    const f = fixture();
    try {
        f.source.spellFocusActive = true; f.source.spellFocusTimer = 15; f.source.spellFocusMultiplier = 2.5;
        f.cast();
        expect(f.source.spellFocusActive).toBe(true); expect(f.source.spellFocusTimer).toBe(15);
    } finally { f.dispose(); }
});

test.each([5, 6])('equipped Temporal Weave piece count %s controls distant zone support', count => {
    const f = fixture();
    try {
        for (const slot of ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'].slice(0, count)) {
            f.source.equipment[slot] = { id: `warp-${slot}`, type: 'ARMOR', slot, level: 30,
                setId: 'temporal_weave', stats: {} };
        }
        f.source.recalculateStats(); f.ally.position.set(500, 0, 0);
        f.cast();
        expect(f.ally.hasteTimer).toBe(count === 6 ? 8 : 0);
        expect(f.source.activeSetBonuses.temporal_weave.count).toBe(count);
    } finally { f.dispose(); }
});

test('friendly NPC support crosses walls and source is included once without chunk membership', () => {
    const f = fixture(), npc = new Actor('warp-npc', {});
    try {
        npc.mesh = new THREE.Group(); npc.position.set(3, 0, 0); npc.recalculateStats();
        f.engine.chunkManager.getActiveEntities = () => [f.ally, npc];
        f.engine.currentDungeonLayout = { walkRects: [{ x: 0, z: 0, width: 2, height: 2 }, { x: 3, z: 0, width: 2, height: 2 }] };
        f.cast();
        expect(npc.hasteTimer).toBe(8);
        expect(f.source.hasteTimer).toBe(8);
        expect(f.engine.floatingTextManager.spawn.mock.calls.filter(args => args[0] === 'TIME WARP!')).toHaveLength(3);
    } finally { npc.dispose(); f.dispose(); }
});

test.each(['multiplayer', 'remote', 'engine'])('server-owned %s casts never grant local haste', mode => {
    const f = fixture();
    try {
        if (mode === 'multiplayer') f.source.isMultiplayer = true;
        if (mode === 'remote') f.source.isRemote = true;
        if (mode === 'engine') f.engine.isMultiplayer = true;
        const stats = { ...f.ally.stats };
        f.cast(); expect(f.ally.hasteTimer).toBe(0); expect(f.ally.stats).toEqual(stats);
    } finally { f.dispose(); }
});

test.each([{ isRemote: true }, { isMultiplayer: true }, { gameEngine: { isMultiplayer: true } }])(
    'replicated haste visual expiry never recalculates server stats: %j', flags => {
        const f = fixture();
        try {
            Object.assign(f.ally, flags, { hasteTimer: 1, hasteFactor: .5, stunTimer: 5 });
            const recalculate = jest.spyOn(f.ally, 'recalculateStats');
            Actor.prototype.update.call(f.ally, 2, null, null, []);
            expect(f.ally.hasteTimer).toBe(0); expect(recalculate).not.toHaveBeenCalled();
        } finally { f.dispose(); }
    });

test('a second caster refreshes haste without multiplying the first speed bonus', () => {
    const f = fixture(), second = new Wizard('second-warp');
    try {
        second.mesh = new THREE.Group(); second.level = 30; second.recalculateStats();
        second.stats.mana = second.stats.maxMana; second.unlockedSkills.push('Time Warp');
        const speed = f.ally.stats.speed;
        f.cast();
        Actor.prototype.update.call(f.ally, 2, null, null, []);
        second.useAbility(second.position.clone(), f.engine, 'Time Warp');
        expect(f.ally.hasteTimer).toBe(8); expect(f.ally.stats.speed).toBeCloseTo(speed * 1.5);
        Actor.prototype.update.call(f.ally, 8, null, null, []);
        expect(f.ally.stats.speed).toBeCloseTo(speed);
    } finally { second.dispose(); f.dispose(); }
});
