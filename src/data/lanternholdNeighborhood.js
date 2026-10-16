// Doors face the shared residential lanes. Keep the four gate roads and the
// service/communal courts open; scenery and authoritative residents share this plan.
export const LANTERNHOLD_HOME_SCALE = 1.7;
// The western paving follows the clear service/residential lane. Its old
// diagonal crossed the planted rest edge and the east wall of the west home.
// This describes the surface and its review route, never collision overrides.
export const LANTERNHOLD_WEST_SERVICE_PATH = Object.freeze([
    [0, 216], [-13, 224], [-40, 224], [-48, 218], [-61, 211], [-61, 200], [-100, 200]
].map(Object.freeze));
export const LANTERNHOLD_HOMES = Object.freeze([
    ...[-74, 74].flatMap(x => [130, 157, 185, 215, 270].map(z =>
        Object.freeze({ x, z, rotation: x < 0 ? Math.PI / 2 : -Math.PI / 2 }))),
    ...[-44, -18, 18, 44].map(x => Object.freeze({ x, z: 278, rotation: Math.PI })),
    Object.freeze({ x: -40, z: 123, rotation: 0 })
]);

export const LANTERNHOLD_RESIDENT_ROUTES = Object.freeze([
    { id: 'chronicle-witness-mara', name: 'Mara Fen', points: [[-58, 256], [-62, 265], [-44, 265], [-44, 256]], pause: 7 },
    { id: 'chronicle-witness-dain', name: 'Dain', points: [[60, 226], [64, 217], [64, 207], [55, 209]], pause: 5 },
    { id: 'chronicle-witness-hessa', name: 'Hessa', points: [[-58, 180], [-61, 169], [-61, 151], [-55, 145]], pause: 9 },
    { id: 'chronicle-witness-selen', name: 'Selen', points: [[48, 149], [60, 146], [61, 158], [48, 159]], pause: 6 }
].map(route => Object.freeze({ ...route, points: Object.freeze(route.points.map(Object.freeze)) })));

export const LANTERNHOLD_RESIDENTIAL_PATHS = Object.freeze([
    { width: 4, points: [[-48, 218], [-61, 211], [-61, 130], [-40, 130], [-40, 229]] },
    { width: 4, points: [[51, 209], [61, 209], [61, 130], [23, 133]] },
    { width: 4, points: [[-55, 248], [-61, 256], [-61, 266], [61, 266], [61, 248]] }
]);
