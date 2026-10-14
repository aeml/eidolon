import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Imp } from '../src/entities/Imp.js';

function fixture(rune = 'ironfortress_thorns') {
    const owner = new Fighter('fortress'), enemy = new Imp('attacker');
    owner.mesh = new THREE.Group(); owner.level = 100; owner.recalculateStats();
    owner.stats.hp = owner.stats.maxHp = enemy.stats.hp = enemy.stats.maxHp = 1000;
    owner.stats.mana = 100; owner.stats.cooldownReduction = 0;
    owner.skillRunes = { 'Iron Fortress': rune }; owner.unlockedSkills = ['Iron Fortress'];
    const engine = { currentInstanceId: 'fortress-test', currentInstanceType: 'dungeon',
        currentDungeonLayout: { walkRects: [{ x: 0, z: 0, width: 50, height: 50 }] },
        chunkManager: { getActiveEntities: () => [owner, enemy] }, isHostileActorTarget: target => target === owner || target === enemy,
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    owner.gameEngine = enemy.gameEngine = engine;
    return { owner, enemy, engine, cast: () => owner.useAbility(owner.position.clone(), engine, 'Iron Fortress'),
        dispose() { owner.dispose(); enemy.dispose(); } };
}
beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test.each(['ironfortress_extended', 'ironfortress_thorns', 'ironfortress_immovable'])('paid %s snapshots its effect and clears on cancellation', rune => {
    const f = fixture(rune);
    try {
        f.cast(); expect(f.owner.stats.mana).toBe(60); expect(f.owner.cooldowns['Iron Fortress']).toBe(60);
        expect(f.owner.ironFortressTimer).toBe(rune === 'ironfortress_extended' ? 45 : 30);
        expect(f.owner.ironFortressThorns).toBe(rune === 'ironfortress_thorns');
        expect(f.owner.ironFortressImmovable).toBe(rune === 'ironfortress_immovable');
        f.owner.skillRunes = {};
        f.owner.takeDamage(100, f.enemy);
        expect(f.enemy.stats.hp).toBe(rune === 'ironfortress_thorns' ? 984 : 1000);
        f.owner.cancelAbilities();
        expect(f.owner.ironFortressThorns).toBe(false); expect(f.owner.ironFortressImmovable).toBe(false);
    } finally { f.dispose(); }
});

test.each(['absorbed', 'partial', 'phase', 'expired', 'lethal', 'unique', 'foreign', 'remote', 'reflection'])('Fortress reflection uses committed HP damage and finite receiving rules: %s', mode => {
    const f = fixture();
    try {
        f.cast();
        if (mode === 'absorbed') f.owner.shieldHP = 100;
        if (mode === 'partial') f.owner.shieldHP = 30;
        if (mode === 'phase') f.owner.teleportPhaseTimer = 1;
        if (mode === 'expired') f.owner.ironFortressTimer = .1;
        if (mode === 'lethal') f.owner.stats.hp = 1;
        if (mode === 'unique') f.owner.hasThornsEffect = true;
        if (mode === 'foreign') f.enemy.instanceId = 'other';
        if (mode === 'remote') f.enemy.isRemote = true;
        f.enemy.shieldHP = 100; f.enemy.hasThornsEffect = true; f.enemy.teleportPhaseTimer = 1;
        f.owner.takeDamage(100, f.enemy, mode === 'expired' ? .2 : 0, mode === 'reflection' ? { reflection: true } : null);
        const expected = { partial: 10, lethal: 16, unique: 24 }[mode] || 0;
        expect(f.enemy.stats.hp).toBe(1000 - expected);
        expect(f.enemy.shieldHP).toBe(100);
        if (mode === 'lethal') expect(f.owner.state).toBe('DEAD');
    } finally { f.dispose(); }
});

test('Immovable stops Gravity displacement while damage, slow and Black Hole root still apply', () => {
    const f = fixture('ironfortress_immovable'), mage = new Wizard('gravity');
    try {
        f.cast(); f.owner.position.set(4, 0, 0);
        mage.mesh = new THREE.Group(); mage.gameEngine = f.engine;
        mage.unlockedSkills = ['Gravity Well']; mage.stats.mana = 100; mage.skillRunes = { 'Gravity Well': 'gravitywell_blackhole' };
        mage.useAbility(new THREE.Vector3(0, 0, 0), f.engine, 'Gravity Well');
        expect(f.owner.position.x).toBe(4); expect(f.owner.stats.hp).toBeLessThan(1000);
        expect(f.owner.rootTimer).toBe(2); expect(f.owner.slowTimer).toBe(3);
    } finally { mage.dispose(); f.dispose(); }
});

test('unpaid Fortress cannot arm rune flags or alter stats', () => {
    const f = fixture('ironfortress_immovable');
    try { f.owner.stats.mana = 0; const defense = f.owner.stats.defense; f.cast();
        expect(f.owner.ironFortressTimer).toBe(0); expect(f.owner.ironFortressImmovable).toBeFalsy();
        expect(f.owner.stats.defense).toBe(defense);
    } finally { f.dispose(); }
});
