import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

const skill = 'Time Warp';
const cases = JSON.parse(fs.readFileSync('server/internal/game/testdata/time_warp_area.json', 'utf8'));
describe.each(cases)('$name', entry => {
    test.each([false, true])('paid offline body-padded area outside=%s', outside => {
        const p = new Wizard('warp-caster'), ally = new Cleric('warp-ally');
        try {
            p.unlockedSkills.push(skill); p.talentRanks = entry.ranks;
            p.level = 30; p.recalculateStats();
            p.stats.mana = 200; p.stats.maxMana = 200;
            p.position.set(60000, 40, 60000); ally.radius = 5;
            ally.position.set(p.position.x + entry.radius + 5 + (outside ? .01 : -.01), 0, p.position.z);
            const engine = { chunkManager: { getActiveEntities: () => [p, ally] },
                spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() }, isHostileActorTarget: () => false };
            p.useAbility(p.position.clone().addScalar(100), engine, skill);
            expect(p.stats.mana).toBe(150);
            expect(ally.hasteTimer > 0).toBe(!outside);
            expect(getAbilityAoeRadius('Wizard', skill, p)).toBeCloseTo(entry.radius, 8);
            const rings = engine.spawnTransientEffect.mock.calls.filter(call => call[0] === 'ring');
            expect(rings).toHaveLength(1);
            expect(rings[0][3].radius).toBeCloseTo(entry.radius, 8);
        } finally { p.dispose(); ally.dispose(); }
    });
    test.each(['high', 'low'])('%s predicted and rank-private remote boundary', quality => {
        for (const remote of [false, true]) {
            const p = { id: 'warp-caster', meshType: 'Wizard', position: new THREE.Vector3(60000, 40, 60000),
                mesh: new THREE.Group(), ...(remote ? {} : { talentRanks: entry.ranks }) };
            const engine = { effects: [], uiManager: { getGraphicsQuality: () => quality },
                renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 }, spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
            try {
                if (remote) new AbilityController(engine).triggerRemoteAbilityVisuals(p, skill, p.position.x, p.position.z, { radius: entry.radius, arc: 2 * Math.PI });
                else Actor.prototype.spawnAbilityPresentation.call(p, engine, skill, new THREE.Vector3(60100, 0, 60100));
                const shapes = engine.effects.filter(effect => effect.abilityShape);
                expect(shapes).toHaveLength(1);
                const root = shapes[0].meshes[0];
                const boundary = root.children.find(part => part.userData.normalizedGameplayRadius === 1);
                expect(root.position.x).toBe(p.position.x);
                expect(root.position.z).toBe(p.position.z);
                expect(boundary.scale.x).toBeCloseTo(entry.radius, 8);
                expect(shapes[0].abilityShape.arc).toBeCloseTo(2 * Math.PI, 8);
            } finally { engine.effects.forEach(effect => effect.dispose()); }
        }
    });
});
