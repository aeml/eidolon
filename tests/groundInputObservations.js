// Self-contained functions serialized into the browser. These observe ordinary
// input and state; they never move, cast, change hover or manufacture a receipt.
export function readPlayerStateInPage({ observeClicks = false } = {}) {
    const game = window.game;
    if (observeClicks) {
        window.__entranceClickProbe = { click: null, requested: 0, received: 0 };
        if (!window.__entranceClickProbeInstalled) {
            window.__entranceClickProbeInstalled = true;
            const describe = entity => entity ? {
                id: entity.id || null, hostile: game.isHostileActorTarget(entity),
                type: entity.name === 'DungeonEntrance' ? entity.name : entity.constructor?.name,
                state: entity.state, active: entity.isActive,
                position: entity.position ? { x: entity.position.x, z: entity.position.z } : null
            } : null;
            const click = game.handlePrimaryClick;
            game.handlePrimaryClick = function (event) {
                const before = describe(this.hoveredEntity);
                const result = click.call(this, event);
                window.__entranceClickProbe.click = {
                    before, after: describe(this.hoveredEntity), pending: describe(this.pendingInteraction),
                    player: { x: this.player.position.x, z: this.player.position.z },
                    state: this.player.state, dom: event?.target?.tagName, result, mobile: Boolean(this.isMobile),
                    stack: (this.raycastHitEntities || []).map(describe)
                };
                return result;
            };
            const request = game.requestDungeonStatus;
            game.requestDungeonStatus = function (...args) {
                window.__entranceClickProbe.requested++;
                return request.apply(this, args);
            };
            const message = game.handleServerMessage;
            game.handleServerMessage = function (value) {
                if (value.type === 'get_dungeon_status') window.__entranceClickProbe.received++;
                return message.call(this, value);
            };
        }
    }
    const player = game?.player;
    return player ? {
        id: player.id, name: player.name, type: player.constructor?.name,
        level: player.level, health: player.health ?? player.stats?.hp, state: player.state,
        inventoryCount: (player.inventory || []).filter(item => item?.id).length,
        x: player.position?.x, y: player.position?.y, z: player.position?.z,
        instanceId: game.currentInstanceId || '', instanceType: game.currentInstanceType || 'overworld'
    } : null;
}

export function readGroundPointerInPage({ x, y }) {
    const game = window.game;
    const hit = game.inputManager.getGroundIntersectionFromEvent({ clientX: x, clientY: y });
    // Reset evidence before input; never reset a game-owned interaction.
    if (window.__entranceClickProbe) window.__entranceClickProbe.click = null;
    return { isClearGround: !game.hoveredEntity,
        groundPoint: hit ? { x: hit.x, y: hit.y, z: hit.z } : null };
}

export function readGroundClickReceiptInPage() {
    const game = window.game, player = game.player;
    return {
        intent: { interactionId: game.pendingInteraction?.id || null,
            interactionType: game.pendingInteraction?.type || null,
            target: player.targetPosition ? { x: player.targetPosition.x, z: player.targetPosition.z } : null,
            blockedStops: player.movementMetrics?.blockedStops || 0 },
        clickProbe: window.__entranceClickProbe?.click
    };
}
