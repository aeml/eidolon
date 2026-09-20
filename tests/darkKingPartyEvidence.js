// Read-only receipt of actual server events after normal client presentation.
// No phase, health, mana, quest or clock mutation. Imported by the isolated
// browser route as well as its focused behavior tests.
export function recordDarkKingPhase(evidence, game, phase) {
    if (!phase || phase.instanceId !== game.currentInstanceId || game.currentInstanceType !== 'weekly_raid') return;
    const phases = evidence.darkKingPhases ||= [];
    if (phases.length >= 8) { evidence.darkKingPhaseOverflow = true; return; }
    const ui = game.uiManager;
    phases.push({ phase: phase.phase, eidolon: phase.eidolon, element: phase.element,
        title: phase.title, effect: phase.effect, dialogue: phase.dialogue,
        alive: game.player.state !== 'DEAD' && game.player.stats.hp > 0,
        renderedTitle: ui?.combatIntentName?.textContent,
        renderedMeta: ui?.combatIntentMeta?.textContent,
        renderedEffect: ui?.combatIntentStatus?.textContent,
        visible: ui?.combatIntentPanel?.style.display === 'block' });
}

export function assertDarkKingPhases(evidence) {
    const phases = evidence?.darkKingPhases;
    const spirits = ['Orun', 'Neris', 'Pyralis', 'Aeral'];
    const elements = ['Earth', 'Water', 'Fire', 'Air'];
    if (evidence?.darkKingPhaseOverflow || phases?.length !== 4 || phases.some((p, i) =>
        p.phase !== i + 1 || p.eidolon !== spirits[i] || p.element !== elements[i] ||
        !p.alive || !p.visible || !p.title || !p.effect || !p.dialogue ||
        p.renderedTitle !== p.title || p.renderedMeta !== `Phase ${i + 1} of 4 · ${elements[i]}` ||
        !p.renderedEffect?.includes(p.effect))) {
        throw new Error('Dark King requires four ordered, living-player Eidolon events and rendered aid callouts');
    }
}
