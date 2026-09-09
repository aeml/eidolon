import { recoverBetweenCollectionEncounters } from './earned-town-rest.js';

// Normal expedition loop. Call after observing credited quest progress and
// before choosing the next opponent/starting its unchanged encounter deadline.
export async function recoverBetweenHuntEncounters(page, { enabled, creditedKills, leaveTown }) {
    if (!enabled) return false;
    if (!Number.isInteger(creditedKills) || creditedKills < 0) throw new Error('Invalid earned hunt credit');
    if (typeof leaveTown !== 'function') throw new Error('Rested hunt requires ordinary town departure');
    if (creditedKills === 0) return false;
    return recoverBetweenCollectionEncounters(page, leaveTown);
}
