import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: { decode: jest.fn() }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');
const { Actor } = await import('../src/entities/Actor.js');
const { Fighter } = await import('../src/entities/Fighter.js');

const actorConfig = {
    STATS: {
        STRENGTH: 10,
        INTELLIGENCE: 10,
        DEXTERITY: 10,
        WISDOM: 10,
        STAMINA: 10
    },
    MANA_STAT: 'INTELLIGENCE'
};

describe('GameEngine raycast target priority', () => {
    test('a friendly player hitbox cannot intercept a hostile behind it', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = new Fighter('local-player');

        const partyMember = new Fighter('party-member');
        partyMember.isActive = true;
        partyMember.state = 'IDLE';

        const hostile = new Actor('hostile', actorConfig);
        hostile.isActive = true;
        hostile.state = 'ATTACKING';

        expect(engine.sortRaycastEntities([partyMember, hostile, partyMember])).toEqual([
            hostile,
            partyMember
        ]);
    });
});
