import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';

afterEach(() => jest.restoreAllMocks());

test.each([
    { name: 'ordinary' },
    { name: 'equipment', equipment: true },
    { name: 'combo', combo: true },
    { name: 'combo equipment', combo: true, equipment: true },
    { name: 'rune proc', rune: 'backstab_ambush' },
    { name: 'rune miss', rune: 'backstab_ambush', miss: true },
    { name: 'rune equipment', rune: 'backstab_ambush', equipment: true },
    { name: 'all critical sources', combo: true, rune: 'backstab_ambush', equipment: true },
    { name: 'armored combo', combo: true, armor: 20 },
    { name: 'eviscerate combo', combo: true, rune: 'backstab_eviscerate', armor: 20 },
    { name: 'expired combo', combo: true, expired: true },
    { name: 'rejected attempt preserves combo', combo: true, rejectFirst: true }
])('$name paid offline Backstab shares one critical after armor', config => {
    jest.spyOn(Math, 'random').mockReturnValue(config.miss ? .75 : .25);
    let now = 10000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const actor = new Rogue('ambush-caster');
    const target = new Imp('ambush-target');
    try {
        actor.mesh = new THREE.Group();
        actor.position.set(0, 0, 0);
        actor.stats.damage = 100;
        actor.stats.mana = 1000;
        actor.stats.critChanceBonus = config.equipment ? 1 : 0;
        actor.unlockedSkills.push('Cloak & Vanish', 'Backstab');
        actor.skillRunes = { Backstab: config.rune };
        target.mesh = new THREE.Group();
        target.mesh.rotation.y = Math.PI;
        target.position.set(0, 0, 2);
        target.stats.hp = target.stats.maxHp = 10000;
        target.stats.defense = config.armor || 0;
        const engine = { chunkManager: { getActiveEntities: () => [target] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
        if (config.combo) {
            const mana = actor.stats.mana;
            actor.useAbility(actor.position, engine, 'Cloak & Vanish');
            expect(actor.stats.mana).toBeLessThan(mana);
            now += config.expired ? 3001 : 600;
        }
        if (config.rejectFirst) {
            target.position.z = 100;
            const mana = actor.stats.mana;
            expect(actor.useAbility(target.position, engine, 'Backstab')).toBe(false);
            expect(actor.stats.mana).toBe(mana);
            target.position.z = 2;
        }
        const mana = actor.stats.mana;
        actor.useAbility(target.position, engine, 'Backstab');
        expect(actor.stats.mana).toBeLessThan(mana);
        const armor = (config.armor || 0) * (config.rune === 'backstab_eviscerate' ? .5 : 1);
        const critical = config.equipment || config.combo && !config.expired || config.rune === 'backstab_ambush' && !config.miss;
        expect(10000 - target.stats.hp).toBe((150 - armor) * (critical ? 2 : 1));
        if (config.combo && !config.expired) {
            expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('COMBO: Ambush!', actor.position, '#ffd700');
        }
    } finally { actor.dispose(); target.dispose(); }
});
