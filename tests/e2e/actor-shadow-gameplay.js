import { expect } from '@playwright/test';
import { profileGameplayScene } from './scene-performance.js';

export async function compareActorShadowGameplay(page) {
    const phases = [];
    let paired;
    try {
        paired = await page.evaluate(() => {
        const render = window.game.renderSystem;
        if (render.actorShadowView !== null) throw Error('Shadow comparison requires the default inactive owner');
        render.setActorShadowViewEnabled(true);
        const owner = render.actorShadowView, shadowMap = render.renderer.shadowMap;
        window.__actorShadowComparison = { owner, render, shadowMap };
        const restored = () => owner.active.length === 0 && render.actorInstances.hidden.length === 0 && !render.actorInstances.group.visible;
        const draw = enabled => {
            shadowMap.render = enabled ? owner.wrapper : owner.original;
            render.render();
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                restored: restored(), stats: enabled ? { ...owner.stats } : null };
        };
        const realNow = performance.now.bind(performance), frozen = realNow();
        const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = enabled => {
            const counts = draw(enabled); context.drawImage(canvas, 0, 0);
            return { counts, pixels: context.getImageData(0, 0, copy.width, copy.height).data };
        };
        let source, candidate, again;
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            draw(false); draw(true); draw(false);
            source = capture(false); candidate = capture(true); again = capture(false);
        } finally {
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
        }
        let changedChannels = 0, unstableChannels = 0;
        for (let index = 0; index < source.pixels.length; index += 4) for (let channel = 0; channel < 3; channel++) {
            changedChannels += source.pixels[index + channel] !== candidate.pixels[index + channel] ? 1 : 0;
            unstableChannels += source.pixels[index + channel] !== again.pixels[index + channel] ? 1 : 0;
        }
        const blocks = [];
        for (const enabled of [false, true, true, false]) {
            draw(enabled); draw(enabled);
            const milliseconds = [];
            for (let frame = 0; frame < 12; frame++) { const start = realNow(); draw(enabled); milliseconds.push(realNow() - start); }
            blocks.push({ enabled, milliseconds, restored: restored() });
        }
        shadowMap.render = owner.original;
        return { source: source.counts, candidate: candidate.counts, again: again.counts,
            image: { width: copy.width, height: copy.height, changedChannels, unstableChannels }, blocks };
    });
        expect(paired.image.changedChannels).toBe(0); expect(paired.image.unstableChannels).toBe(0);
        expect(paired.candidate.calls).toBeLessThanOrEqual(paired.source.calls);
        expect(paired.candidate.triangles).toBeLessThanOrEqual(paired.source.triangles);
        expect(paired.again.calls).toBe(paired.source.calls);
        expect(paired.candidate.stats.checked).toBeGreaterThan(0);
        for (const row of [paired.source, paired.candidate, paired.again, ...paired.blocks]) expect(row.restored).toBe(true);
        for (const enabled of [false, true, true, false]) {
            await page.evaluate(enabled => {
                const { owner, render, shadowMap } = window.__actorShadowComparison;
                if (render.actorShadowView !== owner || owner.disposed) throw Error('Shadow owner changed during ABBA');
                shadowMap.render = enabled ? owner.wrapper : owner.original;
            }, enabled);
            const profile = await profileGameplayScene(page, `actor-shadow-${enabled ? 'candidate' : 'source'}`);
            phases.push({ enabled, profile });
        }
    } finally {
        await page.evaluate(() => {
            const state = window.__actorShadowComparison;
            if (!state) return;
            state.render.setActorShadowViewEnabled(false);
            delete window.__actorShadowComparison;
            if (state.shadowMap.render !== state.owner.original || state.render.actorShadowView !== null) throw Error('Shadow comparison did not restore the default renderer');
        });
    }
    return { paired, phases, scope: 'One connected actual equipped four-class renderer. Exact frozen-clock RGB;48 synchronous submission draws; ABBA4x60warmup+180real frames with normal world/network evolution. No geometry/instance row changes or removed content. Default owner restored. Not physical-device, four-renderer or art acceptance.' };
}
