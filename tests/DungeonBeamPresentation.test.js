import * as THREE from 'three';
import { GameEngine } from '../src/core/GameEngine.js';
import { Actor } from '../src/entities/Actor.js';
import { AbilityController } from '../src/core/AbilityController.js';

describe('dungeon beam presentation', () => {
    test.each(['overworld', 'legacy'])('%s keeps full range without mutating the aim or source', instance => {
        const source = { meshType: 'Wizard', position: new THREE.Vector3(50009, 0, 50000),
            mesh: { quaternion: new THREE.Quaternion() }, skillRunes: {} };
        const aim = new THREE.Vector3(50011, 0, 50000);
        const engine = { effects: [], currentInstanceType: instance, currentInstanceId: instance,
            // A stale layout must not affect overworld casts; legacy dungeons
            // without a canonical layout retain their unobstructed line.
            currentDungeonLayout: instance === 'overworld'
                ? { walkRects: [{ x: 50000, z: 50000, width: 20, height: 20 }] } : null,
            renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
            spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
        Actor.prototype.spawnAbilityPresentation.call(source, engine, 'Scorch Beam', aim);
        try {
            const tip = engine.effects[0].meshes[0].getObjectByName('Wizard:Scorch Beam:0:beam:TargetBrand');
            expect(tip.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(50027);
            expect(aim.toArray()).toEqual([50011, 0, 50000]);
            expect(source.position.toArray()).toEqual([50009, 0, 50000]);
        } finally { for (const effect of engine.effects) effect.dispose(); }
    });
    for (const quality of ['high', 'low']) {
        for (const doorway of [false, true]) {
            for (const remote of [false, true]) {
                test(`${quality}, doorway=${doorway}, remote=${remote}: actual beam mesh ends at the authoritative limit`, () => {
                    const source = { meshType: 'Wizard', position: new THREE.Vector3(50009, 0, 50000),
                        mesh: { quaternion: new THREE.Quaternion() }, skillRunes: {} };
                    const rects = [
                        { x: 50000, z: 50000, width: 20, height: 20 },
                        { x: 50020.5, z: 50000, width: 20, height: 20 }
                    ];
                    if (doorway) rects.push({ x: 50010, z: 50000, width: 5, height: 6 });
                    const engine = { effects: [], currentDungeonLayout: { walkRects: rects },
                        currentInstanceId: 'dungeon-beam-test', uiManager: { getGraphicsQuality: () => quality },
                        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
                        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
                    if (remote) {
                        AbilityController.prototype.triggerRemoteAbilityVisuals.call({ engine }, source, 'Scorch Beam', 50011, 50000);
                    } else {
                        Actor.prototype.spawnAbilityPresentation.call(source, engine, 'Scorch Beam', new THREE.Vector3(50011, 0, 50000));
                    }
                    try {
                        expect(engine.effects).toHaveLength(1);
                        const root = engine.effects[0].meshes[0];
                        const tip = root.getObjectByName('Wizard:Scorch Beam:0:beam:TargetBrand');
                        expect(tip).toBeDefined();
                        const endpoint = tip.getWorldPosition(new THREE.Vector3());
                        expect(endpoint.x).toBeCloseTo(doorway ? 50027 : 50010);
                        expect(endpoint.z).toBeCloseTo(50000);
                    } finally {
                        for (const effect of engine.effects) effect.dispose();
                    }
                });
            }
        }
    }
});
