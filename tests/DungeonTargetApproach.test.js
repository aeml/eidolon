import { dungeonTargetApproach } from './dungeonTargetApproach.js';

test('an occluded moving enemy is approached at its latest location, not its old encounter position', () => {
    const player = { x: 100, z: 100 };
    expect(dungeonTargetApproach(player, { x: 100, z: 100 })).toBeNull();
    expect(dungeonTargetApproach(player, { x: 100, z: 82 })).toEqual({ dx: 0, dz: -12 });
});

test('nearby approaches keep their true distance without overshooting', () => {
    expect(dungeonTargetApproach({ x: 0, z: 0 }, { x: 3, z: 4 })).toEqual({ dx: 3, dz: 4 });
});

test.each([null, { x: NaN, z: 1 }, { x: 1 }])('missing or invalid actor positions do not invent movement: %j', target => {
    expect(dungeonTargetApproach({ x: 0, z: 0 }, target)).toBeNull();
});
