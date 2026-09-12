import { GroundInputUnavailableError } from '../groundInputFailure.js';

// No command was issued when geometry changed under the planner. Let the
// caller reobserve the moving target inside its existing deadline; never count
// this as movement, retry a cast or swallow a failed issued input.
export async function tryUtilityApproachStep(action) {
    try {
        await action();
        return true;
    } catch (error) {
        if (!(error instanceof GroundInputUnavailableError)) throw error;
        console.log('[rogue-utility-replan]', error.name);
        return false;
    }
}
