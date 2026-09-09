import { chroniclePhoneRoutes } from './e2e/chronicle-phone-routes.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../src/art/ProceduralDungeonEntrances.js';

function clearance(from, to, definition) {
    const [x, , z] = definition.position, dx = to[0] - from[0], dz = to[1] - from[1];
    const projection = Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - from[0] - projection * dx, z - from[1] - projection * dz)
        - definition.interactionRadius - 1.25;
}

test.each(Object.entries(chroniclePhoneRoutes))('%s walking route avoids the production entrance collision circles', (_, waypoints) => {
    const points = [[-1.25, 200], ...waypoints];
    for (let i = 1; i < points.length; i++) {
        for (const entrance of Object.values(DUNGEON_ENTRANCE_DEFINITIONS)) {
            expect({ leg: [points[i - 1], points[i]], entrance: entrance.dungeonType,
                clear: clearance(points[i - 1], points[i], entrance) > 0 }).toEqual(expect.objectContaining({ clear: true }));
        }
    }
});

test('the old direct Air approach cuts through the actual Verdant entrance', () => {
    expect(clearance([500, 200], [900, 200], DUNGEON_ENTRANCE_DEFINITIONS.verdant_bastion_catacombs)).toBeLessThan(0);
});
