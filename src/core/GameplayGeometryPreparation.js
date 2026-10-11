import { gameplayBodyIndices } from '../art/GameplayBodyIndices.js';
import { gameplayColorIndices } from '../art/GameplayColorIndices.js';
import { gameplayRigidIndices } from '../art/GameplayRigidIndices.js';

// Shared by the runtime fallback and the offline artifact generator.
export function prepareGameplayGeometry(kind, source) {
    if (kind === 'body') return gameplayBodyIndices(source);
    if (kind === 'rigid') return gameplayRigidIndices(source, { error: source.quality === 'low' ? .012 : .006 });
    if (kind === 'color') return gameplayColorIndices(source, { repairSeams: true });
    throw new Error('Unsupported geometry kind');
}
