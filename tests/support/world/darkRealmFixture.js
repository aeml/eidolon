// Presentation-only circuit matching the current authored district dimensions.
// This does not grant access or replace an authenticated expedition check.
export function darkRealmFixture() {
    const rooms = [
        { x: 40000, z: 40800, width: 180, height: 180 },
        { x: 40000, z: 40400, width: 500, height: 500 },
        { x: 39300, z: 40400, width: 500, height: 500 },
        { x: 39300, z: 39700, width: 500, height: 500 },
        { x: 40000, z: 39700, width: 500, height: 500 }
    ];
    return { rooms, walkRects: [...rooms,
        { x: 40000, z: 40600, width: 60, height: 400 },
        { x: 39650, z: 40400, width: 700, height: 60 },
        { x: 39300, z: 40050, width: 60, height: 700 },
        { x: 39650, z: 39700, width: 700, height: 60 },
        { x: 40000, z: 40050, width: 60, height: 700 }
    ] };
}
