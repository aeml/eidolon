import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { installBladeStormAreaObserver } from './e2e/blade-storm-area-observer.js';

afterEach(() => { delete window.game; delete window.__bladeStormArea; });
test('observer reads post-delivery cone geometry and owned terminal events exactly once', () => {
    const group = {}, effect = { isActive: true, abilityShape: { sourceId: 'owner', skillName: 'Blade Storm', authoritative: true },
        meshes: [{ parent: group, visible: true, position: { x: 10, z: 20 },
            children: [{ userData: { normalizedGameplayRadius: 1 }, visible: true, scale: { x: 11.5 } }] }] };
    const receive = jest.fn(message => {
        if (message.type === 'ability') window.game.effects.push(effect);
        return 'delivered';
    });
    window.game = { player: { id: 'owner' }, effects: [], renderSystem: { effectGroup: group },
        uiManager: { getGraphicsQuality: () => 'low' }, handleServerMessage: receive };
    installBladeStormAreaObserver();
    const wrapper = window.game.handleServerMessage;
    window.game.handleServerMessage = message => wrapper(message);
    installBladeStormAreaObserver();
    const send = window.game.handleServerMessage;
    const payload = { sourceId: 'owner', skillName: 'Blade Storm', radius: 11.5, arc: Math.PI / 2 };
    expect(send({ type: 'ability', payload })).toBe('delivered');
    expect(window.__bladeStormArea.casts).toEqual([{ ...payload, meshRadius: 11.5, meshX: 10, meshZ: 20,
        authoritative: true, attached: true, visible: true, quality: 'low' }]);
    send({ type: 'projectile_impact', payload: { ...payload, projectileId: 'foreign', terminal: true, sourceId: 'other' } });
    send({ type: 'projectile_impact', payload: { ...payload, projectileId: 'hit', terminal: false } });
    send({ type: 'projectile_impact', payload: { ...payload, projectileId: 'done', terminal: true } });
    expect(window.__bladeStormArea.terminals.map(p => p.projectileId)).toEqual(['done']);
    expect(receive).toHaveBeenCalledTimes(4);
});
test('optimistic ranks and absent geometry cannot supply successful observations', () => {
    window.game = { player: { id: 'owner', talentRanks: { ROG_34: 5 } }, effects: [],
        renderSystem: { effectGroup: {} }, uiManager: { getGraphicsQuality: () => 'high' }, handleServerMessage: () => true };
    installBladeStormAreaObserver();
    const send = window.game.handleServerMessage;
    expect(window.__bladeStormArea.ranks).toBeNull();
    send({ type: 'delta', payload: { u: { a: { id: 'owner', talentRanks: { ROG_34: 1 }, talentPoints: 19 } } } });
    expect(window.__bladeStormArea).toMatchObject({ ranks: { ROG_34: 1 }, points: 19 });
    send({ type: 'ability', payload: { sourceId: 'owner', skillName: 'Blade Storm', radius: 10.3 } });
    expect(window.__bladeStormArea.casts[0]).toMatchObject({ attached: false, visible: false });
    expect(window.__bladeStormArea.casts[0].meshRadius).toBeUndefined();
});
test('Blade Storm route is allowlisted, non-retrying and included once in full QA', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-blade-storm-area"');
    expect(script).toContain('EIDOLON_E2E_BLADE_STORM_AREA=1 npx playwright test --retries=0 tests/e2e/blade-storm-area-gameplay.spec.js');
    expect(script).toContain('  blade-storm-area)\n    run_blade_storm_area\n    ;;');
    const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
    expect(all.match(/run_qa_stage blade-storm-area run_blade_storm_area/g)).toHaveLength(1);
});
