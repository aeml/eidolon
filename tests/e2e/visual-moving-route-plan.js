import { WATER_PATHS } from '../../src/data/elementalPopulation.js';

export function visualMovingRoutePlan(realm = 'earth') {
    if (realm === 'earth') return {
        realm,
        waypoints: [['north-court', 0, 186], ['market-pass', 60, 186], ['east-street', 60, 200],
            ['east-gate', 120, 200], ['earth-road', 240, 200], ['woodland-cut', 470, 200], ['bastion-approach', 760, 200]],
        budgetLabels: ['town-start', 'earth-road', 'woodland-cut', 'bastion-approach'],
        maximumFrames: 900,
        scope: 'Prepared level30 Fighter, normal ground-input continuous town→gate→Earth road→Verdant approach, actual HUD and native render. Explicit post-login screencast; excluded from subsequent party frame timings. No campaign/encounter clear/mobile/final-art approval.'
    };
    if (realm === 'water') {
        const labels = ['water-passage', 'water-border', 'tide-turn', 'tide-crossing', 'drowned-road', 'abyssal-approach'];
        const points = WATER_PATHS.find(path => path.id === 'water-passage').points;
        if (labels.length !== points.length) throw new Error('Water visual route labels must cover every authored road waypoint');
        return {
            realm,
            waypoints: [['north-court', 0, 186], ['north-street', 0, 120], ['north-gate', 0, 80], ['water-road', 0, -400],
                ...points.map(([x, z], index) => [labels[index], x, z])],
            budgetLabels: ['town-start', 'water-road', 'water-passage', 'abyssal-approach'],
            maximumFrames: 1800,
            scope: 'Prepared level30 Fighter, normal ground-input continuous town→north gate→authored Water road→Abyssal approach, actual HUD and native render. Explicit post-login screencast; excluded from subsequent party frame timings. No campaign/encounter clear/mobile/final-art approval.'
        };
    }
    throw new Error('Visual moving route realm must be earth or water');
}
