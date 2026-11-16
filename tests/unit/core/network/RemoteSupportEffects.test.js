import { jest } from '@jest/globals';
import { syncRemoteSupportEffects } from '../../../../src/core/network/RemoteSupportEffects.js';

describe('remote support replication boundary', () => {
    let engine, actor;
    beforeEach(() => {
        engine = { showRemoteSupportStateReadability: jest.fn() };
        actor = { syncAttachedStatusEffects: jest.fn() };
    });

    test('unrelated packets preserve support state but refresh attached presentation', () => {
        Object.assign(actor, { spellFocusActive: true, spellFocusTimer: 4, shieldHP: 20 });
        syncRemoteSupportEffects(engine, actor, { hp: 10 });
        expect(actor.spellFocusTimer).toBe(4);
        expect(actor.shieldHP).toBe(20);
        expect(engine.showRemoteSupportStateReadability).not.toHaveBeenCalled();
        expect(actor.syncAttachedStatusEffects).toHaveBeenCalledWith(0);
    });

    test('partial updates preserve active state and emit only actual transitions', () => {
        syncRemoteSupportEffects(engine, actor, { arcaneShieldActive: true, arcaneShieldHp: 20 });
        syncRemoteSupportEffects(engine, actor, { arcaneShieldDuration: 3 });
        syncRemoteSupportEffects(engine, actor, { arcaneShieldHp: 0 });
        expect(actor.arcaneShieldTimer).toBe(3);
        expect(engine.showRemoteSupportStateReadability.mock.calls).toEqual([
            [actor, 'arcane_shield', true], [actor, 'arcane_shield', false],
        ]);
    });

    test('explicit server clear emits a down edge even after local timer expiry', () => {
        Object.assign(actor, { guardianRoarActive: true, guardianRoarTimer: 0, guardianRoarReduction: .2 });
        syncRemoteSupportEffects(engine, actor, { guardianRoarActive: false });
        expect(actor.guardianRoarReduction).toBe(0);
        expect(engine.showRemoteSupportStateReadability).toHaveBeenCalledWith(actor, 'guardian_roar', false);
    });

    test('spirit partial metadata does not reactivate a cleared effect', () => {
        actor.clearSpiritMeshes = jest.fn();
        actor.createSpirits = jest.fn();
        syncRemoteSupportEffects(engine, actor, { spiritsActive: true, spiritRadius: 6 });
        syncRemoteSupportEffects(engine, actor, { spiritsActive: false });
        syncRemoteSupportEffects(engine, actor, { spiritRadius: 9 });
        expect(actor.spiritsActive).toBe(false);
        expect(actor.spiritRadius).toBe(0);
        expect(actor.createSpirits).toHaveBeenCalledTimes(1);
    });

    test('well-rested and whirlwind are applied before attached status refresh', () => {
        actor.whirlwindCastEffect = { authoritativeSeen: true, dispose: jest.fn() };
        actor.syncAttachedStatusEffects.mockImplementation(() => {
            expect(actor.wellRestedSeconds).toBe(50);
            expect(actor.safeZoneId).toBe('town');
            expect(actor.whirlwindActive).toBe(false);
        });
        syncRemoteSupportEffects(engine, actor, {
            wellRestedSeconds: 50, safeZoneId: 'town', whirlwindActive: false,
        });
        expect(actor.whirlwindCastEffect.dispose).toHaveBeenCalledTimes(1);
        expect(actor.syncAttachedStatusEffects).toHaveBeenCalledTimes(1);
    });
});
