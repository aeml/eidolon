// Explicit QA selection of an otherwise unselected frame-owned policy.
export async function prepareActorInstanceViewPilot(page) {
    return page.evaluate(async ({ compareMembership }) => {
        const { ActorInstanceView } = await import('/src/art/ActorInstanceView.js');
        const render = window.game.renderSystem, instances = render.actorInstances;
        if (!instances?.enabled || window.__actorInstanceViewPilot) throw Error('Actor view pilot requires one current instancing owner');
        const previous = instances.viewFilter, view = new ActorInstanceView();
        if (previous) throw Error('Actor view pilot requires the ordinary null policy');
        const select = enabled => {
            if (render.actorInstances !== instances) throw Error('Actor instance generation changed during comparison');
            instances.viewFilter = enabled ? view : previous;
        };
        const restored = () => instances.hidden.length === 0 && !instances.group.visible;
        const draw = enabled => {
            select(enabled); render.render();
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                restored: restored(), stats: enabled ? { ...view.stats } : null };
        };
        const dispose = () => {
            if (instances.viewFilter === view) instances.viewFilter = previous;
            instances.endFrame(); view.dispose();
        };
        window.__actorInstanceViewPilot = { view, instances, dispose };
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
            for (const enabled of [false, true, true, false]) {
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
            let lightMembershipComparison = null;
            if (compareMembership) {
                const { ActorInstanceView: ReferenceView } = await import('/src/art/ActorInstanceView.reference.js');
                const referenceView = new ReferenceView();
                const drawMembership = indexed => {
                    instances.viewFilter = indexed ? view : referenceView; render.render();
                    return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                        restored: restored(), stats: { ...(indexed ? view : referenceView).stats } };
                };
                const captureMembership = indexed => {
                    const counts = drawMembership(indexed); context.drawImage(canvas, 0, 0);
                    return { ...counts, pixels: context.getImageData(0, 0, copy.width, copy.height).data };
                };
                try {
                    let old, indexed, again;
                    try {
                        Object.defineProperty(performance, 'now', { configurable: true, value: () => frozenTime });
                        drawMembership(false); drawMembership(true); drawMembership(false);
                        old = captureMembership(false); indexed = captureMembership(true); again = captureMembership(false);
                    } finally {
                        if (nowDescriptor) Object.defineProperty(performance, 'now', nowDescriptor);
                        else delete performance.now;
                    }
                    let changed = 0, unstable = 0;
                    for (let i = 0; i < old.pixels.length; i++) {
                        changed += old.pixels[i] !== indexed.pixels[i] ? 1 : 0;
                        unstable += old.pixels[i] !== again.pixels[i] ? 1 : 0;
                    }
                    if (changed || unstable || old.calls !== indexed.calls || old.triangles !== indexed.triangles ||
                        old.calls !== again.calls || old.triangles !== again.triangles) throw Error('Light membership comparison differs');
                    const measured = [];
                    for (const enabled of [false, true, true, false]) {
                        drawMembership(enabled); drawMembership(enabled);
                        const milliseconds = [];
                        for (let frame = 0; frame < 12; frame++) {
                            const start = realNow(); drawMembership(enabled); milliseconds.push(realNow() - start);
                        }
                        measured.push({ enabled, milliseconds, restored: restored() });
                    }
                    const summarizeMembership = enabled => {
                        const values = measured.filter(block => block.enabled === enabled).flatMap(block => block.milliseconds).sort((a, b) => a - b);
                        return { frames: values.length, median: values[Math.floor(values.length / 2)], p95: values[Math.ceil(values.length * .95) - 1] };
                    };
                    lightMembershipComparison = { scope: 'Same scene: previous full light scan versus indexed light membership; synchronous ABBA submission only, not whole-frame pacing.',
                        reference: strip(old), candidate: strip(indexed), referenceAgain: strip(again), changedChannels: changed,
                        unstableChannels: unstable, blocks: measured, cpu: { reference: summarizeMembership(false), candidate: summarizeMembership(true) } };
                } finally { referenceView.dispose(); select(true); }
            }
            return { reference: strip(reference), candidate: strip(candidate), referenceAgain: strip(referenceAgain),
                image: { width: copy.width, height: copy.height, frozenRenderClock: true, changedChannels, unstableChannels, maximumChannel },
                cpu: { scope: 'Synchronous frozen-world ABBA submission timing; real clock; 2 warm renders then 12 measured renders per block. Not whole-frame pacing.',
                    blocks, reference: summarize(false), candidate: summarize(true) }, lightMembershipComparison,
                quality: render.graphicsQuality, zoom: render.currentZoom };
        } catch (error) {
            dispose(); delete window.__actorInstanceViewPilot; throw error;
        } finally {
            if (!view.disposed) select(true);
        }
    }, { compareMembership: process.env.EIDOLON_E2E_LIGHT_MEMBERSHIP_COMPARE === '1' });
}
