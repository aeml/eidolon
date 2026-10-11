// Observe the default frame-owned policy against its bypassed shadow arm.
export async function prepareActorShadowInfluencePilot(page) {
    return page.evaluate(async () => {
        const { ActorShadowInfluence } = await import('/src/art/ActorShadowInfluence.js');
        const render = window.game.renderSystem, instances = render.actorInstances;
        if (!instances?.enabled || window.__actorShadowInfluencePilot) throw Error('Actor shadow pilot requires one current instancing owner');
        const view = instances.shadowFilter;
        if (!(view instanceof ActorShadowInfluence) || view.disposed || !view.enabled) throw Error('Default shadow owner absent');
        const select = enabled => {
            if (render.actorInstances !== instances) throw Error('Actor instance generation changed during comparison');
            instances.shadowFilter = enabled ? view : null;
        };
        const restored = () => instances.hidden.length === 0 && !instances.group.visible && view.omitted.length === 0;
        const draw = enabled => {
            select(enabled); render.render();
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                restored: restored(), stats: enabled ? { ...view.stats } : null };
        };
        const dispose = () => {
            instances.shadowFilter = view; instances.endFrame();
        };
        window.__actorShadowInfluencePilot = { view, instances, dispose };
        try {
            // The scene's water and scenery transitions use performance.now in
            // render(). Freeze that clock only for this synchronous image trio;
            // no RAF, animation update or network message runs between images.
            // CPU timings and the ordinary 180-frame profile use the real clock.
            const realNow = performance.now.bind(performance), frozenTime = realNow();
            const nowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
            const canvas = render.renderer.domElement, copy = document.createElement('canvas');
            copy.width = canvas.width; copy.height = canvas.height;
            const context = copy.getContext('2d', { willReadFrequently: true });
            const capture = enabled => {
                const counts = draw(enabled); context.drawImage(canvas, 0, 0);
                return { ...counts, pixels: context.getImageData(0, 0, copy.width, copy.height).data };
            };
            let reference, candidate, referenceAgain;
            try {
                Object.defineProperty(performance, 'now', { configurable: true, value: () => frozenTime });
                draw(false); draw(true); draw(false);
                reference = capture(false); candidate = capture(true); referenceAgain = capture(false);
            } finally {
                if (nowDescriptor) Object.defineProperty(performance, 'now', nowDescriptor);
                else delete performance.now;
            }
            let changedChannels = 0, unstableChannels = 0, maximumChannel = 0;
            for (let i = 0; i < reference.pixels.length; i += 4) for (let c = 0; c < 3; c++) {
                const difference = Math.abs(reference.pixels[i + c] - candidate.pixels[i + c]);
                changedChannels += difference !== 0 ? 1 : 0; maximumChannel = Math.max(maximumChannel, difference);
                unstableChannels += reference.pixels[i + c] !== referenceAgain.pixels[i + c] ? 1 : 0;
            }
            const strip = ({ pixels: _pixels, ...counts }) => counts;
            const blocks = [];
            for (const enabled of [false, true, true, false, false, true, true, false]) {
                draw(enabled); draw(enabled);
                const milliseconds = [];
                for (let frame = 0; frame < 12; frame++) {
                    const start = realNow(); draw(enabled); milliseconds.push(realNow() - start);
                }
                blocks.push({ enabled, milliseconds, restored: restored() });
            }
            const summarize = enabled => {
                const times = blocks.filter(block => block.enabled === enabled).flatMap(block => block.milliseconds).sort((a, b) => a - b);
                return { frames: times.length, median: times[Math.floor(times.length / 2)], p95: times[Math.ceil(times.length * .95) - 1] };
            };
            return { reference: strip(reference), candidate: strip(candidate), referenceAgain: strip(referenceAgain),
                image: { width: copy.width, height: copy.height, frozenRenderClock: true, changedChannels, unstableChannels, maximumChannel },
                roots: view.roots.size, cpu: { scope: 'Synchronous frozen-world ABBA submission timing; real clock; 2 warm renders then 12 measured renders per block. Not whole-frame pacing.',
                    blocks, reference: summarize(false), candidate: summarize(true) }, quality: render.graphicsQuality, zoom: render.currentZoom };
        } catch (error) {
            dispose(); delete window.__actorShadowInfluencePilot; throw error;
        } finally {
            if (!view.disposed) select(true);
        }
    });
}
