import { planRangedHuntStep } from '../wizardHuntControls.js';

// The deployed site serves game modules, not /tests. Keep strategy in Node and
// send only detached candidate vectors to the browser's real collision manager.
export async function planReachableWizardStep(page, state) {
    const options = [];
    const initial = planRangedHuntStep({ ...state, canRetreat: delta => {
        options.push(delta);
        return true;
    } });
    if (initial?.action !== 'retreat') return initial;
    const clear = await page.evaluate(({ options, radius }) => {
        const game = window.game;
        return options.map(delta => {
            const position = game.player.position;
            const steps = Math.ceil(Math.hypot(delta.x, delta.z) / .25);
            let previous = position.clone();
            for (let step = 1; step <= steps; step++) {
                const point = position.clone();
                point.x += delta.x * step / steps;
                point.z += delta.z * step / steps;
                const corrected = game.collisionManager.checkCollision(point, radius, previous);
                if (corrected && corrected.distanceTo(point) > .00001) return false;
                previous = point;
            }
            return true;
        });
    }, { options, radius: state.radius || 1.25 });
    return planRangedHuntStep({ ...state, canRetreat: delta => options.some((option, index) =>
        clear[index] && option.x === delta.x && option.z === delta.z) });
}
