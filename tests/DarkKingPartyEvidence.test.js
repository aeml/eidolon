import { recordDarkKingPhase, assertDarkKingPhases } from './darkKingPartyEvidence.js';

function observedPhases() {
    const evidence = {};
    const game = { currentInstanceId: 'owned-raid', currentInstanceType: 'weekly_raid',
        player: { state: 'IDLE', stats: { hp: 500 } }, uiManager: {} };
    const phases = ['Orun', 'Neris', 'Pyralis', 'Aeral'].map((eidolon, i) => ({
        instanceId: 'owned-raid', phase: i + 1, eidolon, element: ['Earth', 'Water', 'Fire', 'Air'][i],
        title: `Phase ${i + 1}`, effect: `${eidolon} offers aid`, dialogue: `${eidolon} speaks`
    }));
    for (const p of phases) {
        game.uiManager = { combatIntentPanel: { style: { display: 'block' } }, combatIntentName: { textContent: p.title },
            combatIntentMeta: { textContent: `Phase ${p.phase} of 4 · ${p.element}` },
            combatIntentStatus: { textContent: `${p.eidolon} · ${p.effect}` } };
        recordDarkKingPhase(evidence, game, p);
    }
    return { evidence, game, phases };
}

test('requires all four actual events with the correct rendered callout and living observer', () => {
    const { evidence } = observedPhases();
    expect(() => assertDarkKingPhases(evidence)).not.toThrow();
});

test.each([
    e => { e.darkKingPhases.splice(1, 1); }, e => { e.darkKingPhases.reverse(); },
    e => { e.darkKingPhases[1].eidolon = 'Orun'; }, e => { e.darkKingPhases[1].alive = false; },
    e => { e.darkKingPhases[1].visible = false; }, e => { e.darkKingPhases[1].renderedTitle = 'stale boss warning'; },
    e => { e.darkKingPhases[1].renderedEffect = ''; }, e => { e.darkKingPhases[1].dialogue = ''; },
    e => { e.darkKingPhases.push(e.darkKingPhases[0]); }, e => { e.darkKingPhaseOverflow = true; }
])('does not confuse skipped, duplicate, dead-player or unpresented phases with completion', change => {
    const { evidence } = observedPhases(); change(evidence);
    expect(() => assertDarkKingPhases(evidence)).toThrow('four ordered');
});

test('ignores events from another instance and bounds broken-server receipts without hiding overflow', () => {
    const { evidence, game, phases } = observedPhases();
    recordDarkKingPhase(evidence, game, { ...phases[0], instanceId: 'other-raid' });
    expect(evidence.darkKingPhases).toHaveLength(4);
    for (let i = 0; i < 10; i++) recordDarkKingPhase(evidence, game, phases[0]);
    expect(evidence.darkKingPhases).toHaveLength(8);
    expect(evidence.darkKingPhaseOverflow).toBe(true);
});
