export const CRYSTAL_VIGIL_PREPARATION = Object.freeze({
    Earth: 'Rootward: one defender holds the central circle for 8 seconds while allies keep enemies outside the outer ring.',
    Water: 'Memory runners: touch the eastern font, then return to Maelin. Deliver two memories per wave; death drops carried memories.',
    Fire: 'Vent team: stand in the bright vents in order for 2 uninterrupted seconds each. Keep the channeler protected.',
    Air: 'Wind relay: touch four bright anchors in order. A different raider must take each next anchor; two runners can alternate.'
});

export function appendDungeonPreparation(parent) {
    const details = document.createElement('details');
    details.className = 'adventure-preparation';
    const summary = document.createElement('summary');
    summary.textContent = 'Prepare your party · recover and retry';
    details.append(summary);
    for (const text of [
        'Plan a tank, a healer and damage dealers. Start with level-appropriate Uncommon/Rare gear: Strong Fighter, Agile Rogue, Brilliant Wizard, Wise Cleric. These are recommendations, not class-entry restrictions.',
        'Fill HP and mana in Lanternhold before leaving. Safe zones restore 10% per second and bank Well Rested. Check your equipped weapon, skill bar and healing target; use the Forge or a saved loadout in town.',
        'For raids, form a 5–10-player raid and complete a ready check in the Party panel. Every member needs the realm dungeon chapter and minimum level. Pick ritual runners before pulling the guardian.',
        'After a death, respawn in town, recover, then Continue the same run at the Guide. Continuing moves only you and keeps cleared rooms. The empty instance expires after 5 minutes; return before its timer ends.',
        'If everyone leaves the crystal chamber or dies, only the current wave’s ritual work restarts. Previously cleared waves remain while the instance lives. A server restart may require all three repair waves again.',
        'Reset is a fresh run, not a revive: everyone must leave first and only the leader can reset. It discards instance progress, not claimed quests, inventory or the weekly reward limit.'
    ]) {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        details.append(paragraph);
    }
    parent.append(details);
}

export function weeklyRaidRewardText(reward) {
    const status = reward?.status;
    const lead = status === 'claimed'
        ? 'Weekly cache already claimed. You may still enter and help other players; another clear will not grant a second weekly cache.'
        : status === 'available'
            ? 'Your weekly cache is available on an eligible Dark King clear. Each character can claim it once per week.'
            : 'Weekly cache status unavailable. Do not assume another cache is available; entry and helping the group remain separate from reward eligibility.';
    const reset = new Date(reward?.resetsAt);
    const resetText = Number.isFinite(reset.getTime()) ? ` Next reset: ${reset.toISOString().replace('T', ' ').slice(0, 16)} UTC.` : ' Resets Monday at 00:00 UTC.';
    return lead + resetText + ' Resetting the instance does not reset this reward limit.';
}
