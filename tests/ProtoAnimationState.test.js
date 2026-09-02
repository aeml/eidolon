import { eidolon } from '../src/proto/state_pb.js';

const ANIMATION_BUFF_FIELDS = Object.freeze([
    ['ironFortressActive', 'ironFortressDuration'],
    ['guardianRoarActive', 'guardianRoarDuration'],
    ['berserkerModeActive', 'berserkerModeDuration'],
    ['lastStandActive', 'lastStandDuration'],
    ['serratedEdgesActive', 'serratedEdgesDuration'],
    ['poisonCoatingActive', 'poisonCoatingDuration'],
    ['stealthActive', 'stealthDuration'],
    ['zealActive', 'zealDuration']
]);

describe('authoritative animation buff protocol', () => {
    test('round-trips every persistent visual state and remaining duration', () => {
        const input = { id: 'animation-buff-protocol' };
        ANIMATION_BUFF_FIELDS.forEach(([activeKey, durationKey], index) => {
            input[activeKey] = true;
            input[durationKey] = index + 0.5;
        });

        const encoded = eidolon.state.Entity.encode(input).finish();
        const decoded = eidolon.state.Entity.decode(encoded);

        ANIMATION_BUFF_FIELDS.forEach(([activeKey, durationKey], index) => {
            expect(decoded[activeKey]).toBe(true);
            expect(decoded[durationKey]).toBeCloseTo(index + 0.5, 4);
        });
    });
});

describe('ordered movement protocol', () => {
    test('round-trips movement acknowledgement and server tick fields', () => {
        const serverTimeMs = 1_784_564_218_123;
        const envelope = {
            version: 1,
            serverTimeMs,
            delta: {
                entities: [{
                    id: 'movement-protocol-player',
                    x: 4,
                    z: 8,
                    state: 'MOVING',
                    moveSequence: 928
                }],
                removedIds: []
            }
        };

        const encoded = eidolon.state.StateEnvelope.encode(envelope).finish();
        const decoded = eidolon.state.StateEnvelope.decode(encoded);

        expect(Number(decoded.serverTimeMs)).toBe(serverTimeMs);
        expect(decoded.delta.entities[0]).toEqual(expect.objectContaining({
            id: 'movement-protocol-player',
            state: 'MOVING'
        }));
        expect(Number(decoded.delta.entities[0].moveSequence)).toBe(928);
    });
});

describe('complete equipment metadata protocol', () => {
    test('materializes an explicit empty equipment map so final-slot unequips clear observers', () => {
        const encoded = eidolon.state.Entity.encode({ id: 'unequipped-player', equipment: {} }).finish();
        const decoded = eidolon.state.Entity.decode(encoded);

        expect(Object.prototype.hasOwnProperty.call(decoded, 'equipment')).toBe(true);
        expect(decoded.equipment).toEqual({});
    });

    test('round-trips set, unique-effect, stat-scale, and socket identity', () => {
        const encoded = eidolon.state.Entity.encode({
            id: 'equipped-player',
            equipment: {
                mainHand: {
                    id: 'oath-blade',
                    name: 'Hearty Iron Sword of the Whale',
                    type: 'WEAPON',
                    rarity: 'Legendary',
                    slot: 'mainHand',
                    level: 100,
                    potency: 5,
                    sockets: 2,
                    setId: 'warlord_fury',
                    uniqueEffect: 'swift',
                    statScaleVersion: 1,
                    gems: [{ type: 'Ruby', quality: 'Flawless', stats: { strength: 4 } }]
                }
            }
        }).finish();

        const item = eidolon.state.Entity.decode(encoded).equipment.mainHand;
        expect(item).toEqual(expect.objectContaining({
            id: 'oath-blade',
            setId: 'warlord_fury',
            uniqueEffect: 'swift',
            statScaleVersion: 1
        }));
        expect(item.gems).toHaveLength(1);
        expect(item.gems[0]).toEqual(expect.objectContaining({
            type: 'Ruby',
            quality: 'Flawless',
            stats: expect.objectContaining({ strength: 4 })
        }));
    });
});
