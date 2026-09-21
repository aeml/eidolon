import { jest } from '@jest/globals';
import fs from 'node:fs';
import { collectAdminLandingColliders, formatAdminLandingColliders } from '../scripts/admin-landing-colliders.mjs';

test('server teleport geometry matches current client collision builders', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
        const actual = await collectAdminLandingColliders();
        const saved = fs.readFileSync(new URL('../server/internal/game/content/admin-landing-colliders.json', import.meta.url), 'utf8');
        expect(formatAdminLandingColliders(actual)).toBe(saved);
        expect(actual.overworld.boxes.length).toBeGreaterThan(500);
        expect(actual.overworld.circles).toHaveLength(4);
        expect(actual.casino.boxes.length).toBeGreaterThan(10);
        expect(actual.darkRealm.boxes.length).toBeGreaterThan(20);
        expect(actual.darkRealm.boxes.every(box => box[0] > 38000 && box[1] > 39000)).toBe(true);
        expect(actual.overworld.boxes.every(box => box[0] < 38000)).toBe(true);
        expect(actual.entities.TradingHouse.slice(2, 4)).toEqual([6.175, 5.005]);
        expect(actual.entities.Stash.slice(2, 4)).toEqual([1.775, 1.275]);
    } finally {
        log.mockRestore();
    }
});
