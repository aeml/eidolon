import { dungeonTargetApproach, dungeonOccludedTargetStep } from './dungeonTargetApproach.js';
import { partyPathAvoidsActors } from './partyDungeonControls.js';

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

test('recorded Rootheart crowd gets a clear short step instead of walking into the occupied DemonOrc', () => {
    const player = { x: 80008.26123827884, z: 19588.752586675695, radius: 1.25 };
    const target = { x: 80005.75, z: 19587.177734375, range: 4, radius: 1.25 };
    const blockers = [{ x: 80007.109375, z: 19586.04296875, radius: 1.25 },
        { x: 80006.3359375, z: 19586.474609375, radius: 1.25 }];
    expect(partyPathAvoidsActors(player, dungeonTargetApproach(player, target), [target, ...blockers])).toBe(false);
    const step = dungeonOccludedTargetStep(player, target, () => true, blockers);
    expect(step).not.toBeNull();
    expect(Math.hypot(step.dx, step.dz)).toBeCloseTo(3.5);
    expect(partyPathAvoidsActors(player, step, [target, ...blockers])).toBe(true);
});

test('party approaches stop before the body and reject walls or boxed-in positions', () => {
    const player = { x: 0, z: 0 }, target = { x: 10, z: 0, range: 4 };
    expect(dungeonOccludedTargetStep(player, target, () => true)).toEqual({ dx: 6.5, dz: 0 });
    expect(dungeonOccludedTargetStep(player, target, () => false)).toBeNull();
    expect(dungeonOccludedTargetStep(player, target, () => true, [
        { x: 0, z: 2.7 }, { x: 0, z: -2.7 }, { x: -2.7, z: 0 }, { x: 2.7, z: 0 }
    ])).toBeNull();
    expect(dungeonOccludedTargetStep(player, target, null)).toBeNull();
});

test('recorded Tidestar formation can leave through a clear diagonal without crossing a teammate', () => {
    const player = { x: 89999.86216551554, z: 19280.427330579685, radius: 1.25 };
    const target = { x: 90080.87198462577, z: 19276.1464836636, radius: 1.5, range: 4.3 };
    // Saved positions from waterraid0919d: direct, both lateral and backward
    // probes are covered, but this is not a physically boxed-in player.
    const teammates = [
        { x: 89995.8884127942, z: 19282.60540432817, radius: 1.25 },
        { x: 90003.69873016831, z: 19282.688122934334, radius: 1.25 },
        { x: 89999.72884193694, z: 19275.85162674165, radius: 1.25 },
        { x: 89999.4682351088, z: 19284.420662512977, radius: 1.25 }
    ];
    const step = dungeonOccludedTargetStep(player, target, () => true, teammates);
    expect(step).not.toBeNull();
    expect(Math.hypot(step.dx, step.dz)).toBeCloseTo(3.5);
    expect(partyPathAvoidsActors(player, step, [...teammates, target])).toBe(true);
    expect(Math.hypot(target.x - player.x - step.dx, target.z - player.z - step.dz))
        .toBeLessThan(Math.hypot(target.x - player.x, target.z - player.z));
    expect(dungeonOccludedTargetStep(player, target, () => false, teammates)).toBeNull();
});

test('recorded Water wave-two approach advances after a sidestep instead of reversing it', () => {
    const player = { x: 89979.09783508329, z: 19229.755756322513, radius: 1.25 };
    const target = { x: 89922.79918462635, z: 19274.23845122648, radius: 1.5, range: 4.300000071525574 };
    const actors = [
        { x: 89974.78125, z: 19230.740234375, radius: 1.25 },
        { x: 89983.515625, z: 19220.46875, radius: 1.25 },
        { x: 89979.0546875, z: 19243.373046875, radius: 1.25 },
        { x: 89972.78125, z: 19224.509765625, radius: 1.25 },
        { x: 90000, z: 19280, radius: 1.4375 },
        { x: 90054.15624988338, z: 19333.88398418841, radius: 1.5 },
        { x: 89998.859375, z: 19357.8671875, radius: 1.5 },
        { x: 89938.49168266903, z: 19337.639510686808, radius: 1.5 }
    ];
    const initialDistance = Math.hypot(player.x - target.x, player.z - target.z);
    for (let count = 0; count < 12; count++) {
        const step = dungeonOccludedTargetStep(player, target, () => true, actors);
        expect(step).not.toBeNull();
        expect(partyPathAvoidsActors(player, step, [...actors, target])).toBe(true);
        const before = Math.hypot(player.x - target.x, player.z - target.z);
        player.x += step.dx;
        player.z += step.dz;
        expect(Math.hypot(player.x - target.x, player.z - target.z)).toBeLessThan(before);
        if (Math.hypot(player.x - target.x, player.z - target.z) <= target.range) break;
    }
    expect(Math.hypot(player.x - target.x, player.z - target.z)).toBeLessThan(initialDistance - 60);
    expect(Math.hypot(player.x - target.x, player.z - target.z)).toBeLessThanOrEqual(target.range);
});
