import { raidVigilDestination } from '../raidVigilControls.js';
import { moveByGroundClick } from './helpers.js';
import { tryDungeonGroundStep } from '../dungeonNavigationInput.js';
import { PARTY_FOLLOW_INPUT_OPTIONS } from '../partyDungeonControls.js';

// Call from the actor's sole input worker, after telegraph avoidance. A true
// result reserves that worker for this ritual step (including holding position),
// so ordinary attack/follow inputs cannot interrupt a Fire channel.
export async function stepRaidVigilInput(page, actorIndex) {
    const state = await page.evaluate(() => {
        const game = window.game, player = game.player;
        return { crystal: game.currentDungeonRoomState?.crystal, dead: player.state === 'DEAD',
            x: player.position.x, z: player.position.z };
    });
    if (state.dead) return false;
    const target = raidVigilDestination(state.crystal, actorIndex);
    if (!target) return false;
    const dx = target.x - state.x, dz = target.z - state.z, distance = Math.hypot(dx, dz);
    if (distance > target.tolerance) {
        const scale = Math.min(1, 8 / distance);
        await tryDungeonGroundStep(() => moveByGroundClick(page, dx * scale, dz * scale, PARTY_FOLLOW_INPUT_OPTIONS));
    }
    return true;
}
