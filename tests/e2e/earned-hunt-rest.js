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

// Unlike between-kill preparation, this retreat is INSIDE the existing absolute
// encounter deadline. Recall, healing, and departure must all be real gameplay;
// it neither resets the watchdog nor requires a kill before resources can recover.
export async function recoverDuringHuntEncounter(page, { enabled, leaveTown }) {
    if (!enabled) return false;
    if (typeof leaveTown !== 'function') throw new Error('Rested hunt requires ordinary town departure');
    const before = await readEarnedRestResources(page);
    const reason = huntDisengageReason(before);
    if (!reason) return false;
    return restoreEarnedTownResources(page, leaveTown, before, reason, { preserveLevel: false });
}
