import { getFighterEffectDuration } from './fighterEffectDuration.js';

export function getShieldSlamStunDuration(source) {
    const base = source?.skillRunes?.['Shield Slam'] === 'shieldslam_concussion' ? 2.5 : 1.5;
    return getFighterEffectDuration(source, base);
}
