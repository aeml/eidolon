import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { moveByGroundClick } from './helpers.js';
import { prepareGameplayGeometryLifecycle } from './gameplay-geometry-lifecycle.js';
import { prepareGameplayGeometryDelivery } from './gameplay-geometry-delivery.js';
import { profileGameplayScene } from './scene-performance.js';

export async function captureGameplayGeometryParty(page, testInfo) {
    const automatic = process.env.EIDOLON_E2E_GAMEPLAY_GEOMETRY_DELIVERY === '1';
    let absentReference = null;
    if (automatic && process.env.EIDOLON_E2E_GAMEPLAY_GEOMETRY_RUNTIME_OWNER === '1') {
        expect(await page.evaluate(() => window.game.renderSystem.actorGameplayGeometry === null)).toBe(true);
        absentReference = await profileGameplayScene(page, 'equipped-party-before-geometry-owner-allocation');
        await writeFile(testInfo.outputPath('geometry-owner-absent-reference.json'), JSON.stringify({
            controllerAllocated: false, deliveryAllocated: false, ownedCandidatesAllocated: false, profile: absentReference,
            scope: 'Independent real-frame window before installing this owner. Other selected scene policies retained; world/network continue normally. Compare population and time-window differences; no paired causal installation/memory gain.'
        }, null, 2));
    }
    const preparation = automatic ? await prepareGameplayGeometryDelivery(page) : await prepareGameplayGeometryLifecycle(page, 'game');
    expect(preparation.body.sources).toBe(4);
    const paired = await page.evaluate(async automatic => {
        const THREE = await import('three');
        const { geometryStorageBytes } = await import('/tests/e2e/geometry-frame-comparison.js');
        const render = window.game.renderSystem, state = window.__gameplayGeometryLifecycle, pass = state.pass;
        const legacy = new Map(), originalRender = pass.original;
        let useLegacy = false;
        if (state.legacyIndices) {
            for (const entry of pass.entries.values()) {
                const captured = state.legacyIndices.get(entry.mesh);
                if (!captured || captured.source !== entry.source) throw Error('Missing exact legacy subset');
                const geometry = entry.source.clone(); geometry.setIndex(new THREE.BufferAttribute(captured.indices.slice(), 1));
                legacy.set(entry, geometry);
            }
            pass.original = function (...args) {
                const selected = [];
                if (useLegacy) for (const entry of pass.active) {
                    const geometry = legacy.get(entry);
                    if (!geometry) throw Error('Uncaptured legacy draw');
                    entry.mesh.geometry = geometry; selected.push(entry);
                }
                try { return originalRender.apply(this, args); }
                finally { for (const entry of selected) if (entry.mesh.geometry === legacy.get(entry)) entry.mesh.geometry = entry.candidate; }
            };
        }
        const compactProof = legacy.size ? { legacyStorageBytes: geometryStorageBytes(legacy.values()),
            candidateStorageBytes: geometryStorageBytes([...pass.entries.values()].map(entry => entry.candidate)),
            ordinaryShadows: render.renderer.shadowMap.enabled, captured: legacy.size } : null;
        const originalZoom = render.currentZoom, now = performance.now.bind(performance);
        const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const restored = () => !pass.active.length && [...pass.entries.values()].every(entry => entry.mesh.geometry === entry.source);
        const draw = (enabled, oldSubset = false) => {
            useLegacy = oldSubset;
            pass.enabled = enabled; render.render();
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                swaps: pass.lastSwaps, restored: restored() };
        };
        const capture = (enabled, oldSubset = false) => {
            const counts = draw(enabled, oldSubset); context.drawImage(canvas, 0, 0);
            return { ...counts, pixels: context.getImageData(0, 0, copy.width, copy.height).data };
        };
        const samples = [], transitions = [], blocks = [];
        try {
            const frozen = now();
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            for (const zoom of [5, originalZoom]) {
                render.setZoom(zoom); draw(false); draw(true); draw(false);
                const source = capture(false), candidate = capture(true), oldSubset = legacy.size ? capture(true, true) : null, again = capture(false);
                let changedChannels = 0, unstableChannels = 0, compactChangedChannels = 0;
                for (let i = 0; i < source.pixels.length; i++) {
                    changedChannels += source.pixels[i] !== candidate.pixels[i] ? 1 : 0;
                    unstableChannels += source.pixels[i] !== again.pixels[i] ? 1 : 0;
                    if (oldSubset) compactChangedChannels += oldSubset.pixels[i] !== candidate.pixels[i] ? 1 : 0;
                }
                const strip = ({ pixels: _pixels, ...row }) => row;
                samples.push({ zoom, changedChannels, unstableChannels, compactChangedChannels,
                    source: strip(source), candidate: strip(candidate), again: strip(again) });
            }
            render.setZoom(5); draw(true);
            for (const pixels of [45, 41, 45, 48, 45, 30]) {
                render.setZoom(canvas.height / (2 * pixels)); draw(true);
                transitions.push({ pixels, reduced: pass.reduced, restored: restored(), swaps: pass.lastSwaps });
            }
        } finally {
            pass.original = originalRender;
            for (const geometry of legacy.values()) geometry.dispose();
            state.legacyIndices?.clear(); delete state.legacyIndices;
            if (descriptor) Object.defineProperty(performance, 'now', descriptor);
            else delete performance.now;
            render.setZoom(originalZoom); pass.enabled = true;
        }
        for (const selected of [false, true, true, false, false, true, true, false]) {
            // Bypass only this controller for the source submission arm. The
            // original renderer wrapper stack still runs; no lifecycle scan.
            const owner = render.renderer.render;
            try {
                if (automatic && !selected) render.renderer.render = pass.original;
                draw(selected); draw(selected); const milliseconds = [];
                for (let i = 0; i < 12; i++) { const start = now(); draw(selected); milliseconds.push(now() - start); }
                blocks.push({ selected, controllerBypassed: automatic && !selected, milliseconds, restored: restored() });
            } finally { render.renderer.render = owner; }
        }
        pass.enabled = true;
        const summarize = selected => {
            const times = blocks.filter(row => row.selected === selected).flatMap(row => row.milliseconds).sort((a, b) => a - b);
            return { frames: times.length, median: times[Math.floor(times.length / 2)], p95: times[Math.ceil(times.length * .95) - 1] };
        };
        return { samples, transitions, compactProof, actorViewFilterAllocated: Boolean(render.actorInstances?.viewFilter), cpu: { scope: automatic
            ? 'Same-scene source arm bypasses controller wrapper/validation; combined arm includes it. Real clock,48 samples per path. Delivery idle; allocated candidates/cache remain. Submission only, not frame pacing or installation/memory baseline.'
            : 'Same-scene source/combined body+gear ABBA submission; both include lifecycle validation. Real clock,48samples per path; not whole-frame pacing.',
            reference: summarize(false), candidate: summarize(true), blocks } };
    }, automatic);
    expect(paired.samples[0].changedChannels).toBe(0);
    expect(paired.samples[0].candidate.swaps).toBe(0);
    expect(paired.samples[1].candidate.triangles).toBeLessThan(paired.samples[1].source.triangles);
    for (const row of paired.samples) {
        expect(row.unstableChannels).toBe(0); expect(row.candidate.calls).toBe(row.source.calls);
        expect(row.source.restored && row.candidate.restored && row.again.restored).toBe(true);
    }
    if (process.env.EIDOLON_E2E_COMPACT_GEOMETRY_COMPARE === '1') {
        expect(paired.compactProof.ordinaryShadows).toBe(true);
        expect(paired.compactProof.captured).toBeGreaterThan(0);
        expect(paired.compactProof.candidateStorageBytes).toBeLessThan(paired.compactProof.legacyStorageBytes);
        for (const row of paired.samples) expect(row.compactChangedChannels).toBe(0);
    }
    expect(paired.transitions.map(row => row.reduced)).toEqual([false, true, true, false, false, true]);
    for (const row of [...paired.transitions, ...paired.cpu.blocks]) expect(row.restored).toBe(true);
    const folder = testInfo.outputPath('post-login-geometry-motion'); await mkdir(folder, { mode: 0o700 });
    const session = await page.context().newCDPSession(page), frames = [], writes = [];
    session.on('Page.screencastFrame', event => {
        if (frames.length < 240) {
            const name = `frame-${String(frames.length).padStart(4, '0')}.jpg`;
            frames.push({ name, timestamp: event.metadata.timestamp });
            writes.push(writeFile(`${folder}/${name}`, Buffer.from(event.data, 'base64'), { mode: 0o600 }));
        }
        session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    });
    await page.evaluate(() => {
        const samples = []; let request;
        const frame = () => {
            const game = window.game, pass = window.__gameplayGeometryLifecycle.pass;
            samples.push({ state: game.player.state, x: game.player.position.x, z: game.player.position.z,
                animation: game.player.currentAnimationName, actionTime: game.player.currentAction?.time,
                gear: game.player.mesh.userData.equipmentVisualItemCount, swaps: pass.lastSwaps,
                restored: !pass.active.length && [...pass.entries.values()].every(entry => entry.mesh.geometry === entry.source) });
            if (samples.length < 180) request = requestAnimationFrame(frame);
        };
        request = requestAnimationFrame(frame);
        window.__geometryMotion = { samples, stop: () => cancelAnimationFrame(request) };
    });
    let motion;
    try {
        await session.send('Page.startScreencast', { format: 'jpeg', quality: 75, maxWidth: 1280, maxHeight: 844, everyNthFrame: 3 });
        for (const [dx, dz] of [[-6, 0], [6, 0], [0, -6]]) {
            await moveByGroundClick(page, dx, dz, { moveOnly: true, allowAlternatePaths: true, allowJumpFallback: false, minimumDistance: 2 });
            await expect.poll(() => page.evaluate(() => window.game.player.state), { timeout: 7000 }).toBe('IDLE');
        }
        await page.screenshot({ path: testInfo.outputPath('combined-geometry-moving-hud.png') });
    } finally {
        await session.send('Page.stopScreencast'); await session.detach(); await Promise.all(writes);
        motion = await page.evaluate(() => { const observation = window.__geometryMotion; observation.stop(); delete window.__geometryMotion; return observation.samples; });
        await writeFile(testInfo.outputPath('gameplay-geometry-party.json'), JSON.stringify({ absentReference, preparation, paired, frames, motion,
            scope: 'Prepared four-class actual party, combined whole-render body/gear indices; optional actor view allocation is recorded in paired metadata. Normal ground clicks and HUD clip precede the independent180-frame sample. No separate shadow simplification, earned campaign, physical-device or final art acceptance.' }, null, 2));
    }
    expect(motion.some(row => row.state === 'MOVING' && row.animation === 'Run' && row.swaps > 0)).toBe(true);
    expect(new Set(motion.filter(row => row.state === 'MOVING').map(row => row.actionTime)).size).toBeGreaterThan(2);
    expect(motion.every(row => row.gear === 14 && row.restored)).toBe(true);
    expect(frames.length).toBeGreaterThan(5);
    console.log('[gameplay-geometry-party]', JSON.stringify({ installed: preparation.installed, samples: paired.samples,
        cpu: { reference: paired.cpu.reference, candidate: paired.cpu.candidate }, movementSamples: motion.length, frames: frames.length }));
}
