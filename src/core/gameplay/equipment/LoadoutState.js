// Only a server-confirmed swap or login restoration changes the current build.
export function applyLoadoutState(engine, result) {
    const player = engine.player;
    if (!player || !(result?.applied || result?.restored) || !Array.isArray(result.hotbar)) return false;
    if (result.build) {
        player.selectedBranch = result.build.branch || '';
        player.talentRanks = { ...result.build.talentRanks };
        player.skillRunes = { ...result.build.skillRunes };
        player.unlockedSkills = [...(result.unlockedSkills || [])];
        player.talentPoints = result.talentPoints;
        player.gold = result.gold;
    }
    player.customHotbar = true;
    player.hotbar = Array.from({ length: 4 }, (_, i) => result.hotbar[i] || null);
    player.hotbar.forEach((skill, index) => engine.uiManager?.assignSkillToSlot?.(index, skill));
    if (engine.abilityController?.inputBuffer) engine.abilityController.inputBuffer.length = 0;
    engine.uiManager?.skillTree?.handleBuildSnapshot?.();
    return true;
}
