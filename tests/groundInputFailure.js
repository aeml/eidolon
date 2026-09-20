import { isHostilePointerInterception } from './primaryClickEvidence.js';

// Distinguish a planner with no clear input target from an issued movement
// command that failed. Only the former permits choosing another combat action.
export class GroundInputUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GroundInputUnavailableError';
    }
}

export class GroundPointerInterceptedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GroundPointerInterceptedError';
    }
}

export class GroundMovementFailedError extends Error {
    constructor(message, observation) {
        super(message);
        this.name = 'GroundMovementFailedError';
        this.observation = observation;
    }
}

export function movementFailure(message, attemptedPointerInput, attemptedKeyboardInput, pointerAttempts = [], observation) {
    if (attemptedPointerInput && !attemptedKeyboardInput && pointerAttempts.length > 0 &&
        pointerAttempts.every(attempt => isHostilePointerInterception(attempt.clickProbe))) {
        return new GroundPointerInterceptedError(message);
    }
    return !attemptedPointerInput && !attemptedKeyboardInput
        ? new GroundInputUnavailableError(message) : new GroundMovementFailedError(message, observation);
}
