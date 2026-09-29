import { jest } from '@jest/globals';
import * as THREE from 'three';
import { CONSTANTS } from '../src/core/Constants.js';
import { Wizard } from '../src/entities/Wizard.js';

test('every displayed Wizard combo is reachable and each branch has a payoff', () => {
    const tree = CONSTANTS.SKILL_TREES.Wizard, covered = new Set();
    for (const combo of CONSTANTS.SKILL_COMBOS.Wizard) {
        const branches = ['A', 'B', 'C'].filter(branch => {
            const skills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree[`Branch${branch}`][`Tier${t}`].name)];
            return skills.includes(combo.firstSkill) && skills.includes(combo.secondSkill);
        });
        expect(branches.length).toBeGreaterThan(0);
        branches.forEach(branch => covered.add(branch));
    }
    expect([...covered].sort()).toEqual(['A', 'B', 'C']);
});

test.each(['ordinary', 'combo', 'expired', 'intervening'])('Pyromancer Cataclysm has correct paid cadence: %s', mode => {
    jest.spyOn(Date, 'now').mockReturnValue(10000);
    const player = new Wizard('pyromancer'), entities = [];
    player.mesh = new THREE.Group(); player.level = 40; player.recalculateStats();
    player.stats.mana = player.stats.maxMana;
    const tree = CONSTANTS.SKILL_TREES.Wizard;
    player.unlockedSkills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree.BranchA[`Tier${t}`].name)];
    const engine = { currentInstanceId: '', chunkManager: { getActiveEntities: () => [] },
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
        addEntity: entity => entities.push(entity) };
    const cast = skill => player.useAbility(new THREE.Vector3(8, 0, 0), engine, skill);
    try {
        if (mode !== 'ordinary') cast('Flame Tornado');
        if (mode === 'expired') Date.now.mockReturnValue(14000);
        if (mode === 'intervening') cast('Fireball');
        const before = player.stats.mana;
        cast('Inferno Cataclysm');
        const zone = entities.find(entity => entity.type === 'AreaOfEffect');
        expect(zone).toBeDefined();
        expect(zone.damageInterval).toBe(mode === 'combo' ? .5 : 1);
        expect(zone.duration).toBe(8);
        expect(player.stats.mana).toBe(before - 60);
        expect(player.cooldowns['Inferno Cataclysm']).toBeGreaterThan(0);
        expect(player.lastOfflineFlameTornadoAt).toBeNull();
    } finally {
        entities.forEach(entity => entity.dispose?.()); player.dispose(); jest.restoreAllMocks();
    }
});
