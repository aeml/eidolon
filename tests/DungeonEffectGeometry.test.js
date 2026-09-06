import { clipDungeonEffectSegment, resolveDungeonBeamEndpoint } from '../src/skills/dungeonEffectGeometry.js';

const rooms = [
    { x: 50000, z: 50000, width: 20, height: 20 },
    { x: 50020.5, z: 50000, width: 20, height: 20 }
];
const from = { x: 50009, z: 50000 };
const aim = { x: 50011, z: 50000 };

describe('dungeon effect geometry', () => {
    test('stops at a thin gap even if the destination is valid floor', () => {
        expect(clipDungeonEffectSegment(rooms, from, aim)).toEqual({ x: 50010, z: 50000, blocked: true });
    });
    test('open overlapping doorway joins are not walls', () => {
        const rects = [...rooms, { x: 50010, z: 50000, width: 5, height: 6 }];
        expect(clipDungeonEffectSegment(rects, from, aim)).toEqual({ ...aim, blocked: false });
        expect(resolveDungeonBeamEndpoint(rects, from, aim, 18)).toEqual({ x: 50027, z: 50000, blocked: false });
    });
    test('beam starts and ends on the visible side of the wall', () => {
        expect(resolveDungeonBeamEndpoint(rooms, from, aim, 18)).toEqual({ x: 50010, z: 50000, blocked: true });
        expect(resolveDungeonBeamEndpoint(rooms, aim, from, 18)).toEqual({ x: 50010.5, z: 50000, blocked: true });
    });
    test('close aiming preserves full beam range in legacy or overworld geometry', () => {
        expect(resolveDungeonBeamEndpoint([], from, aim, 18)).toEqual({ x: 50027, z: 50000, blocked: false });
    });
    test('zero direction, invalid values and off-floor origins fail safely', () => {
        expect(resolveDungeonBeamEndpoint(rooms, from, from, 18)).toEqual({ ...from, blocked: false });
        expect(resolveDungeonBeamEndpoint(rooms, from, { x: NaN, z: 0 }, 18).blocked).toBe(true);
        expect(clipDungeonEffectSegment(rooms, { x: 50010.25, z: 50000 }, aim)).toEqual({ x: 50010.25, z: 50000, blocked: true });
    });
    test('diagonal paths stop at the first wall, independently of rectangle order', () => {
        const result = clipDungeonEffectSegment(rooms, { x: 50000, z: 50000 }, { x: 50020, z: 50020 });
        expect(result).toEqual({ x: 50010, z: 50010, blocked: true });
        expect(clipDungeonEffectSegment([...rooms].reverse(), { x: 50000, z: 50000 }, { x: 50020, z: 50020 })).toEqual(result);
    });
});
