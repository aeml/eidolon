import { jest } from '@jest/globals';
import { eidolon } from '../src/proto/state_pb.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Fighter } from '../src/entities/Fighter.js';

const cases = [
    { id: 'blessing_resolve', active: 'blessingResolveActive', timer: 'blessingResolveTimer', duration: 'blessingResolveDuration', wire: 'blessingResolvePower', base: 1, values: [1, 1.04, 1.2], text: value => `+${Math.round(20 * value)}% defense` },
    { id: 'blessing_zeal', active: 'zealActive', timer: 'blessingZealTimer', duration: 'zealDuration', wire: 'zealPower', base: 1, values: [1, 1.04, 1.2], text: value => `+${Math.round(20 * value)}% movement, +${Math.round(30 * value)}% attack speed` },
    { id: 'mark_weakness', active: 'markWeakness', timer: 'markWeaknessTimer', duration: 'markWeaknessDuration', wire: 'markWeaknessFactor', base: .2, values: [.2, .208, .24, .5], text: value => `+${Math.round(100 * value)}% damage taken` }
];

describe.each(cases)('$id public potency', buff => {
    test.each(['syncPlayerSupportEffects', 'syncRemoteSupportEffects'])('%s applies real protobuf without modifying authoritative stats', method => {
        const actor = new Fighter('cleric-recipient');
        const engine = Object.assign(Object.create(GameEngine.prototype), { player: actor, showRemoteSupportStateReadability: jest.fn() });
        const stats = { ...actor.stats };
        try {
            actor.talentRanks = {};
            for (const value of buff.values) {
                for (const kind of ['full', 'delta']) {
                    const envelope = eidolon.state.StateEnvelope.decode(eidolon.state.StateEnvelope.encode({
                        [kind]: { entities: [{ id: actor.id, [buff.active]: true, [buff.duration]: 8, [buff.wire]: value }] }
                    }).finish());
                    engine[method](actor, envelope[kind].entities[0]);
                    expect(actor[buff.wire]).toBeCloseTo(value, 6);
                    expect(actor.stats).toEqual(stats);
                    expect(engine.getActiveBuffs().find(entry => entry.id === buff.id)?.detail).toBe(buff.text(value));
                    engine[method](actor, { [buff.duration]: 4 });
                    expect(actor[buff.wire]).toBeCloseTo(value, 6);
                }
            }
            engine[method](actor, { [buff.wire]: buff.base });
            expect(actor[buff.wire]).toBe(buff.base);
            engine[method](actor, { [buff.active]: false, [buff.duration]: 0, [buff.wire]: 0 });
            expect(actor[buff.wire]).toBe(0);
            expect(actor[buff.timer]).toBe(0);
            expect(engine.getActiveBuffs().some(entry => entry.id === buff.id)).toBe(false);
        } finally { actor.dispose(); }
    });

    test('legacy, malformed and scalar-only updates cannot grant unbounded effects', () => {
        const actor = new Fighter('cleric-legacy');
        const engine = Object.assign(Object.create(GameEngine.prototype), { player: actor, showRemoteSupportStateReadability: jest.fn() });
        try {
            engine.syncRemoteSupportEffects(actor, { [buff.wire]: buff.values[2] });
            expect(actor[buff.wire]).toBe(0);
            expect(actor[buff.timer]).toBe(0);
            const legacy = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ [buff.active]: true, [buff.duration]: 8 }).finish());
            engine.syncRemoteSupportEffects(actor, legacy);
            expect(actor[buff.wire]).toBe(buff.base);
            for (const value of [0, -1, 100, NaN, Infinity]) {
                engine.syncRemoteSupportEffects(actor, { [buff.wire]: value });
                expect(actor[buff.wire]).toBe(buff.base);
            }
        } finally { actor.dispose(); }
    });
});
