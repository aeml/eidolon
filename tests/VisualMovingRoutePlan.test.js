import { execFileSync } from 'node:child_process';
import { visualMovingRoutePlan } from './e2e/visual-moving-route-plan.js';
import { WATER_PATHS, WATER_LOCATIONS, FIRE_PATHS, FIRE_LOCATIONS, AIR_PATHS, AIR_LOCATIONS } from '../src/data/elementalPopulation.js';
import { EARTH_PATHS } from '../src/data/worldPopulation.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../src/data/dungeonEntrances.js';
import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { getLanternholdWalkCollider } from '../src/art/ProceduralLanternholdArchitecture.js';

test('default visual route preserves the previously qualified Earth path and capture scope', () => {
    const route = visualMovingRoutePlan();
    expect(route.realm).toBe('earth');
    expect(route.waypoints).toEqual([['north-court', 0, 186], ['market-pass', 60, 186], ['east-street', 60, 200],
        ['east-gate', 120, 200], ['earth-road', 240, 200], ['woodland-cut', 470, 200], ['bastion-approach', 760, 200]]);
    expect(route.budgetLabels).toEqual(['town-start', 'earth-road', 'woodland-cut', 'bastion-approach']);
    expect(route.maximumFrames).toBe(900);
    expect(route.maxStepDistance).toBe(20);
    expect(route.maximumRouteMs ?? 140000).toBe(140000);
    expect(route.testTimeoutMs ?? 230000).toBe(230000);
});

test('Water route follows every authored road waypoint and ends at the public Well approach', () => {
    const route = visualMovingRoutePlan('water');
    const road = WATER_PATHS.find(path => path.id === 'water-passage');
    expect(route.waypoints.slice(-road.points.length).map(([, x, z]) => [x, z])).toEqual(road.points);
    const site = WATER_LOCATIONS.find(site => site.id === 'abyssal-approach');
    expect(route.waypoints.at(-1)).toEqual(['abyssal-approach', site.x + site.arrivalOffset[0], site.z + site.arrivalOffset[1]]);
    expect(route.budgetLabels.every(label => label === 'town-start' || route.waypoints.some(([name]) => label === name))).toBe(true);
    expect(new Set(route.waypoints.map(([name]) => name)).size).toBe(route.waypoints.length);
    expect(route.scope).toContain('normal ground-input');
    expect(route.maxStepDistance).toBe(12);
    expect(route.maximumRouteMs ?? 140000).toBe(140000);
    expect(route.testTimeoutMs ?? 230000).toBe(230000);
    expect(() => visualMovingRoutePlan('unknown')).toThrow('earth, water, fire or air');
});

test.each(['fire', 'air'])('%s follows all shipped road points and reaches the existing outside approach', realm => {
    const route = visualMovingRoutePlan(realm), fire = realm === 'fire';
    const road = (fire ? FIRE_PATHS : AIR_PATHS).find(path => path.id === `${realm}-passage`);
    expect(route.waypoints.slice(-road.points.length).map(([, x, z]) => [x, z])).toEqual(road.points);
    const site = (fire ? FIRE_LOCATIONS : AIR_LOCATIONS).find(site => site.id === (fire ? 'molten-approach' : 'spire-muster'));
    expect(route.waypoints.at(-1).slice(1)).toEqual([site.x + site.arrivalOffset[0], site.z + site.arrivalOffset[1]]);
    expect(route.budgetLabels.every(label => label === 'town-start' || route.waypoints.some(([name]) => label === name))).toBe(true);
    expect(new Set(route.waypoints.map(([name]) => name)).size).toBe(route.waypoints.length);
    expect(route.maximumRouteMs).toBe(240000); expect(route.testTimeoutMs).toBe(350000);
    expect(route.maxStepDistance).toBe(12);
});

test('Air uses every Bastion bypass chord outside the live entrance collision circle', () => {
    const route = visualMovingRoutePlan('air'), bypass = EARTH_PATHS.find(path => path.id === 'bastion-bypass');
    const index = route.waypoints.findIndex(([name]) => name === 'bastion-bypass-0');
    expect(route.waypoints.slice(index, index + bypass.points.length).map(([, x, z]) => [x, z])).toEqual(bypass.points);
    const definition = DUNGEON_ENTRANCE_DEFINITIONS.verdant_bastion_catacombs;
    for (let i = 1; i < bypass.points.length; i++) for (let j = 0; j <= 100; j++) {
        const a = bypass.points[i - 1], b = bypass.points[i], x = a[0] + (b[0] - a[0]) * j / 100, z = a[1] + (b[1] - a[1]) * j / 100;
        expect(Math.hypot(x - definition.position[0], z - definition.position[2])).toBeGreaterThan(definition.interactionRadius + 1.25);
    }
});

test('Fire leaves through the south service route instead of crossing the actual auction-hall footprint', () => {
    const collision = new CollisionManager();
    // Current authoritative town placements. Use the production rotated
    // wall/hearth footprints rather than roof/sign picking bounds.
    for (const [structureId, x, z, rotation] of [['trading_house', -22, 185, Math.PI / 4],
        ['blacksmith', -30, 200, Math.PI / 2], ['stash', -28, 210, 0], ['forge', -28, 218, 0]]) {
        const root = new THREE.Group(); root.userData.structureId = structureId;
        root.position.set(x, 0, z); root.rotation.y = rotation;
        collision.addOrientedCollider(getLanternholdWalkCollider(root));
    }
    const clear = (a, b) => {
        const steps = Math.ceil(a.distanceTo(b) / .25); let previous = a;
        for (let i = 1; i <= steps; i++) {
            const point = a.clone().lerp(b, i / steps), corrected = collision.checkCollision(point, 1.25, previous);
            if (corrected && corrected.distanceTo(point) > .00001) return false;
            previous = point;
        }
        return true;
    };
    expect(clear(new THREE.Vector3(-12.0485, 0, 185.9843), new THREE.Vector3(-24.0485, 0, 185.9883))).toBe(false);
    const route = visualMovingRoutePlan('fire'); let previous = new THREE.Vector3(-1.25, 0, 200);
    for (const [, x, z] of route.waypoints.slice(0, 6)) {
        const point = new THREE.Vector3(x, 0, z); expect(clear(previous, point)).toBe(true); previous = point;
    }
});

test.each([
    { realm: 'typo', route: '1', scenario: 'connected-party-observer', error: 'earth, water, fire or air' },
    { realm: 'water', route: '', scenario: 'connected-party-observer', error: 'ART_ROUTE=1' },
    { realm: 'water', route: '1', scenario: 'connected-party', error: 'connected-party-observer' }
])('invalid visual route preparation stops before database/browser setup: $realm/$route/$scenario', value => {
    try {
        execFileSync('bash', ['scripts/run-terrain-save-qa.sh'], { env: { ...process.env,
            EIDOLON_TERRAIN_ART_REALM: value.realm, EIDOLON_TERRAIN_ART_ROUTE: value.route,
            EIDOLON_TERRAIN_SAVE_QA_SCENARIO: value.scenario }, encoding: 'utf8', stdio: 'pipe' });
        throw new Error('Invalid route unexpectedly launched');
    } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stderr).toContain(value.error);
    }
});
