import * as THREE from 'three';
import { InputManager } from '../src/core/InputManager.js';
import { intersectEngineGround } from '../src/core/WorldGrounding.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';
import { AbilityController } from '../src/core/AbilityController.js';

test('elevated ability range remains horizontal without changing body-radius or instance rules', () => {
    const engine = { terrainElevation: field, player: { position: new THREE.Vector3(-570, 4, 410) } };
    const controller = new AbilityController(engine);
    const target = { position: new THREE.Vector3(-558, 10, 410), radius: 1.5 };
    expect(controller.getAbilityTargetDistance(target, 'Fireball')).toBe(12);
    expect(controller.getAbilityTargetDistance(target, 'Unbreakable Grip')).toBe(10.5);
    engine.currentInstanceId = 'dungeon_test';
    expect(controller.getAbilityTargetDistance(target, 'Fireball')).toBeCloseTo(Math.hypot(12, 6), 9);
});

test('event and held-pointer ground queries hit the raised mesh and follow scene ownership', () => {
    const focus = new THREE.Vector3(-570, field.sample(-570, 410), 410);
    const camera = new THREE.OrthographicCamera(-40, 40, 30, -30, .1, 500);
    camera.position.copy(focus).add(new THREE.Vector3(50, 80, 70));
    camera.lookAt(focus); camera.updateMatrixWorld(true);
    const input = new InputManager(camera, new THREE.Scene());
    const engine = { terrainElevation: field, currentInstanceId: '' };
    input.groundIntersectionResolver = (ray, target, plane) => intersectEngineGround(engine, ray, target, plane);
    try {
        const ndc = focus.clone().project(camera);
        const event = { clientX: (ndc.x + 1) / 2 * innerWidth, clientY: (1 - ndc.y) / 2 * innerHeight };
        input.mouse.set(.9, .9); // Click coordinates win even without mousemove.
        expect(input.getGroundIntersectionFromEvent(event).distanceTo(focus)).toBeLessThan(1e-6);
        input.updateMouseFromEvent(event);
        expect(input.getGroundIntersection().distanceTo(focus)).toBeLessThan(1e-6);
        for (const [instance, height] of [['dungeon_test', 0], ['lanternhold-casino', 8], ['arena_test', 0]]) {
            engine.currentInstanceId = instance;
            input.groundPlane.constant = -height;
            expect(input.getGroundIntersection().y).toBeCloseTo(height, 9);
            expect(input.getGroundIntersectionFromEvent(event).y).toBeCloseTo(height, 9);
        }
        engine.currentInstanceId = ''; input.groundPlane.constant = 0;
        expect(input.getGroundIntersection().distanceTo(focus)).toBeLessThan(1e-6);
        engine.terrainElevation = null;
        expect(input.getGroundIntersection().y).toBe(0);
    } finally { input.dispose(); }
});

test('an unsupported shallow terrain ray cannot silently fall back to the old plane', () => {
    const input = new InputManager(null, null);
    const engine = { terrainElevation: field };
    input.groundIntersectionResolver = (ray, target, plane) => intersectEngineGround(engine, ray, target, plane);
    try {
        input.raycaster.ray.set(new THREE.Vector3(-570, 30, 410), new THREE.Vector3(1, -.01, 0).normalize());
        expect(input.raycaster.ray.intersectPlane(input.groundPlane, new THREE.Vector3())).not.toBeNull();
        expect(input.intersectGroundRay()).toBeNull();
    } finally { input.dispose(); }
});
