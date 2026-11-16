import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { profileGameplayScene } from './scene-performance.js';

// Explicit disposable diagnosis only. Keep the established60warmup/180frame
// observer; never replace release-budget assertions with this comparison.
const referenceCommit = '8e5f888a66b65e6a69e26c62499b4113549b40c0';
const files = ['OpaqueSkinnedShadowBatches.js', 'OpaqueSkinnedColorBatches.js', 'OpaqueSkinnedShadowRuntime.js'];
export async function compareRenderValidationFrames(page, baseURL) {
    const sourcePins = [], modules = files.map(file => {
        const source = execFileSync('git', ['show', `${referenceCommit}:src/core/${file}`], { encoding: 'utf8' });
        sourcePins.push({ path: `src/core/${file}`, sha256: createHash('sha256').update(source).digest('hex') });
        const rewritten = source.replace(/from '([^']+)'/g, (_match, specifier) => {
            const target = specifier === 'three' ? new URL('/vendor/three/build/three.module.js', baseURL)
                : new URL(specifier, new URL('/src/core/' + file, baseURL));
            return `from '${target.href}'`;
        });
        return 'data:text/javascript;base64,' + Buffer.from(rewritten).toString('base64');
    });
    await page.waitForFunction(() => window.game?.renderSystem?.actorGameplayGeometry?.delivery.jobs.size === 0, null, { timeout: 30_000 });
    const initial = await page.evaluate(async modules => {
        const [shadow, color, runtime] = await Promise.all(modules.map(url => import(url)));
        const game = window.game, render = game.renderSystem;
        const bindings = [
            [render.actorShadowBatches.owner, 'valid', shadow.OpaqueSkinnedShadowBatches.prototype.valid],
            [render.actorColorBatches.owner, 'valid', color.OpaqueSkinnedColorBatches.prototype.valid],
            [render.actorShadowBatches, 'synchronize', runtime.OpaqueSkinnedShadowRuntime.prototype.synchronize]
        ].map(([owner, method, reference]) => ({ owner, method, reference, original: owner[method], descriptor: Object.getOwnPropertyDescriptor(owner, method) }));
        const state = window.__renderValidationFrameComparison = { game, render, bindings };
        state.read = () => ({ pendingGeometry: render.actorGameplayGeometry.delivery.jobs.size,
            colorEntries: render.actorColorBatches.owner.entries.size, shadowEntries: render.actorShadowBatches.owner.entries.size,
            frameRestored: !render.actorColorBatches.owner.context && render.actorShadowBatches.owner.depth === 0 });
        state.select = reference => {
            if (game.isDestroyed || game.renderSystem !== render) throw Error('Render validation diagnosis lost game ownership');
            for (const b of bindings) {
                if (b.owner.disposed || ![b.original, b.reference].includes(b.owner[b.method])) throw Error('Render validation diagnosis lost method ownership');
                b.owner[b.method] = reference ? b.reference : b.original;
            }
        };
        return state.read();
    }, modules);
    const phases = []; let restored;
    try {
        for (const reference of [true, false, false, true]) {
            await page.evaluate(reference => window.__renderValidationFrameComparison.select(reference), reference);
            const profile = await profileGameplayScene(page, `render-validation-${reference ? 'reference49' : 'candidate'}`);
            const after = await page.evaluate(() => window.__renderValidationFrameComparison.read());
            phases.push({ reference, profile, after });
        }
    } finally {
        restored = await page.evaluate(() => {
            const state = window.__renderValidationFrameComparison; let restored = Boolean(state);
            if (state) for (const b of state.bindings) {
                if (![b.original, b.reference].includes(b.owner[b.method])) { restored = false; continue; }
                if (b.descriptor) Object.defineProperty(b.owner, b.method, b.descriptor); else delete b.owner[b.method];
                restored &&= b.owner[b.method] === b.original;
            }
            delete window.__renderValidationFrameComparison; return restored;
        });
    }
    if (!restored) throw Error('Render validation diagnosis failed to restore owned methods');
    return { referenceCommit, sourcePins, initial, phases, restored,
        scope: 'One running disposable game: exact public49 validation methods/candidate/candidate/public49 ABBA. Each unchanged60warmup/180real frames. Existing live world/network/population evolution retained. All ownership, render, shader, gameplay and source geometry policies otherwise identical. No four-browser/battle/device/capacity/final-performance acceptance.' };
}
