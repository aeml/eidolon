// Serialized into the browser. Teleport intentionally suppresses local endpoint
// VFX until the server accepts/clips its landing; it uses the authoritative
// presentation path even for the owner. Never fall back to speculative VFX.
export function readAnimationPresentation(skillName) {
    const player = window.game?.player;
    return (skillName === 'Teleport'
        ? player?.lastRemoteAbilityPresentation
        : player?.lastAbilityPresentation) || null;
}
// Read-only diagnostics: record the guards at input time, not just eight
// seconds later when a transient stun or menu state may already have cleared.
export function readAnimationCastState(skillName) {
    const game = window.game;
    const player = game?.player;
    const ground = game?.inputManager?.getGroundIntersection?.();
    return {
        state: player?.state,
        stunTimer: player?.stunTimer,
        health: player?.stats?.hp,
        mana: player?.stats?.mana,
        abilityCooldown: player?.abilityCooldown,
        cooldown: player?.cooldowns?.[skillName],
        rune: player?.skillRunes?.[skillName],
        unlocked: player?.unlockedSkills?.includes(skillName),
        hotbar: player?.hotbar,
        ground: ground ? { x: ground.x, y: ground.y, z: ground.z } : null,
        hovered: game?.hoveredEntity ? {
            id: game.hoveredEntity.id, state: game.hoveredEntity.state,
            active: game.hoveredEntity.isActive
        } : null,
        jumping: Boolean(game?.playerJumpState),
        escapeMenu: game?.uiManager?.isEscMenuOpen,
        patchNotes: game?.uiManager?.isPatchNotesOpen,
        reportDisplay: game?.uiManager?.reportScreen?.style?.display,
        activeElement: document.activeElement?.id || document.activeElement?.tagName,
        presentation: player?.lastAbilityPresentation,
        authoritativePresentation: player?.lastRemoteAbilityPresentation,
        readinessSequence: game?.animationQAReadySequence
    };
}
