import { jest } from '@jest/globals';
import { WorldGenerator } from '../src/world/WorldGenerator.js';

function createGenerator() {
    const scene = { add: jest.fn() };
    const collisionManager = {
        addCollider: jest.fn(),
        addCircularCollider: jest.fn()
    };
    const generator = new WorldGenerator(scene, collisionManager);
    generator.preloadTextures = jest.fn().mockResolvedValue();
    generator.createRoom = jest.fn();
    generator.createCorridor = jest.fn();
    generator.createCorner = jest.fn();
    return generator;
}

function buildCanonicalLayout() {
    return {
        rooms: [
            { x: 0, z: 0, width: 80, color: 0x111111, type: 'start' },
            { x: 100, z: 100, width: 80, color: 0x222222, type: 'boss' }
        ],
        walkRects: [
            { x: 0, z: 0, width: 80, height: 80, kind: 'room', roomIndex: 0 },
            { x: 100, z: 100, width: 80, height: 80, kind: 'room', roomIndex: 1 },
            { x: 57.5, z: 0, width: 85, height: 20, kind: 'corridor' },
            { x: 100, z: 45, width: 20, height: 90, kind: 'corridor' }
        ],
        corridors: [
            {
                fromRoomIndex: 0,
                toRoomIndex: 1,
                width: 20,
                walkRectIndices: [2, 3]
            }
        ]
    };
}

function buildLargeBossApproachLayout() {
    return {
        rooms: [
            { x: 0, z: 0, width: 100, height: 100, color: 0x111111, type: 'start' },
            { x: 80, z: -180, width: 180, height: 180, color: 0x222222, type: 'boss' }
        ],
        walkRects: [
            { x: 0, z: 0, width: 100, height: 100, kind: 'room', roomIndex: 0 },
            { x: 80, z: -180, width: 180, height: 180, kind: 'room', roomIndex: 1 },
            { x: 0, z: -60, width: 40, height: 60, kind: 'corridor' },
            { x: 40, z: -70, width: 120, height: 40, kind: 'corridor' },
            { x: 80, z: -80, width: 40, height: 60, kind: 'corridor' }
        ],
        corridors: [
            {
                fromRoomIndex: 0,
                toRoomIndex: 1,
                width: 40,
                walkRectIndices: [2, 3, 4]
            }
        ]
    };
}

describe.each([
    ['createVerdantBastionCatacombs'],
    ['createMoltenCore'],
    ['createTempestSpire'],
    ['createAbyssalWell']
])('%s', (methodName) => {
    test('uses canonical corridor walk rects and corridor attachments when present', async () => {
        const generator = createGenerator();

        await generator[methodName](0, 0, buildCanonicalLayout());

        expect(generator.createCorridor.mock.calls).toEqual([
            [40, 0, 100, 0, 20, 0, 0],
            [100, 0, 100, 60, 20, 0, 0]
        ]);

        expect(generator.createCorner.mock.calls).toEqual([
            [100, 0, 20, { west: true, south: true }]
        ]);

        expect(generator.createRoom.mock.calls[0]).toEqual([
            0,
            0,
            80,
            0x111111,
            { east: true }
        ]);
        expect(generator.createRoom.mock.calls[1]).toEqual([
            100,
            100,
            80,
            0x222222,
            { north: true }
        ]);
    });

    test('uses canonical boss approaches that leave a non-zero final segment into large rooms', async () => {
        const generator = createGenerator();

        await generator[methodName](0, 0, buildLargeBossApproachLayout());

        expect(generator.createCorridor.mock.calls).toEqual([
            [0, -50, 0, -70, 40, 0, 0],
            [0, -70, 80, -70, 40, 0, 0],
            [80, -70, 80, -90, 40, 0, 0]
        ]);

        expect(generator.createCorner.mock.calls).toEqual([
            [0, -70, 40, { south: true, east: true }],
            [80, -70, 40, { west: true, north: true }]
        ]);

        const finalSegment = generator.createCorridor.mock.calls[2];
        expect(Math.abs(finalSegment[3] - finalSegment[1])).toBeGreaterThan(0);

        expect(generator.createRoom.mock.calls[0]).toEqual([
            0,
            0,
            100,
            0x111111,
            { north: true }
        ]);
        expect(generator.createRoom.mock.calls[1]).toEqual([
            80,
            -180,
            180,
            0x222222,
            { south: true }
        ]);
    });

    test('falls back to legacy room-order routing when canonical geometry is absent', async () => {
        const generator = createGenerator();
        const layout = {
            rooms: [
                { x: 0, z: 0, width: 80, color: 0x111111, type: 'start' },
                { x: 100, z: 100, width: 80, color: 0x222222, type: 'boss' }
            ]
        };

        await generator[methodName](0, 0, layout);

        expect(generator.createCorridor.mock.calls).toEqual([
            [0, 0, 50, 0, 40, 40, 20],
            [50, 0, 50, 100, 40, 20, 20],
            [50, 100, 100, 100, 40, 20, 40]
        ]);

        expect(generator.createCorner.mock.calls).toEqual([
            [50, 0, 40, { west: true, south: true }],
            [50, 100, 40, { north: true, east: true }]
        ]);

        expect(generator.createRoom.mock.calls[0]).toEqual([
            0,
            0,
            80,
            0x111111,
            { east: true }
        ]);
        expect(generator.createRoom.mock.calls[1]).toEqual([
            100,
            100,
            80,
            0x222222,
            { west: true }
        ]);
    });
});
