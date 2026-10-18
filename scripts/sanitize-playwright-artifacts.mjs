import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import utilsBundle from 'playwright-core/lib/utilsBundle';

const credentialVariables = [
    'EIDOLON_E2E_USERNAME',
    'EIDOLON_E2E_PASSWORD',
    'EIDOLON_E2E_USERNAME_SECONDARY',
    'EIDOLON_E2E_PASSWORD_SECONDARY'
];
const credentialBuffers = [...new Set(
    credentialVariables.map((name) => process.env[name]).filter(Boolean)
)].flatMap((value) => {
    // HTML report JSON can escape quotes/backslashes, including nested JSON
    // strings in an error. Raw-buffer matching alone misses those spellings.
    const variants = [value];
    for (let depth = 0; depth < 3; depth += 1) {
        variants.push(JSON.stringify(variants[variants.length - 1]).slice(1, -1));
    }
    return [...new Set(variants)].map((variant) => Buffer.from(variant));
});
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

function redactText(buffer) {
    let changed = false;
    for (const credential of credentialBuffers) changed = redact(buffer, credential) || changed;
    return changed;
}

// JSON reporter bodies are base64, unlike the HTML reporter's text bodies.
// Decode only that known report shape; keep binary images outside text claims.
function sanitizeJSONReporter(buffer, nesting = 0, budget = { bytes: 0, bodies: 0, nodes: 0 }) {
    budget.bytes += buffer.length;
    if (nesting > 8 || budget.bytes > 64 * 1024 * 1024) throw new Error('JSON report exceeds the evidence bound');
    let report;
    try { report = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
    catch { throw new Error('Invalid JSON report data'); }
    if (!report || !Array.isArray(report.suites) || !report.config || !report.stats)
        return { buffer, changed: redactText(buffer) };
    let changed = false;
    const encodedBodies = new WeakSet();
    const text = value => {
        const bytes = Buffer.from(value);
        if (!redactText(bytes)) return value;
        changed = true; return bytes.toString('utf8');
    };
    function visit(value, depth = 0) {
        if (++budget.nodes > 1_000_000 || depth > 128) throw new Error('JSON report structure exceeds the evidence bound');
        if (typeof value === 'string') return text(value);
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value.attachments)) for (const attachment of value.attachments) {
            if (!attachment || attachment.body === undefined || attachment.body === null) continue;
            if (++budget.bodies > 4096 || typeof attachment.body !== 'string' || typeof attachment.contentType !== 'string')
                throw new Error('Invalid inline report attachment');
            const mime = attachment.contentType.split(';')[0].trim().toLowerCase();
            encodedBodies.add(attachment);
            if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) continue;
            const json = /^application\/(?:[a-z0-9.+-]+\+)?json$/.test(mime);
            if (!json && !mime.startsWith('text/')) throw new Error('Unsupported inline report attachment');
            const encoded = attachment.body;
            if (encoded.length > Math.ceil(16 * 1024 * 1024 / 3) * 4 ||
                encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
                throw new Error('Invalid or oversized inline report encoding');
            const decoded = Buffer.from(encoded, 'base64');
            if (decoded.toString('base64') !== encoded || decoded.length > 16 * 1024 * 1024)
                throw new Error('Invalid or oversized inline report encoding');
            try { new TextDecoder('utf-8', { fatal: true }).decode(decoded); }
            catch { throw new Error('Invalid inline report text'); }
            let result;
            if (json) {
                result = sanitizeJSONReporter(decoded, nesting + 1, budget);
                try { JSON.parse(result.buffer.toString('utf8')); }
                catch { throw new Error('Invalid sanitized inline JSON'); }
            } else {
                budget.bytes += decoded.length;
                if (budget.bytes > 64 * 1024 * 1024) throw new Error('JSON report exceeds the evidence bound');
                result = { buffer: decoded, changed: redactText(decoded) };
            }
            if (result.changed) { attachment.body = result.buffer.toString('base64'); changed = true; }
        }
        for (const [key, member] of Object.entries(value)) {
            const sanitized = key === 'body' && encodedBodies.has(value) ? member : visit(member, depth + 1);
            const name = Array.isArray(value) ? key : text(key);
            if (name !== key && Object.hasOwn(value, name)) throw new Error('Redacted JSON report key collision');
            if (name !== key) delete value[key];
            Object.defineProperty(value, name, { value: sanitized, enumerable: true, writable: true, configurable: true });
        }
        return value;
    }
    visit(report);
    return { buffer: changed ? Buffer.from(JSON.stringify(report)) : buffer, changed };
}

