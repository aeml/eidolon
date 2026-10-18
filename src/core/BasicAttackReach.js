import { CONSTANTS } from './Constants.js';

const scaleOf = actor => Math.max(.01, Number(actor?.scale) || 1);
const bodyRadius = actor => Number(actor?.authoritativeBodyRadius || actor?.radius || actor?.bodyRadius) || 1.25 * scaleOf(actor);

export function getHeroBasicAttackReach(className, attacker, target) {
    if (className === 'Wizard' || className === 'Rogue') {
        return CONSTANTS.BASIC_ATTACK_RANGES[className] + Math.max(0, scaleOf(attacker) - 1) * 1.5 + Math.max(0, scaleOf(target) - 1) * 1.5;
    }
    return bodyRadius(attacker) + bodyRadius(target) + .5;
}
