// Diagnostic CPU submission windows for the exact constructor alternatives.
// A/B/B/A is intentionally bounded; it is not a soak or whole-game FPS proof.
export async function measureElementalRenderCost({ THREE, system, groups, models, offset }) {
    const original = groups.map(group => ({ parent: group.parent, visible: group.visible }));
    const mixers = models.map(({ root, index }) => {
        root.userData.resetPose(); root.visible = true;
        root.position.set((index % 2 ? 1 : -1) * 3, 0, index < 2 ? -3 : 3).add(offset);
        const mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(THREE.AnimationClip.findByName(root.userData.animations, 'Walk')).play();
        return mixer;
    });
    const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
    const windows = []; let restored = false;
    try {
        for (const variant of [0, 1, 1, 0]) {
            groups.forEach(group => group.removeFromParent());
            groups[variant].visible = true; system.entityGroup.add(groups[variant]);
            // Compilation and group switching stay outside the timed samples.
            for (let i = 0; i < 8; i++) { mixers.forEach(mixer => mixer.update(1 / 60)); system.render(); }
            const samples = []; let previous = null;
            for (let i = 0; i < 32; i++) await new Promise((resolve, reject) => requestAnimationFrame(timestamp => {
                try {
                    mixers.forEach(mixer => mixer.update(1 / 60));
                    const start = performance.now(); system.render(); const cpuMs = performance.now() - start;
                    samples.push({ cpuMs, intervalMs: previous === null ? null : timestamp - previous,
                        calls: system.renderer.info.render.calls, triangles: system.renderer.info.render.triangles,
                        visibility: document.visibilityState });
                    previous = timestamp; resolve();
                } catch (error) { reject(error); }
            }));
            const cpu = samples.map(s => s.cpuMs), intervals = samples.map(s => s.intervalMs).filter(v => v !== null);
            windows.push({ variant, samples, cpuMedianMs: percentile(cpu, .5), cpuP95Ms: percentile(cpu, .95),
                frameMedianMs: percentile(intervals, .5), frameP95Ms: percentile(intervals, .95),
                callsMedian: percentile(samples.map(s => s.calls), .5), trianglesMedian: percentile(samples.map(s => s.triangles), .5) });
        }
    } finally {
        groups.forEach(group => group.removeFromParent());
        groups.forEach((group, i) => { group.visible = original[i].visible; original[i].parent?.add(group); });
        mixers.forEach((mixer, i) => { mixer.stopAllAction(); mixer.uncacheRoot(models[i].root); });
        restored = groups.every((group, i) => group.parent === original[i].parent && group.visible === original[i].visible);
    }
    return { windows, restored, scope: '128 normal RAF renders, A/B/B/A, 32 per window; four walking actors, unselected group detached outside samples. CPU measures the actual RenderSystem.render call. Mixer work is outside CPU timing and equal in both variants. No whole-game, GPU-duration, device or FPS acceptance claim.' };
}
