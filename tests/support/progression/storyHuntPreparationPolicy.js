// Only schedule a new town training visit between credited encounters, when a
// specialization/skill milestone has actually been earned. Never reset combat
// deadlines or grant the level needed for a skill.
export function storyHuntTrainingDue(preparedLevel, currentLevel) {
    if (![preparedLevel, currentLevel].every(level => Number.isInteger(level) && level >= 1)) {
        throw new Error('Story preparation requires positive integer earned levels');
    }
    return currentLevel >= 10 && Math.floor(currentLevel / 10) > Math.floor(preparedLevel / 10);
}
