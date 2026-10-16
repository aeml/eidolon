import { execFileSync } from 'node:child_process';
import { visualMovingRoutePlan } from './e2e/visual-moving-route-plan.js';
import { WATER_PATHS, WATER_LOCATIONS } from '../src/data/elementalPopulation.js';

test('default visual route preserves the previously qualified Earth path and capture scope', () => {
    const route = visualMovingRoutePlan();
    expect(route.realm).toBe('earth');
    expect(route.waypoints).toEqual([['north-court', 0, 186], ['market-pass', 60, 186], ['east-street', 60, 200],
        ['east-gate', 120, 200], ['earth-road', 240, 200], ['woodland-cut', 470, 200], ['bastion-approach', 760, 200]]);
    expect(route.budgetLabels).toEqual(['town-start', 'earth-road', 'woodland-cut', 'bastion-approach']);
    expect(route.maximumFrames).toBe(900);
    expect(route.maxStepDistance).toBe(20);
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
    expect(() => visualMovingRoutePlan('unknown')).toThrow('earth or water');
});

test.each([
    { realm: 'typo', route: '1', scenario: 'connected-party-observer', error: 'earth or water' },
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
