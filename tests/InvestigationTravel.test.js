import { jest } from '@jest/globals';

const input = jest.fn(async (page, dx, dz, options) => {
    expect(options.moveOnly).toBe(true);
    page.player.x += dx;
    page.player.z += dz;
});
const pwExpect = value => expect(value);
pwExpect.poll = callback => ({ toBe: async value => expect(await callback()).toBe(value) });
jest.unstable_mockModule('@playwright/test', () => ({ expect: pwExpect }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({
    readPlayerState: async page => ({ ...page.player }), moveByGroundClick: input, returnToTown: jest.fn()
}));
jest.unstable_mockModule('./e2e/fresh-investigation-combat.js', () => ({ createInvestigationTravelDefense: jest.fn() }));
const { walkInvestigationWaypoints } = await import('./e2e/chronicle-investigation-route.js');

function makePage() {
    const page = { player: { x: 0, z: 0, state: 'IDLE' } };
    page.evaluate = async () => ({ ...page.player, hp: 100, cameraDistance: 0 });
    return page;
}

beforeEach(() => input.mockClear());

test('regional waypoint travel defends before every stride and reprojects after a retreat', async () => {
    const page = makePage();
    const beforeTravel = jest.fn(async () => {
        if (beforeTravel.mock.calls.length === 1) page.player.x = -10;
    });
    await walkInvestigationWaypoints(page, [[24, 0]], { beforeTravel });
    expect(page.player.x).toBe(24);
    expect(input).toHaveBeenCalledTimes(3);
    expect(beforeTravel).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) expect(beforeTravel.mock.invocationCallOrder[i])
        .toBeLessThan(input.mock.invocationCallOrder[i]);
});

test('failed defense stops travel without issuing a movement or resetting the character', async () => {
    const failure = new Error('Approach remains contested');
    await expect(walkInvestigationWaypoints(makePage(), [[12, 0]], {
        beforeTravel: async () => { throw failure; }
    })).rejects.toBe(failure);
    expect(input).not.toHaveBeenCalled();
});

test('death during defense fails before another movement', async () => {
    const page = makePage();
    await expect(walkInvestigationWaypoints(page, [[12, 0]], {
        beforeTravel: async () => { page.player.state = 'DEAD'; }
    })).rejects.toThrow();
    expect(input).not.toHaveBeenCalled();
});

test('an already reached waypoint needs no combat or extra movement', async () => {
    const beforeTravel = jest.fn();
    await walkInvestigationWaypoints(makePage(), [[0, 0]], { beforeTravel });
    expect(beforeTravel).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
});
