import { CRYSTAL_VIGIL_PREPARATION } from './DungeonPreparation.js';

// Mirrors the guardian labels/patterns in dungeon_telegraphs.go. No client
// combat authority: the live marked footprints always determine where to move.
export const ELEMENTAL_GUARDIAN_BRIEFINGS = Object.freeze({
    Earth: { boss: 'Graven Colossus', label: 'SANCTUM FRACTURE',
        hint: 'Step sideways out of the fissure line.' },
    Water: { boss: 'Tidebound Tyrant', label: 'CONFLUENCE SURGE',
        hint: 'Surge locked on its target’s position—move out of the marked pool.' },
    Fire: { boss: 'Ashen Imperator', label: 'CROWN ERUPTION',
        hint: 'Move between the eruption pockets; keep a clear escape lane.' },
    Air: { boss: 'Tempest Sovereign', label: 'EYRIE STORMBREAK',
        hint: 'The storm closes around the edge. Move into its safe center or beyond the marked ring.' }
});

export function appendElementalRaidBriefing(parent, element) {
    if (!Object.hasOwn(ELEMENTAL_GUARDIAN_BRIEFINGS, element)) return null;
    const guardian = ELEMENTAL_GUARDIAN_BRIEFINGS[element];
    const details = document.createElement('details');
    details.className = 'adventure-preparation';
    const summary = document.createElement('summary');
    summary.textContent = 'Guardian, Vigil and personal rewards';
    details.append(summary);
    for (const text of [
        `${guardian.boss} · ${guardian.label}: ${guardian.hint} Follow the live ground warnings. Clear the whole assault; defeating the guardian opens the repair, not a restored crystal.`,
        `Maelin channels automatically in the crystal chamber; she is not a quest giver. ${CRYSTAL_VIGIL_PREPARATION[element]} Complete the ritual task AND defeat every attacker in each of the three waves.`,
        'After the crystal is restored, return to Lanternhold. Check your Chronicle, then speak to Ilyra and click Complete Quest for your ready repair quest. Each character claims personally; raid loot is separate from these quest rewards.'
    ]) {
        const paragraph = document.createElement('p'); paragraph.textContent = text; details.append(paragraph);
    }
    parent.append(details);
    return details;
}
