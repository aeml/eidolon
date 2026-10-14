import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';

function fixture(skill, rune) {
    const source = new Rogue('rune-rogue'), target = new Imp('rune-target');
    source.mesh = new THREE.Group(); source.level = 100;
    source.stats.damage = 100; source.stats.dexterity = 40; source.stats.mana = 1000;
    source.stats.critChanceBonus = 0; source.stats.cooldownReduction = 0;
    source.unlockedSkills.push(skill); source.skillRunes = { [skill]: rune };
    target.mesh = new THREE.Group(); target.position.set(4, 0, 0);
    target.stats.hp = target.stats.maxHp = 10000; target.stats.defense = 0;
    const projectiles = [], tasks = [];
    source.scheduleTask = task => { tasks.push(task); return tasks.length; };
    const engine = { effectScene: new THREE.Group(), chunkManager: { getActiveEntities: () => [target] },
        isHostileActorTarget: entity => entity === target, floatingTextManager: { spawn: jest.fn() },
        spawnTransientEffect: jest.fn(() => true), addEntity: p => projectiles.push(p) };
    return { source, target, engine, projectiles, tasks,
        cast: () => source.useAbility(target.position.clone(), engine, skill),
        hit: projectile => { for (let i = 0; i < 120 && !projectile.hitEntities.has(target.id); i++) projectile.update(.01, null, null, engine.chunkManager, engine.floatingTextManager, engine); },
        dispose: () => { projectiles.forEach(p => p.dispose()); source.dispose(); target.dispose(); } };
}
afterEach(() => jest.restoreAllMocks());

test.each(['fanofknives_weighted', 'fanofknives_poisoned', 'fanofknives_fury'])('paid Fan captures %s through impact', rune => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const f = fixture('Fan of Knives', rune);
    try {
        f.cast(); expect(f.source.stats.mana).toBe(975); expect(f.source.cooldowns['Fan of Knives']).toBe(6);
        expect(f.projectiles).toHaveLength(rune === 'fanofknives_fury' ? 24 : 12);
        f.source.skillRunes = {}; f.hit(f.projectiles[0]);
        expect(f.target.stats.hp).toBe(9950);
        if (rune === 'fanofknives_weighted') { expect(f.target.slowFactor).toBe(.3); expect(f.target.slowTimer).toBe(3); }
        if (rune === 'fanofknives_poisoned') { expect(f.target.poisonTickDamage).toBe(12); expect(f.target.poisonTimer).toBe(5); }
    } finally { f.dispose(); }
});

test.each([.29, .3, .31])('Executioner threshold is strictly below 30 percent: %s', fraction => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const f = fixture('Piercing Throw', 'piercingthrow_executioner');
    try {
        f.target.stats.hp = 10000 * fraction; const before = f.target.stats.hp;
        f.cast(); f.source.skillRunes = {}; f.hit(f.projectiles[0]);
        expect(before - f.target.stats.hp).toBe(75 * (fraction < .3 ? 2 : 1));
    } finally { f.dispose(); }
});

test('Serrated captures its rune and applies one inherited five-second wound', () => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const f = fixture('Piercing Throw', 'piercingthrow_serrated');
    try { f.cast(); f.source.skillRunes = {}; f.hit(f.projectiles[0]); expect(f.target.bleedTickDamage).toBe(15); expect(f.target.bleedTimer).toBe(5); }
    finally { f.dispose(); }
});

test.each([false, true])('Ricochet redirects toward a legal hostile, ally=%s', ally => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const f = fixture('Piercing Throw', 'piercingthrow_ricochet'), next = new Imp('next');
    try {
        next.position.set(4, 0, 12); next.stats.hp = next.stats.maxHp = 10000; next.stats.defense = 0;
        f.engine.chunkManager.getActiveEntities = () => [f.target, next];
        f.engine.isHostileActorTarget = e => e === f.target || !ally && e === next;
        f.cast(); expect(f.projectiles[0].bounces).toBe(2); f.source.skillRunes = {}; f.hit(f.projectiles[0]);
        const p = f.projectiles[0]; expect(p.velocity.y).toBe(0); expect(p.velocity.z > 0).toBe(!ally);
        for (let i = 0; i < 100 && p.isActive; i++) p.update(.01, null, null, f.engine.chunkManager, f.engine.floatingTextManager, f.engine);
        expect(next.stats.hp).toBe(ally ? 10000 : 9925);
    } finally { next.dispose(); f.dispose(); }
});

test.each(['shadowlunge_extended', 'shadowlunge_cripple', 'shadowlunge_shadow'])('Shadow Lunge executes %s once', rune => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const f = fixture('Shadow Lunge', rune);
    try {
        if (rune === 'shadowlunge_extended') f.target.position.x = 14;
        f.cast(); expect(f.source.stats.mana).toBe(975); expect(f.source.cooldowns['Shadow Lunge']).toBe(10);
        expect(f.target.bleedTimer).toBe(10);
        expect(f.target.stats.hp).toBe(rune === 'shadowlunge_shadow' ? 9900 : 10000);
        if (rune === 'shadowlunge_cripple') { expect(f.target.slowFactor).toBe(.5); expect(f.target.slowTimer).toBe(3); }
    } finally { f.dispose(); }
});

test.each(['cloak_swift', 'cloak_longer', 'cloak_ambush'])('Cloak captures %s and clears on cancellation', rune => {
    const f = fixture('Cloak & Vanish', rune);
    try {
        f.cast(); f.source.skillRunes = {};
        expect(f.source.stats.mana).toBe(970); expect(f.source.stealthTimer).toBe(rune === 'cloak_longer' ? 10 : 5);
        f.source.isRunning = true; f.source.speedBoostTimer = 0;
        expect(f.source.getMovementAnimationTimeScale(6)).toBeCloseTo(rune === 'cloak_swift' ? 1.3 : 1);
        f.source.stealthTimer = 0; expect(f.source.getMovementAnimationTimeScale(6)).toBe(1);
        f.source.cancelAbilities(); expect(f.source.cloakSwift).toBe(false); expect(f.source.cloakNextAttackBonus).toBe(0);
    } finally { f.dispose(); }
});

test('Prepared Ambush survives utility and rejected attacks, then doubles one basic contact', () => {
    jest.spyOn(Math, 'random').mockReturnValue(.5);
    const f = fixture('Cloak & Vanish', 'cloak_ambush');
    try {
        f.cast(); f.source.unlockedSkills.push('Poison Coating'); f.source.useAbility(f.target.position, f.engine, 'Poison Coating');
        f.source.lastAttackTime = Date.now(); expect(f.source.attack(f.target)).toBe(false); expect(f.source.cloakNextAttackBonus).toBe(1);
        f.source.lastAttackTime = 0; f.source.attack(f.target); f.tasks.splice(0).forEach(t => t());
        expect(f.target.stats.hp).toBe(9800); expect(f.source.cloakNextAttackBonus).toBe(0); expect(f.source.stealthTimer).toBe(0);
        f.source.lastAttackTime = 0; f.source.attack(f.target); f.tasks.splice(0).forEach(t => t()); expect(f.target.stats.hp).toBe(9700);
    } finally { f.dispose(); }
});
