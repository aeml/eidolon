import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { publishClientCoverage } from '../../../scripts/reporting/publish-client-coverage.mjs';

const owned = [];
const trace = 'TN:\nSF:src/example.js\nDA:1,1\nBRDA:13,0,0,0\nLF:1\nLH:1\nend_of_record\n';
async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), 'eidolon-coverage-publication-'));
    owned.push(root);
    const artifact = path.join(root, 'artifact'), output = path.join(root, 'public');
    await mkdir(path.join(artifact, 'lcov-report/src'), { recursive: true });
    await writeFile(path.join(artifact, 'lcov.info'), trace);
    await writeFile(path.join(artifact, 'lcov-report/index.html'), '<!doctype html><link href="report.css"><a href="src/example.js.html">coverage</a>');
    await writeFile(path.join(artifact, 'lcov-report/report.css'), 'body { color: green; }');
    await writeFile(path.join(artifact, 'lcov-report/src/example.js.html'), '<!doctype html><p>Original Istanbul source coverage</p>');
    return { artifact, output };
}
afterEach(async () => {
    await Promise.all(owned.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

test('publishes the exact Jest HTML and resources without reinterpreting LCOV branch categories', async () => {
    const { artifact, output } = await fixture();
    await publishClientCoverage(artifact, output);
    for (const name of ['index.html', 'report.css', 'src/example.js.html'])
        expect(await readFile(path.join(output, name))).toEqual(await readFile(path.join(artifact, 'lcov-report', name)));
    expect(await readFile(path.join(artifact, 'lcov.info'), 'utf8')).toBe(trace);
});

test.each(['lcov.info', 'lcov-report/index.html'])('refuses an incomplete artifact missing %s before creating publication output', async name => {
    const { artifact, output } = await fixture();
    await rm(path.join(artifact, name));
    await expect(publishClientCoverage(artifact, output)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('refuses an empty report instead of publishing a successful-looking placeholder', async () => {
    const { artifact, output } = await fixture();
    await writeFile(path.join(artifact, 'lcov-report/index.html'), '');
    await expect(publishClientCoverage(artifact, output)).rejects.toThrow('Missing nonempty client coverage report');
    await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('the workflow CLI publishes the same complete report tree', async () => {
    const { artifact, output } = await fixture();
    execFileSync(process.execPath, ['scripts/reporting/publish-client-coverage.mjs', artifact, output]);
    expect(await readFile(path.join(output, 'index.html'))).toEqual(await readFile(path.join(artifact, 'lcov-report/index.html')));
});