// The pinned Playwright HTML reporter embeds a ZIP of JSON data in a template.
// Read entries serially and rebuild the archive, preserving valid compression
// and checksums. Never edit compressed bytes or extract paths onto the disk.
async function sanitizeReportZip(buffer) {
    const maxBytes = 64 * 1024 * 1024;
    if (buffer.length > maxBytes) throw new Error('HTML report archive exceeds the evidence bound');
    const archive = await new Promise((resolve, reject) => {
        utilsBundle.yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, (error, zip) => {
            if (error) reject(new Error('Invalid HTML report archive'));
            else resolve(zip);
        });
    });
    const entries = [];
    let totalBytes = 0;
    let changed = false;
    await new Promise((resolve, reject) => {
        const fail = () => { archive.close(); reject(new Error('Unsafe or unreadable HTML report data')); };
        archive.once('error', fail);
        archive.once('end', resolve);
        archive.on('entry', async (entry) => {
            try {
                totalBytes += entry.uncompressedSize;
                if (entries.length >= 4096 || totalBytes > maxBytes || entry.uncompressedSize > 16 * 1024 * 1024 ||
                    !entry.fileName.endsWith('.json') || (entry.generalPurposeBitFlag & 1)) {
                    fail(); return;
                }
                const stream = await new Promise((accept, decline) => {
                    archive.openReadStream(entry, (error, reader) => error ? decline(error) : accept(reader));
                });
                const chunks = [];
                let bytes = 0;
                for await (const chunk of stream) {
                    bytes += chunk.length;
                    if (bytes > entry.uncompressedSize) throw new Error('Invalid archive size');
                    chunks.push(chunk);
                }
                const contents = Buffer.concat(chunks);
                // Known report payloads are JSON, not arbitrary attachments.
                JSON.parse(contents.toString('utf8'));
                changed = redactText(contents) || changed;
                JSON.parse(contents.toString('utf8'));
                entries.push({ name: entry.fileName, contents });
                archive.readEntry();
            } catch {
                fail();
            }
        });
        archive.readEntry();
    });
    if (!changed) return { buffer, changed: false };
    const rebuilt = new utilsBundle.yazl.ZipFile();
    const completed = new Promise((resolve, reject) => {
        const chunks = [];
        rebuilt.outputStream.on('data', (chunk) => chunks.push(chunk));
        rebuilt.outputStream.once('error', reject);
        rebuilt.outputStream.once('end', () => resolve(Buffer.concat(chunks)));
    });
    for (const entry of entries) rebuilt.addBuffer(entry.contents, entry.name);
    rebuilt.end();
    return { buffer: await completed, changed: true };
}

async function sanitizeContents(file, buffer) {
    if (!credentialBuffers.length) return { buffer, changed: false };
    // A raw trace/video is not a report-data ZIP. Fail closed instead of
    // claiming raw scans prove compressed session traffic or pixels safe.
    if (/\.(zip|webm|mp4)$/i.test(file) || buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4]))) {
        throw new Error('Unexpected recording/archive in credentialed evidence; automatic recordings must stay disabled');
    }
    if (/\.json$/i.test(file)) return sanitizeJSONReporter(buffer);
    if (!/\.html?$/i.test(file)) return { buffer, changed: redactText(buffer) };
    const source = buffer.toString('utf8');
    const pattern = /(<template\b[^>]*\bid=["']playwrightReportBase64["'][^>]*>data:application\/zip;base64,)([A-Za-z0-9+/=\r\n]*)(<\/template>)/g;
    const chunks = [];
    let offset = 0;
    let changed = false;
    let matches = 0;
    for (const match of source.matchAll(pattern)) {
        const plain = Buffer.from(source.slice(offset, match.index) + match[1]);
        changed = redactText(plain) || changed;
        const encoded = match[2].replace(/\s/g, '');
        const compressed = Buffer.from(encoded, 'base64');
        if (compressed.toString('base64') !== encoded) throw new Error('Invalid HTML report encoding');
        const result = await sanitizeReportZip(compressed);
        changed = result.changed || changed;
        chunks.push(plain, Buffer.from(result.buffer.toString('base64') + match[3]));
        offset = match.index + match[0].length;
        matches += 1;
    }
    if (!matches && /<template\b[^>]*\bid=["']playwrightReportBase64["']/.test(source)) {
        throw new Error('Unrecognized HTML report data; refusing unchecked evidence');
    }
    const tail = Buffer.from(source.slice(offset));
    changed = redactText(tail) || changed;
    chunks.push(tail);
    return { buffer: Buffer.concat(chunks), changed };
}

const files = (await Promise.all(roots.map(filesBelow))).flat();
let changedFiles = 0;
for (const file of files) {
    const result = await sanitizeContents(file, await readFile(file));
    if (result.changed) {
        await writeFile(file, result.buffer);
        changedFiles += 1;
    }
}

for (const file of files) {
    const result = await sanitizeContents(file, await readFile(file));
    if (result.changed) {
        throw new Error(`Credential redaction failed for ${file}`);
    }
}

console.log(`Playwright artifact credential scan passed; sanitized ${changedFiles} file(s).`);
