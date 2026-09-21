import { dungeonTownReturnRoute } from './dungeonTraversalRoutes.js';

const layout = {
    rooms: ['start', 'normal', 'boss', 'normal', 'boss', 'normal'].map((type, i) => ({ type, x: 0, z: i * -100 })),
    corridors: Array.from({ length: 5 }, (_, i) => ({ fromRoomIndex: i, toRoomIndex: i + 1 }))
};
const summary = count => ({ rooms: layout.rooms.map((_, i) => ({ cleared: i <= count })) });
const at = index => ({ ...layout.rooms[index], health: 100, state: 'IDLE' });

test.each([[0, 0], [1, 0], [2, 2], [3, 2], [4, 4]])('town recovery resumes from cleared boss %i at route %i', (cleared, checkpoint) => {
    expect(dungeonTownReturnRoute(layout, summary(cleared), at(checkpoint))).toBe(checkpoint);
});

test('an uncleared predecessor cannot be skipped and a misplaced landing is not accepted', () => {
    const gaps = summary(4);
    gaps.rooms[3].cleared = false;
    expect(dungeonTownReturnRoute(layout, gaps, at(2))).toBe(2);
    expect(() => dungeonTownReturnRoute(layout, gaps, at(4))).toThrow('checkpoint');
    expect(() => dungeonTownReturnRoute(layout, summary(4), at(0))).toThrow('checkpoint');
    expect(() => dungeonTownReturnRoute(layout, summary(4), { ...at(4), health: 0 })).toThrow('checkpoint');
    expect(() => dungeonTownReturnRoute(layout, summary(4), { ...at(4), state: 'DEAD' })).toThrow('checkpoint');
});
