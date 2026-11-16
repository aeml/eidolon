import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Explicit generated-asset preview only. Normal URLs/catalog/version/runtime
// stay unchanged. Never publish these route substitutions as a qualified cache.
export async function installWearableAttributePilot(page) {
    const directory = process.env.EIDOLON_E2E_WEARABLE_ATTRIBUTE_PILOT;
    if (!directory) return null;
    if (!path.isAbsolute(directory)) throw new Error('Pilot directory must be absolute');
    const root = fs.realpathSync(directory), hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const runtime = JSON.parse(fs.readFileSync('assets/equipment/runtime/manifest.json'));
    const responses = new Map(), requested = new Set();
    for (const relative of fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('-pilot.json'))) {
        const receipt = JSON.parse(fs.readFileSync(path.join(root, relative)));
        const baseline = runtime.sources.find(row => row.item === receipt.name && row.actorClass === receipt.actorClass && row.tier === receipt.tier);
        if (!baseline || baseline.sourceHash !== receipt.sourceHash) throw new Error('Pilot source identity mismatch');
        for (const quality of ['high', 'low']) {
            const variant = receipt.variants[quality], file = fs.realpathSync(variant.file);
            if (!file.startsWith(root + path.sep) || variant.gltfErrors !== 0 || variant.gltfWarnings !== 0) throw new Error('Unqualified generated pilot');
            const body = fs.readFileSync(file);
            if (hash(body) !== variant.sha256) throw new Error('Pilot output hash mismatch');
            const url = '/' + baseline.variants[quality].file;
            if (responses.has(url)) throw new Error('Duplicate pilot runtime URL');
            responses.set(url, { body, sha256: variant.sha256, quality, name: receipt.name, actorClass: receipt.actorClass, tier: receipt.tier });
        }
    }
    if (!responses.size) throw new Error('No generated pilot pairs');
    await page.route('**/assets/equipment/runtime/**', async route => {
        const url = new URL(route.request().url()).pathname, response = responses.get(url);
        if (!response) { await route.continue(); return; }
        requested.add(url);
        await route.fulfill({ body: response.body, contentType: 'model/gltf-binary', headers: { 'cache-control': 'no-store' } });
    });
    return { read: () => ({ substitutedCandidates: responses.size, requested: [...requested].sort().map(url => {
        const { body: _body, ...entry } = responses.get(url); return { url, ...entry };
    }) }) };
}
