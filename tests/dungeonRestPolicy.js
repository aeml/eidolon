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
