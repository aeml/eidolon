// Read-only source-boundary check; does not open Blender or regenerate assets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const delivery = JSON.parse(read('art/source/equipment-production/delivery-files.json'));
for (const file of delivery.files) {
    assert(!file.startsWith('output/'), `Disposable delivery path: ${file}`);
    assert(fs.statSync(path.join(root, file)).isFile(), `Missing delivery file: ${file}`);
}
const manifest = JSON.parse(read('assets/equipment/authored/manifest.json'));
const locators = [
    ...Object.values(manifest.characters).map(character => character.blenderSource),
    ...Object.values(manifest.sources),
    manifest.coverage.referenceImplementation,
    ...Object.values(manifest.verification).filter(value => typeof value === 'string'),
];
for (const locator of locators) {
    assert(!locator.startsWith('output/'), `Old authoring locator: ${locator}`);
    if (!locator.startsWith('art/source/')) continue;
    for (const character of ['fighter', 'wizard', 'cleric', 'rogue']) {
        const file = locator.replace('{class}', character).split(':')[0];
        assert(fs.existsSync(path.join(root, file)), `Missing authoring locator: ${file}`);
    }
}
assert(read('.gitattributes').split('\n').includes('art/source/**/*.blend filter=lfs diff=lfs merge=lfs -text'),
    'Editable Blender sources must retain Git LFS coverage');
console.log(`Verified ${delivery.files.length} delivery files, authoring locators and Blender LFS rule.`);
