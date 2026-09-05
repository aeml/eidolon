import { MAX_PLAYER_LEVEL } from '../data/dungeonProgression.js';

const amount = (value) => Math.max(0, Math.floor(Number(value) || 0));

export function formatQuestRewards(quest, player, { claimed = false } = {}) {
    const grantedXP = amount(quest?.grantedXP ?? quest?.grantedXp);
    const grantedResonanceXP = amount(quest?.grantedResonanceXP ?? quest?.grantedResonanceXp);
    const grantedGold = amount(quest?.grantedGold);
    const receipt = claimed && (grantedGold || grantedXP || grantedResonanceXP);
    if (claimed && !receipt && quest?.rewardLabelAtTurnIn) return quest.rewardLabelAtTurnIn;
    const capped = Number(player?.level) >= MAX_PLAYER_LEVEL;
    const rewardXP = amount(quest?.rewardXP ?? quest?.rewardXp);
    const gold = receipt ? grantedGold : amount(quest?.rewardGold);
    const xp = receipt ? grantedXP : capped ? 0 : rewardXP;
    const resonance = receipt ? grantedResonanceXP : capped ? rewardXP : 0;
    const parts = [];
    if (gold) parts.push(`${gold.toLocaleString()} gold`);
    if (xp) parts.push(`${xp.toLocaleString()} XP`);
    if (resonance) parts.push(`${resonance.toLocaleString()} Resonance XP`);
    return parts.join(' · ') || 'No reward';
}
