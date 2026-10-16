import { profileGameplayScene } from './scene-performance.js';

export async function comparePartyRingFrames(page) {
    const select = async single => page.evaluate(async single => {
        const game = window.game;
        if (!window.__partyRingComparison) {
            const ids = new Set(game.uiManager.social.partyData.members.map(member => member.id));
            const rings = game.activeEntitiesCache.filter(actor => ids.has(actor.id))
                .map(actor => actor.mesh?.getObjectByName('PartyRing')).filter(Boolean);
            if (rings.length !== 3) throw new Error('Comparison requires exactly three real remote-party rings');
            window.__partyRingComparison = rings.map(ring => ({ ring, material: ring.material, single: ring.material.forceSinglePass }));
        }
        for (const entry of window.__partyRingComparison) {
            if (!entry.ring.parent || entry.ring.material !== entry.material || !entry.ring.visible)
                throw new Error('Comparison lost a live party ring');
            entry.material.forceSinglePass = single; entry.material.needsUpdate = true;
        }
        for (let i = 0; i < 60; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    }, single);
    const snapshot = () => page.evaluate(() => ({
        count: window.__partyRingComparison.length,
        versions: window.__partyRingComparison.map(entry => entry.material.version),
        single: window.__partyRingComparison.map(entry => entry.material.forceSinglePass)
    }));
    const phases = [];
    try {
        for (const single of [false, true, true, false]) {
            await select(single); const before = await snapshot();
            const profile = await profileGameplayScene(page, single ? 'single-pass-party-rings' : 'original-two-pass-party-rings');
            const after = await snapshot();
            phases.push({ single, before, after, versionDeltas: after.versions.map((version, index) => version - before.versions[index]), profile });
        }
    } finally {
        await page.evaluate(() => {
            for (const entry of window.__partyRingComparison || []) {
                entry.material.forceSinglePass = entry.single; entry.material.needsUpdate = true;
            }
            delete window.__partyRingComparison;
        });
    }
    return { phases, restored: await page.evaluate(() => !window.__partyRingComparison),
        scope: 'Original/candidate/candidate/original samples in one live four-class/three-peer scene. Exact three ring materials retained; ordinary simulation/population changes continue. Version counters bracket each sample, not exact private shader invocations. Separate from original failure; no whole-world/device acceptance.' };
}
