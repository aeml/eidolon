import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { installDeathSpiralAreaObserver } from './e2e/death-spiral-area-observer.js';

afterEach(() => { delete window.game; delete window.__deathSpiralAreaNative; });
function setup() {
    const receive = jest.fn(() => 'forwarded');
    window.game = { player: { id: 'owner' }, effects: [], handleServerMessage: receive,
        renderSystem: { effectGroup: {} }, uiManager: { getGraphicsQuality: () => 'high' } };
    installDeathSpiralAreaObserver(); return receive;
}
test('fresh documents and reinstall retain single delivery and explicit failed receipts', () => {
    for (let login = 0; login < 2; login++) {
        const receive = setup(), wrapper = window.game.handleServerMessage;
        installDeathSpiralAreaObserver(); expect(window.game.handleServerMessage).toBe(wrapper);
        expect(wrapper({ type: 'ability_result', payload: { skillName: 'Death Spiral', accepted: false, mana: 0 } })).toBe('forwarded');
        expect(receive).toHaveBeenCalledTimes(1);
        expect(window.__deathSpiralAreaNative).toEqual({ casts: [], results: [{ accepted: false, mana: 0 }] });
    }
});
test('missing meshes and foreign casts cannot fabricate a visible accepted boundary', () => {
    setup(); const send = sourceId => window.game.handleServerMessage({ type: 'ability',
        payload: { sourceId, skillName: 'Death Spiral', radius: 4.6, arc: 2 * Math.PI } });
    send('other'); expect(window.__deathSpiralAreaNative.casts).toEqual([]);
    send('owner'); expect(window.__deathSpiralAreaNative.casts[0]).toMatchObject({ radius: 4.6, attached: false });
    expect(window.__deathSpiralAreaNative.casts[0].meshRadius).toBeUndefined();
});
test('mesh measurements are read after delivery, independently of the advertised radius', () => {
    setup();
    window.game.handleServerMessage = () => {
        window.game.effects.push({ isActive: true,
            abilityShape: { sourceId: 'owner', skillName: 'Death Spiral', authoritative: true },
            meshes: [{ parent: window.game.renderSystem.effectGroup, position: { x: 42, z: 9 },
                children: [{ userData: { normalizedGameplayRadius: 1 }, scale: { x: 4 } }] }] });
        return 'delivered';
    };
    installDeathSpiralAreaObserver();
    expect(window.game.handleServerMessage({ type: 'ability', payload: { sourceId: 'owner', skillName: 'Death Spiral',
        radius: 4.6, arc: 2 * Math.PI, targetX: 42, targetZ: 9 } })).toBe('delivered');
    expect(window.__deathSpiralAreaNative.casts[0]).toMatchObject({ attached: true, authoritative: true,
        radius: 4.6, meshRadius: 4, meshX: 42, meshZ: 9 });
});
test('full native gate and scoped route include the allowlisted non-retrying Rogue purchase check', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-death-spiral-area"');
    expect(script).toContain('EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-death-spiral-area" EIDOLON_E2E_CLASS=Rogue');
    expect(script).toContain('EIDOLON_E2E_DEATH_SPIRAL_AREA=1 npx playwright test --retries=0 tests/e2e/death-spiral-area-gameplay.spec.js');
    expect(script).toContain('  death-spiral-area)\n    run_death_spiral_area\n    ;;');
    const all = script.split('\n  all)')[1].split('\n    ;;')[0];
    expect(all.match(/run_qa_stage death-spiral-area run_death_spiral_area/g)).toHaveLength(1);
});
