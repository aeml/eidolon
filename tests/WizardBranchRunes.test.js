import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

const contract = JSON.parse(readFileSync('server/internal/game/testdata/wizard_branch_runes.json', 'utf8'));
function fixture(row) {
    const source = new Wizard('branch'), target = new Imp('target'), ally = new Fighter('ally'), spawned = [];
    source.mesh = new THREE.Group(); source.level = 100;
    source.stats.intelligence = 40; source.stats.cooldownReduction = 0;
    source.stats.mana = 100; source.stats.maxMana = 1000;
    source.unlockedSkills = [row.skill]; source.skillRunes = { [row.skill]: row.rune };
    target.position.set(10, 0, 0); target.stats.hp = target.stats.maxHp = 10000;
    ally.position.set(20, 0, 0);
    const engine = { currentInstanceId: '', isMultiplayer: false, player: source,
        chunkManager: { getActiveEntities: () => [source, target, ally] },
        isHostileActorTarget: e => e === target, spawnTransientEffect: jest.fn(() => true),
        floatingTextManager: { spawn: jest.fn() }, addEntity: e => spawned.push(e) };
    const hit = jest.spyOn(target, 'takeDamage');
    return { source, target, ally, spawned, engine, hit,
        cast: () => source.useAbility(target.position.clone(), engine, row.skill),
        dispose() { for (const e of spawned) e.dispose(); source.dispose(); target.dispose(); ally.dispose(); } };
}
beforeEach(() => { jest.spyOn(Math, 'random').mockReturnValue(.5); jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test.each(contract)('$skill/$rune pays for its real damage, footprint and support tradeoff', row => {
    const f = fixture(row);
    try {
        Object.assign(f.source.cooldowns, { Teleport: 12, 'Gravity Well': 20 });
        f.ally.cooldowns.Teleport = 11;
        f.cast();
        expect(f.source.cooldowns[row.skill]).toBeCloseTo(row.cooldown);
        expect(getAbilityAoeRadius('Wizard', row.skill, f.source)).toBeCloseTo(row.radius);
        expect(f.source.stats.mana).toBe(100 - row.mana);
        f.source.skillRunes = {}; f.source.stats.intelligence = 999;
        if (row.skill === 'Flame Whip') {
            expect(f.hit.mock.calls[0][0]).toBe(row.damage);
            expect(f.target.stunTimer).toBeCloseTo(row.stun);
        } else if (row.skill === 'Time Warp') {
            expect(f.source.hasteTimer).toBeCloseTo(row.duration);
            expect(f.source.cooldowns.Teleport).toBe(row.resetTeleport ? 0 : 12);
            expect(f.source.cooldowns['Gravity Well']).toBe(row.resetGravity ? 0 : 20);
            expect(f.ally.cooldowns.Teleport).toBe(11);
            expect(f.ally.hasteTimer > 0).toBe(row.radius >= 20);
            expect(f.target.hasteTimer || 0).toBe(0);
        } else {
            expect(f.spawned).toHaveLength(1);
            const effect = f.spawned[0];
            expect(effect.damage).toBe(row.damage); expect(effect.radius).toBeCloseTo(row.radius);
            if (row.skill === 'Flame Tornado') {
                expect(effect.velocity.length()).toBeCloseTo(row.speed);
                expect(effect.scale).toBeCloseTo(row.radius / 3);
            } else {
                expect(effect.duration).toBe(row.duration);
                effect.performTick(f.engine.chunkManager);
                expect(f.hit.mock.calls[0][0]).toBe(row.damage);
                expect(f.ally.stats.hp).toBe(f.ally.stats.maxHp);
            }
        }
    } finally { f.dispose(); }
});

test.each(contract.filter(r => r.rune))('$rune rejected payment cannot create free effects', row => {
    const f = fixture(row);
    try {
        f.source.stats.mana = 0; f.source.cooldowns.Teleport = 12;
        f.cast(); expect(f.spawned).toHaveLength(0); expect(f.hit).not.toHaveBeenCalled();
        expect(f.source.cooldowns.Teleport).toBe(12); expect(f.source.hasteTimer || 0).toBe(0);
        expect(f.source.cooldowns[row.skill] || 0).toBe(0);
    } finally { f.dispose(); }
});

test('Binding Flame respects immunity and preserves longer existing control', () => {
    const row = contract.find(r => r.rune === 'flamewhip_binding');
    for (const immune of [false, true]) {
        const f = fixture(row);
        try { f.target.ccImmune = immune; f.target.stunTimer = 9; f.cast();
            expect(f.hit.mock.calls[0][0]).toBe(row.damage); expect(f.target.stunTimer).toBe(9);
        } finally { f.dispose(); }
    }
});

test('Arcane Missiles launches one immediate authoritative-shaped volley without pending timers', () => {
    const f = fixture({ skill: 'Arcane Missiles', rune: 'arcanemissiles_salvo' });
    try { f.cast(); expect(f.spawned).toHaveLength(5); expect(f.source.managedTimers.size).toBe(0);
        for (const [i, shot] of f.spawned.entries()) {
            expect(shot.velocity.y).toBe(0);
            expect(Math.atan2(shot.velocity.z, shot.velocity.x)).toBeCloseTo((i - 2) * .2);
            expect(shot.position.y).toBe(1.5);
        }
    } finally { f.dispose(); }
});
