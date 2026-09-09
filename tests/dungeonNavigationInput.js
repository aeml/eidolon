import { GroundInputUnavailableError, GroundPointerInterceptedError } from './groundInputFailure.js';

// The caller owns its existing traversal/combat deadline and rereads the world
// on its next loop. A temporarily covered pointer is not a successful step;
// an actual ground movement request that failed must still stop the playtest.
export async function tryDungeonGroundStep(action) {
    try {
        await action();
        return true;
    } catch (error) {
        if (!(error instanceof GroundInputUnavailableError) && !(error instanceof GroundPointerInterceptedError)) throw error;
        console.log('[dungeon-navigation-blocked]', error.name);
        return false;
    }
}
