export const CONSTANTS = {
    SCENE: {
        BACKGROUND_COLOR: 0x202020,
        GROUND_SIZE: 100,
        GROUND_COLOR: 0x333333,
    },
    CAMERA: {
        FOV: 45, // Not used for Orthographic, but good to have
        NEAR: 0.1,
        FAR: 1000,
        ISO_ANGLE_X: Math.atan(-1 / Math.sqrt(2)), // approx -35.264 degrees
        ISO_ANGLE_Y: Math.PI / 4, // 45 degrees
        ZOOM: 15,
        MIN_ZOOM: 5,
        MAX_ZOOM: 30
    },
    ENTITIES: {
        FIGHTER: {
            COLOR: 0xff0000,
            SPEED: 5,
            HP: 100
        },
        ROGUE: {
            COLOR: 0x00ff00,
            SPEED: 8,
            HP: 60
        },
        WIZARD: {
            COLOR: 0x0000ff,
            SPEED: 4,
            HP: 50
        },
        CLERIC: {
            COLOR: 0xffd700,
            SPEED: 5,
            HP: 70
        }
    }
};