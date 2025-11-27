export const CONSTANTS = {
    SCENE: {
        BACKGROUND_COLOR: 0x202020,
        GROUND_SIZE: 1000,
        CHUNK_SIZE: 50, // Entities within this grid size are grouped
        LOAD_DISTANCE: 1, // How many chunks away to load (1 = 3x3 grid active)
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
            MANA_STAT: 'WISDOM',
            STATS: {
                STRENGTH: 10, // Earth
                INTELLIGENCE: 2,
                DEXTERITY: 4,
                WISDOM: 3,
                STAMINA: 8
            }
        },
        ROGUE: {
            COLOR: 0x00ff00,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 4,
                INTELLIGENCE: 5,
                DEXTERITY: 10, // Fire
                WISDOM: 3,
                STAMINA: 5
            }
        },
        WIZARD: {
            COLOR: 0x0000ff,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 2,
                INTELLIGENCE: 10, // Air
                DEXTERITY: 4,
                WISDOM: 6,
                STAMINA: 3
            }
        },
        CLERIC: {
            COLOR: 0xffd700,
            MANA_STAT: 'WISDOM',
            STATS: {
                STRENGTH: 5,
                INTELLIGENCE: 4,
                DEXTERITY: 3,
                WISDOM: 10, // Water
                STAMINA: 6
            }
        },
        SKELETON: {
            COLOR: 0xcccccc,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 3,
                INTELLIGENCE: 1,
                DEXTERITY: 2,
                WISDOM: 1,
                STAMINA: 3
            }
        },
        DEMON_ORC: {
            COLOR: 0x8b0000,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 8,
                INTELLIGENCE: 2,
                DEXTERITY: 4,
                WISDOM: 2,
                STAMINA: 8
            }
        }
    }
};