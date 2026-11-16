// Read-only observation of the normal pointer path. Never force a raycast,
// select an actor or change the runtime's enemy/interactable priority here.
export async function hasFreshEntranceHover(page, dungeonType) {
    return page.evaluate(type => window.game?.needsRaycast === false &&
        window.game.inputManager?.pointerOverCanvas === true &&
        window.game.hoveredEntity?.name === 'DungeonEntrance' &&
        window.game.hoveredEntity.userData?.dungeonType === type, dungeonType);
}
