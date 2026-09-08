// Distinguish a planner with no clear input target from an issued movement
// command that failed. Only the former permits choosing another combat action.
export class GroundInputUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GroundInputUnavailableError';
    }
}

export function movementFailure(message, attemptedPointerInput, attemptedKeyboardInput) {
    return !attemptedPointerInput && !attemptedKeyboardInput
        ? new GroundInputUnavailableError(message) : new Error(message);
}
