import { recoverBetweenCollectionEncounters, readEarnedRestResources, restoreEarnedTownResources } from './earned-town-rest.js';
import { huntDisengageReason } from '../collectionRestPolicy.js';

// Normal expedition loop. Call after observing credited quest progress and
// before choosing the next opponent/starting its unchanged encounter deadline.
export async function recoverBetweenHuntEncounters(page, { enabled, creditedKills, leaveTown }) {
    if (!enabled) return false;
    if (!Number.isInteger(creditedKills) || creditedKills < 0) throw new Error('Invalid earned hunt credit');
    if (typeof leaveTown !== 'function') throw new Error('Rested hunt requires ordinary town departure');
    if (creditedKills === 0) return false;
    return recoverBetweenCollectionEncounters(page, leaveTown);
}

// Recall, healing and regional departure are real gameplay, but not combat.
// Report only their actual elapsed time so the caller can preserve its remaining
// combat budget. The enclosing expedition deadline still includes all travel.
export async function recoverDuringHuntEncounter(page, { enabled, leaveTown, onRecovered = () => {} }) {
    if (!enabled) return false;
    if (typeof leaveTown !== 'function') throw new Error('Rested hunt requires ordinary town departure');
    const before = await readEarnedRestResources(page);
    const reason = huntDisengageReason(before);
    if (!reason) return false;
    const started = Date.now();
    const recovered = await restoreEarnedTownResources(page, leaveTown, before, reason, { preserveLevel: false });
    if (recovered) onRecovered(Math.max(0, Date.now() - started));
    return recovered;
}
