import { weeklyRaidRewardText } from './DungeonPreparation.js';

// Guidance uses the normal guide reply, never infers a claim from a boss kill
// or a local deadline, and has no authority to spend, grant or start a run.
export function endgameGoals(data = {}, player = {}) {
    if (!(Number(data.playerLevel) >= 100)) return [];
    const finished = data.darkKingDefeated === true;
    const story = finished
        ? 'The Fourfold Chronicle is complete. Return to Ilyra to reread A Letter Without a Throne, or help another group without resetting your story.'
        : data.darkRealmOpen === true
            ? 'Prepare a 5–10-player raid for Malachar’s four Eidolon phases. After victory, return to Ilyra and personally click Complete Quest; a boss kill alone is not your story claim.'
            : data.canEnterUmbralNexus === true
                ? 'Clear the Umbral Nexus with your party, then personally turn in The Fifth Note to Ilyra before preparing Malachar’s raid.'
                : data.crystalsRestored === true
                    ? 'Cross the Fourfold Resonance Portal, follow Ilyra’s Dark Realm expedition and claim The Door Beneath the Crown to unlock the Umbral Nexus.'
                    : 'Finish your elemental chapters and each raid’s crystal-repair Vigil. Personally claim all four repairs with Ilyra before crossing the portal at level 100.';
    const points = player?.resonancePoints;
    const resonanceStatus = Number.isSafeInteger(points) && points >= 0
        ? `${points.toLocaleString('en-US')} unspent Resonance point${points === 1 ? '' : 's'}. ` : '';
    return [
        { id: 'chronicle', title: finished ? 'A world beyond the Chronicle' : 'Finish the Fourfold Chronicle',
            status: finished ? 'Story claimed' : 'Story still in progress', text: story,
            action: 'raids', label: 'View raids & preparation' },
        { id: 'repeat-runs', title: 'Choose your next dungeon push', status: 'Repeatable',
            text: 'Start with a difficulty your group enjoys. Normal retains its standard rewards; Heroic bosses guarantee one bonus gem, and Mythic bosses one bonus gem and one unique-effect item. Boss drops and run rewards are separate from optional daily quests. Reset only after everyone leaves; Continue preserves a live run and its cleared boss checkpoints.',
            action: 'dungeons', label: 'Choose a dungeon & difficulty' },
        { id: 'weekly-cache', title: 'Malachar’s personal cache', status: data.weeklyRaidReward?.status === 'claimed'
            ? 'Claimed this week' : data.weeklyRaidReward?.status === 'available' ? 'Available this week' : 'Eligibility unavailable',
            text: weeklyRaidRewardText(data.weeklyRaidReward), action: 'raids', label: 'Prepare or help a raid' },
        { id: 'resonance', title: 'Grow your Resonance', status: 'Permanent progression',
            text: resonanceStatus + 'At level 100, enemy, quest and dungeon XP becomes Resonance XP. Each Resonance level grants one trait point for Power, Ward or Fortune. Daily quests are optional; EP cannot buy points. Review current progress and spend points in Character.',
            action: 'character', label: 'Open Character' },
        { id: 'forge', title: 'Build a long-term loadout', status: 'Choose your own pace',
            text: 'Keep useful class stats, gems, set bonuses and unique effects rather than chasing potency alone. Use the Forge in town to compare the next upgrade and its exact cost. +20 potency is a long-term endgame goal, not a campaign requirement. Save loadouts for different roles; no EP purchase grants combat power.' },
        { id: 'collections', title: 'Collect looks and revisit the realms', status: 'Optional discoveries',
            text: 'Learn looks from owned gear in Character → Wardrobe without consuming the items. Earned season medallions and EP-shop appearances remain cosmetic only. Revisit lore discoveries or use the atlas to find the next elemental world event; there is no extra event completion purse or daily obligation.',
            action: 'map', label: 'Open world atlas' }
    ];
}

export function appendEndgameGoals(parent, data, player, actions = {}) {
    const goals = endgameGoals(data, player);
    if (!goals.length) return null;
    const intro = document.createElement('p');
    intro.className = 'endgame-goals-intro';
    intro.textContent = 'Your next adventure is a choice, not a daily checklist. This guide shows your current server-reported story and weekly cache status; reopen it to refresh eligibility. Your real entry and reward claims are still checked by the server.';
    parent.append(intro);
    for (const goal of goals) {
        const section = document.createElement('section');
        section.className = 'endgame-goal'; section.dataset.endgameGoal = goal.id;
        const heading = document.createElement('h3'); heading.textContent = goal.title;
        const status = document.createElement('p'); status.className = 'endgame-goal-status'; status.textContent = goal.status;
        const text = document.createElement('p'); text.textContent = goal.text;
        section.append(heading, status, text);
        if (goal.action) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'menu-btn'; button.textContent = goal.label;
            button.disabled = typeof actions[goal.action] !== 'function';
            button.onclick = () => actions[goal.action]?.();
            section.append(button);
        }
        parent.append(section);
    }
    return parent;
}
