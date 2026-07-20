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
