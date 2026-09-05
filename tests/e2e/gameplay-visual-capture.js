/** Opt-in world-only evidence. Never capture login, chat, or account name tags. */
export async function captureGameplayVisual(page, testInfo, label) {
    if (process.env.EIDOLON_E2E_CAPTURE_VISUALS !== '1') return;
    try {
        await page.evaluate(() => {
            const game = window.game;
            if (!game?.player?.mesh || game.isDestroyed) throw new Error('World capture requires an entered game');
            const hidden = [];
            window.__visualCaptureHiddenTags = hidden;
            game.renderSystem.scene.traverse((object) => {
                if (object.name === 'NameTag') {
                    hidden.push([object, object.visible]);
                    object.visible = false;
                }
            });
            game.renderSystem.render();
        });
        await page.screenshot({
            path: testInfo.outputPath(`world-${label}.png`),
            // Production canvas only; also hides diagnostic overlays and all
            // DOM transcripts. This style exists only during the screenshot.
            style: 'body > :not(canvas), body > :not(canvas) * { visibility: hidden !important; }',
            animations: 'allow'
        });
    } finally {
        await page.evaluate(() => {
            for (const [object, visible] of window.__visualCaptureHiddenTags || []) object.visible = visible;
            delete window.__visualCaptureHiddenTags;
        });
    }
}
