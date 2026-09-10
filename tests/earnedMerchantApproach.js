// Progress from a click is not arrival. Never calculate a new world offset
// against an actor/camera still following the previous movement request.
export async function approachEarnedMerchant({ settle, read, move, now = Date.now }) {
    const deadline = now() + 45_000;
    for (let step = 0; step <= 8 && now() < deadline; step++) {
        await settle(deadline);
        const state = await read();
        if (now() >= deadline) break;
        const coordinates = [...(state.position || []), ...(state.camera || []), ...(state.merchant || [])];
        if (coordinates.length !== 9 || !coordinates.every(Number.isFinite)) {
            throw new Error('Merchant approach requires finite player, camera and replicated merchant positions');
        }
        if (state.state !== 'IDLE' || state.target ||
            Math.hypot(state.camera[0] - state.position[0], state.camera[2] - state.position[2]) >= .05) {
            throw new Error('Merchant waypoint must be read after movement and camera settle');
        }
        const x = state.merchant[0] - state.position[0], z = state.merchant[2] - state.position[2];
        const distance = Math.hypot(x, z);
        if (distance < 4.5) return state;
        if (step === 8) break;
        const scale = Math.min(12, distance - 3) / distance;
        await move(x * scale, z * scale);
    }
    throw new Error('Merchant approach did not arrive within eight moves and 45 seconds');
}
