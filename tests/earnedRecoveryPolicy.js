import { CONSTANTS } from '../src/core/Constants.js';
import { getAbilityManaCost } from '../src/core/AbilityEconomy.js';

// Town recovery is the normal expedition loop. Opt out only for explicitly
// named diagnostic comparisons; malformed flags must not silently disable it.
export function earnedTownRecoveryEnabled(env = process.env) {
    const flag = env.EIDOLON_E2E_REST_RECOVERY;
    if (flag === undefined || flag === '1') return true;
    if (flag === '0') return false;
    throw new Error('EIDOLON_E2E_REST_RECOVERY must be 0 or 1');
}

// Read-only, shared by browser observations and unit checks. Use the same
// primary-skill/default fallback and cost modifiers as ordinary casting.
export function earnedRestResources(player) {
    const className = player.constructor.name;
    const config = CONSTANTS.ABILITY_CONFIG[className];
    if (!config) throw new Error(`Unsupported recovery class ${className}`);
    const baseCost = config.skills[player.abilityName]?.mana ?? config.default.mana;
    return { hp: player.stats.hp, maxHP: player.stats.maxHp, mana: player.stats.mana,
        maxMana: player.stats.maxMana, dead: player.state === 'DEAD', className,
        castCost: getAbilityManaCost(player, player.abilityName, baseCost),
        bank: player.wellRestedSeconds, zone: player.safeZoneId, level: player.level };
}
