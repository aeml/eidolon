import { applyOfflineFighterCone } from './offlineFighterCone.js';
import { getFighterEffectDuration } from './fighterEffectDuration.js';
import { getShieldSlamStunDuration } from './shieldSlamDuration.js';
import { getFighterAbilityDamage } from './fighterAbilityDamage.js';

export function applyOfflineShieldSlam(source, aim, engine, isFriendlyActor, counter = false) {
    if (source.isRemote || source.isMultiplayer || engine.isMultiplayer) return;
    const rune = source.skillRunes?.['Shield Slam'];
    let damage = getFighterAbilityDamage(source, 'Shield Slam', source.stats.damage + Math.floor(source.stats.strength * 1.5))
        * (rune === 'shieldslam_reverberation' ? 2 : 1);
    if (counter) damage = Math.floor(damage * 1.5);
    const duration = getShieldSlamStunDuration(source);
    const totalDamage = applyOfflineFighterCone(source, aim, engine, isFriendlyActor, 'Shield Slam', damage, duration);
    if (rune === 'shieldslam_fortify' && totalDamage > 0) {
        source.shieldHP = (source.shieldHP || 0) + totalDamage;
        source.arcaneShieldActive = true;
        source.arcaneShieldTimer = getFighterEffectDuration(source, 10);
    }
}
