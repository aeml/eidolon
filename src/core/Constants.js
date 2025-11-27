export const CONSTANTS = {
    SCENE: {
        BACKGROUND_COLOR: 0x202020,
        GROUND_SIZE: 2000,
        WORLD_BOUNDS: 1000,
        CHUNK_SIZE: 50,
        LOAD_DISTANCE: 1,
        GROUND_COLOR: 0x333333,
    },
    CAMERA: {
        FOV: 45,
        NEAR: 0.1,
        FAR: 1000,
        ISO_ANGLE_X: Math.atan(-1 / Math.sqrt(2)),
        ISO_ANGLE_Y: Math.PI / 4,
        ZOOM: 15,
        MIN_ZOOM: 5,
        MAX_ZOOM: 30
    },
    ENTITIES: {
        FIGHTER: {
            COLOR: 0xff0000,
            MANA_STAT: 'WISDOM',
            STATS: {
                STRENGTH: 10,
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
                DEXTERITY: 10,
                WISDOM: 3,
                STAMINA: 5
            }
        },
        WIZARD: {
            COLOR: 0x0000ff,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 2,
                INTELLIGENCE: 10,
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
                WISDOM: 10,
                STAMINA: 6
            }
        },
        SKELETON: {
            COLOR: 0xcccccc,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 5,
                INTELLIGENCE: 2,
                DEXTERITY: 3,
                WISDOM: 2,
                STAMINA: 5
            }
        },
        IMP: {
            COLOR: 0xff4500,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 12,
                INTELLIGENCE: 4,
                DEXTERITY: 6,
                WISDOM: 4,
                STAMINA: 12
            }
        },
        DEMON_ORC: {
            COLOR: 0x8b0000,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 25,
                INTELLIGENCE: 8,
                DEXTERITY: 10,
                WISDOM: 8,
                STAMINA: 25
            }
        },
        CONSTRUCT: {
            COLOR: 0x555555,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 40,
                INTELLIGENCE: 15,
                DEXTERITY: 5,
                WISDOM: 15,
                STAMINA: 40
            }
        }
    }
};