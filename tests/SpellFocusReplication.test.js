import { jest } from '@jest/globals';
import { eidolon } from '../src/proto/state_pb.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Wizard } from '../src/entities/Wizard.js';

test.each([2.5, 2.6, 3])('stored Focus multiplier %s reaches both support paths without private ranks', multiplier => {
    const packet = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ id: 'focus-owner',
        spellFocusActive: true, spellFocusDuration: 12, spellFocusMultiplier: multiplier }).finish());
    expect(packet.spellFocusMultiplier).toBeCloseTo(multiplier, 6);
    for (const method of ['syncPlayerSupportEffects', 'syncRemoteSupportEffects']) {
        const actor = new Wizard('focus-owner');
        const engine = Object.assign(Object.create(GameEngine.prototype), { player: actor, showRemoteSupportStateReadability: jest.fn() });
        try {
            actor.talentRanks = {};
            engine[method](actor, packet);
            expect(actor.spellFocusMultiplier).toBeCloseTo(multiplier, 6);
            expect(engine.getActiveBuffs().find(buff => buff.id === 'spell_focus').detail)
                .toBe(`+${Math.round((multiplier - 1) * 100)}% next spell damage`);
            engine[method](actor, { spellFocusDuration: 6 });
            expect(actor.spellFocusMultiplier).toBeCloseTo(multiplier, 6);
            engine[method](actor, { spellFocusMultiplier: 3 });
            expect(actor.spellFocusMultiplier).toBe(3);
            engine[method](actor, { spellFocusActive: false, spellFocusDuration: 0, spellFocusMultiplier: 0 });
            expect(actor.spellFocusMultiplier).toBe(1);
            expect(actor.spellFocusTimer).toBe(0);
            expect(engine.getActiveBuffs().some(buff => buff.id === 'spell_focus')).toBe(false);
        } finally { actor.dispose(); }
    }
});

test('legacy active packet uses original strength, while scalar-only packets cannot grant a charge', () => {
    const actor = new Wizard('legacy-focus');
    const engine = Object.assign(Object.create(GameEngine.prototype), { showRemoteSupportStateReadability: jest.fn() });
    try {
        engine.syncRemoteSupportEffects(actor, { spellFocusMultiplier: 3 });
        expect(actor.spellFocusActive).toBe(false);
        expect(actor.spellFocusMultiplier).toBe(1);
        const packet = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ spellFocusActive: true, spellFocusDuration: 8 }).finish());
        engine.syncRemoteSupportEffects(actor, packet);
        expect(actor.spellFocusMultiplier).toBe(2.5);
    } finally { actor.dispose(); }
});
