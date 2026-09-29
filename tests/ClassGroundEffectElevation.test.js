import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AreaOfEffect } from '../src/entities/AreaOfEffect.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Imp } from '../src/entities/Imp.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

function engine() {
    return { terrainElevation: field, currentInstanceId: '', effectScene: new THREE.Group(),
        spawnTransientEffect: jest.fn(), floatingTextManager: { spawn: jest.fn() },
        chunkManager: { getActiveEntities: () => [] } };
}

function checkSurfaces(presentation) {
    presentation.root.updateMatrixWorld(true);
    for (const { part } of presentation.surfaces) {
        const p = part.geometry.attributes.position;
        let lift;
        for (let i = 0; i < p.count; i += 3) {
            const center = new THREE.Vector3();
            for (let j = 0; j < 3; j++) center.add(new THREE.Vector3().fromBufferAttribute(p, i+j).applyMatrix4(part.matrixWorld));
            center.divideScalar(3);
            const y = center.y - field.sample(center.x, center.z);
            lift ??= y;
            expect(y).toBeCloseTo(lift, 4);
            expect(y).toBeGreaterThan(0);
        }
    }
}

test.each(['BurningGround', 'InfernoCataclysm', 'GravityWell', 'SmokeBomb'])('%s conforms markings while preserving animated details and cached art', effectType => {
    const game = engine(), position = new THREE.Vector3(-525, 0, 440);
    const config = { radius: 12, duration: 10, effectType };
    const effect = new AreaOfEffect(game, {}, position, config);
    const flat = new AreaOfEffect({}, {}, position, config);
    const owned = effect.groundPresentation.surfaces.map(entry => entry.part.geometry);
    const cleanup = owned.map(geo => jest.spyOn(geo, 'dispose'));
    for (let step = 0; step < 5; step++) {
        effect.update(.1); effect.render(1); flat.update(.1); flat.render(1);
        checkSurfaces(effect.groundPresentation);
        effect.groundPresentation.surfaces.forEach((entry, index) => {
            expect(entry.part.geometry).toBe(owned[index]);
            expect(flat.mesh.getObjectByName(entry.part.name).geometry).toBe(entry.geometry);
        });
        for (const { part } of effect.groundPresentation.details) {
            const reference = flat.mesh.getObjectByName(part.name);
            const original = reference.getWorldPosition(new THREE.Vector3());
            const actual = part.getWorldPosition(new THREE.Vector3());
            expect(actual.x).toBeCloseTo(original.x, 7);
            expect(actual.z).toBeCloseTo(original.z, 7);
            expect(actual.y).toBeCloseTo(original.y + field.sample(actual.x, actual.z), 7);
        }
    }
    effect.dispose(); effect.dispose(); flat.dispose();
    cleanup.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
});

test('terrain area reach is horizontal and multiplayer never applies local damage', () => {
    const game = engine(), owner = new Wizard('field-owner'), target = new Imp('field-target');
    const position = new THREE.Vector3(-525, 0, 440);
    target.position.set(position.x + 5, 100, position.z);
    target.stats.hp = target.stats.maxHp = 1000;
    const hit = jest.spyOn(target, 'takeDamage');
    const effect = new AreaOfEffect(game, owner, position, { radius: 5, duration: 10, damage: 50, effectType: 'BurningGround' });
    const chunks = { getActiveEntities: () => [target] };
    effect.performTick(chunks);
    expect(hit).toHaveBeenCalledTimes(1);
    game.isMultiplayer = true;
    effect.performTick(chunks);
    expect(hit).toHaveBeenCalledTimes(1);
    effect.dispose(); owner.dispose(); target.dispose();
});

test.each(['dungeon_floor', 'lanternhold-casino'])('%s fields preserve their own floor and do not allocate terrain copies', currentInstanceId => {
    const game = { ...engine(), currentInstanceId };
    const effect = new AreaOfEffect(game, {}, new THREE.Vector3(-525, 8, 440), { radius: 12, duration: 10, effectType: 'InfernoCataclysm' });
    effect.update(.1); effect.render(1);
    expect(effect.position.y).toBe(8);
    expect(effect.mesh.position.y).toBe(8);
    expect(effect.groundPresentation).toBeNull();
    effect.dispose();
});

test('offline Tripwire resolves destination terrain, animates without accumulated lift, triggers and releases its owned surfaces', () => {
    const game = engine(), rogue = new Rogue('hill-trap'), target = new Imp('trap-target');
    rogue.mesh = new THREE.Group();
    rogue.position.set(-525, field.sample(-525, 440), 440);
    rogue.useAbility(new THREE.Vector3(-520, 0, 440), game, 'Tripwire');
    expect(rogue.traps).toHaveLength(1);
    const trap = rogue.traps[0];
    expect(trap.position.y).toBeCloseTo(field.sample(trap.position.x, trap.position.z) + .5);
    const cleanup = trap.groundPresentation.surfaces.map(entry => jest.spyOn(entry.part.geometry, 'dispose'));
    for (let step = 0; step < 4; step++) {
        rogue.update(.1, null, null, game.chunkManager, game.floatingTextManager, game);
        checkSurfaces(trap.groundPresentation);
    }
    target.position.copy(trap.position); target.stats.hp = target.stats.maxHp = 1000;
    rogue.update(.1, null, null, { getActiveEntities: () => [target] }, game.floatingTextManager, game);
    expect(rogue.traps).toHaveLength(0);
    expect(target.stats.hp).toBeLessThan(1000);
    cleanup.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    rogue.dispose(); target.dispose();
});
