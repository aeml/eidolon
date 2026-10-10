// QA-only predecessor method substitution on the same live owner, buffers,
// scene and poses. No renderer/content/eligibility policy changes between arms.
export async function compareActorFrameStorage(page, realFrames = false) {
    return page.evaluate(async realFrames => {
        const { ActorInstanceBatches: Reference } = await import('/tests/fixtures/actor-frame-storage/ActorInstanceBatches.reference.js');
        const render = window.__frameStorageRender || window.game.renderSystem, instances = render.actorInstances;
        if (!instances?.enabled || instances.viewFilter) throw Error('Comparison requires ordinary enabled actor batches');
        const candidate = instances.beginFrame, reference = Reference.prototype.beginFrame;
        const descriptor = Object.getOwnPropertyDescriptor(instances, 'beginFrame');
        const select = enabled => { instances.beginFrame = enabled ? candidate : reference; };
        const restored = () => !instances.hidden.length && !instances.group.visible &&
            !instances.eligibleParts.length && !instances.selectedParts.length && !instances.used.size;
        const draw = enabled => {
            select(enabled); render.render();
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                batches: instances.batches.size, restored: restored() };
        };
        const realNow = performance.now.bind(performance), frozenTime = realNow();
        const nowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = enabled => {
            const counts = draw(enabled); context.drawImage(canvas, 0, 0);
            return { ...counts, pixels: context.getImageData(0, 0, copy.width, copy.height).data };
        };
        let report;
        try {
            let before, after, repeat;
            try {
                Object.defineProperty(performance, 'now', { configurable: true, value: () => frozenTime });
                draw(false); draw(true); draw(false);
                before = capture(false); after = capture(true); repeat = capture(false);
            } finally {
                if (nowDescriptor) Object.defineProperty(performance, 'now', nowDescriptor);
                else delete performance.now;
            }
            let changedChannels = 0, unstableChannels = 0, maximumChannel = 0;
            for (let i = 0; i < before.pixels.length; i += 4) for (let c = 0; c < 3; c++) {
                const difference = Math.abs(before.pixels[i + c] - after.pixels[i + c]);
                changedChannels += difference !== 0 ? 1 : 0; maximumChannel = Math.max(maximumChannel, difference);
                unstableChannels += before.pixels[i + c] !== repeat.pixels[i + c] ? 1 : 0;
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
            const phases = [];
            if (realFrames) {
                const { observeGameplayScene } = await import('/tests/e2e/scene-performance.js');
                for (const enabled of [false, true, true, false]) {
                    select(enabled);
                    const profile = await observeGameplayScene(window.game, `actor-storage-${enabled ? 'candidate' : 'reference'}`);
                    phases.push({ enabled, profile, restored: restored() });
                }
            }
            report = { reference: strip(before), candidate: strip(after), referenceAgain: strip(repeat),
                image: { width: copy.width, height: copy.height, frozenRenderClock: true, changedChannels, unstableChannels, maximumChannel },
                cpu: { scope: 'Synchronous ABBA submission, unchanged world poses; real clock;2warm+12measured renders/block. Not a frame pacing certificate.', blocks },
                phases, quality: render.graphicsQuality, zoom: render.currentZoom };
        } finally {
            instances.endFrame();
            if (descriptor) Object.defineProperty(instances, 'beginFrame', descriptor);
            else delete instances.beginFrame;
        }
        if (instances.beginFrame !== candidate || !restored()) throw Error('Actor frame comparison failed to restore owner/storage');
        return report;
    }, realFrames);
}
