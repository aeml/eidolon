import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const credentialVariables = [
    'EIDOLON_E2E_USERNAME',
    'EIDOLON_E2E_PASSWORD',
    'EIDOLON_E2E_USERNAME_SECONDARY',
    'EIDOLON_E2E_PASSWORD_SECONDARY'
];
const credentialBuffers = [...new Set(
    credentialVariables.map((name) => process.env[name]).filter(Boolean)
)].map((value) => Buffer.from(value));
const roots = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['playwright-report', 'test-results'];

async function filesBelow(candidate) {
    let entries;
    try {
        entries = await readdir(candidate, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }

    const nested = await Promise.all(entries.map((entry) => {
        const entryPath = path.join(candidate, entry.name);
        return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
    }));
    return nested.flat();
}

function redact(buffer, credential) {
    let offset = buffer.indexOf(credential);
    let changed = false;
    while (offset !== -1) {
        buffer.fill(0x2a, offset, offset + credential.length);
        changed = true;
        offset = buffer.indexOf(credential, offset + credential.length);
    }
    return changed;
}

const files = (await Promise.all(roots.map(filesBelow))).flat();
let changedFiles = 0;
for (const file of files) {
    const contents = await readFile(file);
    let changed = false;
    for (const credential of credentialBuffers) {
        changed = redact(contents, credential) || changed;
    }
    if (changed) {
        await writeFile(file, contents);
        changedFiles += 1;
    }
}

for (const file of files) {
    const contents = await readFile(file);
    if (credentialBuffers.some((credential) => contents.includes(credential))) {
        throw new Error(`Credential redaction failed for ${file}`);
    }
}

console.log(`Playwright artifact credential scan passed; sanitized ${changedFiles} file(s).`);
