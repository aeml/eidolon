import { gameStartupFailureKind } from './GraphicsStartup.js';

// A failed module URL remains failed in the document's module map. The caller
// supplies one distinct, release-matched URL for a single download recovery.
// Share both success and failure so repeated clicks cannot create retry loops.
export function createEngineModuleLoader(load, recover) {
    let pending;
    return () => {
        pending ??= Promise.resolve().then(load).catch(error => {
            if (error?.name !== 'TypeError' || gameStartupFailureKind(error) !== 'module-download') throw error;
            return recover();
        });
        return pending;
    };
}
