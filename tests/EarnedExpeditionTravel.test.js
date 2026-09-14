import { jest } from '@jest/globals';

jest.unstable_mockModule('@playwright/test', () => ({ expect: value => expect(value) }));
const readPlayerState = jest.fn(async page => ({ ...page.player }));
const projectEntity = jest.fn(async page => ({ visible: page.distance() < 30 }));
const moveByGroundClick = jest.fn(async (page, dx, dz, options) => {
    const distance = Math.hypot(dx, dz);
    // A normal movement observation can return after ~3 units of a 12-unit
    // request. This reproduced the failed return near x=-189, before Imp range.
    const traveled = Math.min(distance, Math.max(3.1, (options.minimumDistance || 1) + .1));
    page.player.x += dx / distance * traveled;
    page.player.z += dz / distance * traveled;
    return { ...page.player };
});
jest.unstable_mockModule('./e2e/helpers.js', () => ({ readPlayerState, projectEntity, moveByGroundClick }));
const { findExpeditionTarget } = await import('./e2e/earned-expedition-target.js');
const hunt = { huntingRealm: 'earth', enemy: 'Imp', minEnemyLevel: 20 };

function expeditionPage() {
    const page = { player: { x: 123.5, z: 200, level: 9, state: 'MOVING' } };
    page.distance = () => Math.hypot(page.player.x + 260, page.player.z - 200);
    page.evaluate = jest.fn(async () => page.distance() < 50
        ? [{ id: 'imp', level: 20, x: -260, z: 200, distance: page.distance(), rendered: true }] : []);
    return page;
}

beforeEach(() => jest.clearAllMocks());

test('ordinary return from town reaches the western Imp band within the existing step limit', async () => {
    const page = expeditionPage();
    await expect(findExpeditionTarget(page, hunt)).resolves.toMatchObject({ id: 'imp', level: 20 });
    expect(moveByGroundClick.mock.calls.length).toBeLessThan(100);
    expect(page.player.x).toBeLessThan(-230);
    for (const [, dx, dz, options] of moveByGroundClick.mock.calls) {
        expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(12.00001);
        expect(options.moveOnly).toBe(true);
    }
});

test('an expired encounter deadline still stops travel without issuing another movement', async () => {
    await expect(findExpeditionTarget(expeditionPage(), hunt, Date.now() - 1)).rejects.toThrow('No reachable Imp');
    expect(moveByGroundClick).not.toHaveBeenCalled();
});

test('death during ordinary travel still fails rather than granting entry or resurrecting', async () => {
    const page = expeditionPage();
    page.player.state = 'DEAD';
    await expect(findExpeditionTarget(page, hunt)).rejects.toThrow();
    expect(moveByGroundClick).not.toHaveBeenCalled();
});
