import { jest } from '@jest/globals';
import { eidolon } from '../src/proto/state_pb.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Fighter } from '../src/entities/Fighter.js';

const buffs = [
    { id: 'berserker_edge', active: 'berserkerModeActive', duration: 'berserkerModeDuration', wire: 'berserkerModeMultiplier', property: 'berserkerEdgeMultiplier', timer: 'berserkerEdgeTimer', values: [1.5, 1.56, 1.8], base: 1.5 },
    { id: 'last_stand', active: 'lastStandActive', duration: 'lastStandDuration', wire: 'lastStandMultiplier', property: 'lastStandMultiplier', timer: 'lastStandTimer', values: [3, 3.12, 3.6], base: 3 }
];

describe.each(buffs)('$id', buff => {
    test.each([0, 1, 2])('actual protobuf preserves rank case %s', index => {
        const value = buff.values[index];
        const packet = eidolon.state.Entity.decode(eidolon.state.Entity.encode({
            [buff.active]: true, [buff.duration]: 8, [buff.wire]: value
        }).finish());
        expect(packet[buff.wire]).toBeCloseTo(value, 6);
        for (const method of ['syncPlayerSupportEffects', 'syncRemoteSupportEffects']) {
            const actor = new Fighter('wire-buff-owner');
            const engine = Object.assign(Object.create(GameEngine.prototype), { player: actor, showRemoteSupportStateReadability: jest.fn() });
            try {
                engine[method](actor, packet);
                expect(actor[buff.property]).toBeCloseTo(value, 6);
                expect(engine.getActiveBuffs().find(entry => entry.id === buff.id).detail)
                    .toContain(`+${Math.round((value - 1) * 100)}% Damage stat`);
            } finally { actor.dispose(); }
        }
    });

    test.each(['syncPlayerSupportEffects', 'syncRemoteSupportEffects'])('%s displays and clears stored strength', method => {
        const actor = new Fighter('damage-buff-owner');
        const engine = Object.assign(Object.create(GameEngine.prototype), { player: actor, showRemoteSupportStateReadability: jest.fn() });
        try {
            actor.talentRanks = {}; // Never infer another player's private training.
            const damage = actor.stats.damage;
            for (const multiplier of buff.values) {
                engine[method](actor, { [buff.active]: true, [buff.duration]: 8, [buff.wire]: multiplier });
                expect(actor[buff.property]).toBeCloseTo(multiplier, 6);
                expect(actor.stats.damage).toBe(damage); // Server stat snapshots own gameplay damage.
                expect(engine.getActiveBuffs().find(value => value.id === buff.id).detail)
                    .toContain(`+${Math.round((multiplier - 1) * 100)}% Damage stat`);
                engine[method](actor, { [buff.duration]: 4 });
                expect(actor[buff.property]).toBeCloseTo(multiplier, 6);
            }
            engine[method](actor, { [buff.wire]: buff.base });
            expect(actor[buff.property]).toBe(buff.base);
            engine[method](actor, { [buff.active]: false, [buff.duration]: 0, [buff.wire]: 0 });
            expect(actor[buff.property]).toBe(1);
            expect(actor[buff.timer]).toBe(0);
            expect(engine.getActiveBuffs().some(value => value.id === buff.id)).toBe(false);
        } finally { actor.dispose(); }
    });

    test('scalar-only cannot grant a buff; legacy and malformed active strengths have safe defaults', () => {
        const actor = new Fighter('damage-buff-legacy');
        const engine = Object.assign(Object.create(GameEngine.prototype), { player: actor, showRemoteSupportStateReadability: jest.fn() });
        try {
            engine.syncRemoteSupportEffects(actor, { [buff.wire]: buff.values[2] });
            expect(actor[buff.property]).toBe(1);
            expect(actor[buff.timer] || 0).toBe(0);
            const legacy = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ [buff.active]: true, [buff.duration]: 8 }).finish());
            engine.syncRemoteSupportEffects(actor, legacy);
            expect(actor[buff.property]).toBe(buff.base);
            for (const invalid of [0, -1, 100, Infinity, NaN]) {
                engine.syncRemoteSupportEffects(actor, { [buff.wire]: invalid });
                expect(actor[buff.property]).toBe(buff.base);
            }
        } finally { actor.dispose(); }
    });
});
