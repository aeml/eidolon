export const FINALE_PREPARATION = Object.freeze([
    'All roles: MEMORY FRACTURE marks a circle. Leave it before impact, even while an Eidolon is helping. Keep the tank supported and leave space to move; the covenant does not make anyone invulnerable.',
    'Earth · Orun reduces the King’s damage by 20%. Establish control and conserve resources. Water · Neris restores 25% maximum health to living raiders when her phase begins. Healers still sustain the group; this aid does not resurrect fallen allies.',
    'Fire · Pyralis strikes for 8% of the King’s maximum health and increases your damage to him by 25%. Use offensive cooldowns when it is safe to attack. Air · Aeral restores mana and raises the damage bonus to 35% for the final assault; spend those resources without ignoring ground warnings.',
    'Victory is not an automatic quest claim. Return to Archmage Ilyra and personally click Complete Quest for your ready finale. The reward conversation leads to A Letter Without a Throne; reopen Ilyra to read it later. The weekly personal cache is separate, and its availability is shown above.'
]);

export function appendFinaleBriefing(parent) {
    const details = document.createElement('details');
    details.className = 'adventure-preparation';
    details.dataset.finalePreparation = '';
    const summary = document.createElement('summary');
    summary.textContent = 'Four Eidolons, your role and the epilogue';
    details.append(summary);
    for (const text of FINALE_PREPARATION) {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        details.append(paragraph);
    }
    parent.append(details);
    return details;
}

// Only a server-reported, personally ready quest gets a claim prompt. Clearing
// the room alone must never imply a grant, a ready quest or another cache.
export function getFinaleExitGuidance(instanceType, quests) {
    if (instanceType !== 'weekly_raid' || !Array.isArray(quests)) return null;
    const ready = quests.some(q => q?.id === 'chronicle_15_dark_king' && q.accepted && !q.completed &&
        q.maxCount > 0 && q.count >= q.maxCount);
    if (!ready) return null;
    return {
        title: 'Return to Ilyra in town',
        hint: 'Malachar has fallen — return to Ilyra and click Complete Quest for your ready finale. Each character claims personally; the weekly cache is separate.',
        sequenceHint: 'Press B or use Return to Lanternhold in the Escape menu. After your claim, read A Letter Without a Throne with Ilyra; you can return to her to read it again.'
    };
}
