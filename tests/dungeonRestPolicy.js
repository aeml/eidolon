import { collectionRestReason } from './collectionRestPolicy.js';

// Expedition QA policy, not a gameplay refill or stat adjustment. Check only at
// a fully cleared room boundary, never between individual kills in a live pack.
// A boss can require much more than the overworld's two-cast minimum, so prepare
// both pools before continuing when either falls below80%.
export function dungeonRestReason(resources, { cleared, nearbyHostiles }) {
    const ordinaryReason = collectionRestReason(resources);
    if (resources.dead || !cleared || nearbyHostiles) return null;
    if (ordinaryReason) return ordinaryReason;
    if (resources.mana < resources.maxMana * .8) return 'mana';
    return null;
}

// Four-role parties have a healer. Prove the ordinary town round trip early,
// then avoid repeatedly retracing every cleared room for a lightly spent pool.
// This changes only the QA party's decisions, not recovery rates or difficulty.
export function partyDungeonRestNeeded(states, { cleared, nearbyHostiles, townRests }) {
    if (!Number.isInteger(townRests) || townRests < 0 || states.length !== 4) throw new Error('Invalid party recovery observation');
    for (const state of states) {
        if (state.dead) throw new Error('A party rest cannot hide a death');
        collectionRestReason({ ...state, castCost: 0 }); // Validate actual observed pools.
    }
    if (!cleared || nearbyHostiles) return false;
    const fraction = townRests === 0 ? .8 : .5;
    return states.some(state => state.hp < state.maxHP * fraction || state.mana < state.maxMana * fraction);
}
