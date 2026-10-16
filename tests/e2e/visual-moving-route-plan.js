import { WATER_PATHS, FIRE_PATHS, AIR_PATHS } from '../../src/data/elementalPopulation.js';
import { EARTH_PATHS } from '../../src/data/worldPopulation.js';

export function visualMovingRoutePlan(realm = 'earth') {
    if (realm === 'earth') return {
        realm,
        waypoints: [['north-court', 0, 186], ['market-pass', 60, 186], ['east-street', 60, 200],
            ['east-gate', 120, 200], ['earth-road', 240, 200], ['woodland-cut', 470, 200], ['bastion-approach', 760, 200]],
        budgetLabels: ['town-start', 'earth-road', 'woodland-cut', 'bastion-approach'],
        maximumFrames: 900,
        maxStepDistance: 20,
        scope: 'Prepared level30 Fighter, normal ground-input continuous town→gate→Earth road→Verdant approach, actual HUD and native render. Explicit post-login screencast; excluded from subsequent party frame timings. No campaign/encounter clear/mobile/final-art approval.'
    };
    if (realm === 'water') {
        const labels = ['water-passage', 'water-border', 'tide-turn', 'tide-crossing', 'drowned-road', 'abyssal-approach'];
        const points = WATER_PATHS.find(path => path.id === 'water-passage').points;
        if (labels.length !== points.length) throw new Error('Water visual route labels must cover every authored road waypoint');
        return {
            realm,
            // The casino occupies x±13.25, z161.75..178.25. Take its open
            // eastern lane before returning to the north gate centreline.
            waypoints: [['north-court', 0, 186], ['casino-east-lane', 20, 186], ['casino-back-lane', 20, 150],
                ['north-street', 0, 150], ['north-gate', 0, 80], ['water-road', 0, -400],
                ...points.map(([x, z], index) => [labels[index], x, z])],
            budgetLabels: ['town-start', 'water-road', 'water-passage', 'abyssal-approach'],
            maximumFrames: 1800,
            // North/west 20m clicks land under the tracker/minimap at this
            // camera. Keep normal ground clicks in the unobstructed centre.
            maxStepDistance: 12,
            scope: 'Prepared level30 Fighter, normal ground-input continuous town→north gate→authored Water road→Abyssal approach, actual HUD and native render. Explicit post-login screencast; excluded from subsequent party frame timings. No campaign/encounter clear/mobile/final-art approval.'
        };
    }
    if (realm === 'fire' || realm === 'air') {
        const fire = realm === 'fire';
        const road = (fire ? FIRE_PATHS : AIR_PATHS).find(path => path.id === `${realm}-passage`);
        const labels = fire ? ['fire-passage', 'fire-road', 'furnace-turn', 'kiln-road', 'furnace-crossing', 'molten-approach'] :
            ['air-passage', 'air-road', 'aerie-turn', 'sky-road', 'spire-crossing', 'tempest-approach'];
        if (labels.length !== road.points.length) throw new Error('Elemental visual route labels must cover every authored road waypoint');
        const bypass = EARTH_PATHS.find(path => path.id === 'bastion-bypass');
        // The direct west chord at z186 crosses the rotated auction hall.
        // Follow the existing paved service route south of the forge, then
        // cross the centre of the west gate; retain every physical collider.
        const start = fire ? [['south-court', 0, 219], ['west-service-lane', -13, 227], ['west-court', -40, 229],
            ['forge-west-lane', -48, 218], ['west-inner-gate', -100, 200], ['west-gate', -120, 200], ['earth-west-road', -600, 200]] :
            [['north-court', 0, 186], ['market-pass', 60, 186], ['east-street', 60, 200],
                ['east-gate', 120, 200], ['earth-road', 240, 200],
                ...bypass.points.slice(0, -1).map(([x, z], i) => [`bastion-bypass-${i}`, x, z])];
        return {
            realm, waypoints: [...start, ...road.points.map(([x, z], i) => [labels[i], x, z])],
            budgetLabels: ['town-start', fire ? 'earth-west-road' : 'bastion-bypass-2', `${realm}-passage`, labels.at(-1)],
            maximumFrames: 3000, maxStepDistance: 12,
            // These new 2.4–2.6km routes are longer than Earth/Water. Bound
            // their travel and the complete party/save case separately;
            // existing route deadlines and all frame budgets stay unchanged.
            maximumRouteMs: 240_000, testTimeoutMs: 350_000,
            scope: `Prepared level30 Fighter, normal ground-input continuous town→${fire ? 'west gate→authored Fire road→Molten' : 'east gate→authored Bastion bypass→Air road→Tempest'} approach, actual HUD and native render. Explicit post-login screencast; excluded from subsequent party frame timings. No campaign/encounter clear/mobile/final-art approval.`
        };
    }
    throw new Error('Visual moving route realm must be earth, water, fire or air');
}
