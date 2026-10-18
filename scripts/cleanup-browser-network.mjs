import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rmSync, statSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
const run = process.env.GITHUB_RUN_ID;
if (!run || !/^[a-zA-Z0-9-]+$/.test(run)) throw new Error('Cleanup requires an exact QA run identifier');
const owner = 'eidolon-chrome-network';
const filters = ['--filter', `label=eidolon.qa.owner=${owner}`, '--filter', `label=eidolon.qa.run=${run}`];
const docker = async args => (await exec('docker', args, { timeout: 30_000, maxBuffer: 1024 * 1024 })).stdout.trim();
const verified = metadata => {
    const labels = metadata.Config?.Labels || metadata.Labels;
    if (labels?.['eidolon.qa.owner'] !== owner || labels?.['eidolon.qa.run'] !== run ||
        !/^[a-f0-9]{16}$/.test(labels?.['eidolon.qa.nonce'] || '') ||
        !(metadata.Name.startsWith(`/eidolon-chrome-${run}-`) || metadata.Name.startsWith(`eidolon-chrome-${run}-`))) {
        throw new Error('Refusing to clean an unowned Docker resource');
    }
};
let containers = 0, networks = 0;
for (const id of (await docker(['container', 'ls', '--all', '--quiet', '--no-trunc', ...filters])).split('\n').filter(Boolean)) {
    const metadata = JSON.parse(await docker(['container', 'inspect', id]))[0];
    verified(metadata);
    const home = metadata.Mounts.find(mount => mount.Destination === '/data/db')?.Source;
    if (!home || dirname(home) !== tmpdir() || !basename(home).startsWith('eidolon-chrome-home-') ||
        statSync(home).uid !== process.getuid()) throw new Error('Refusing to remove an unowned browser home');
    await docker(['container', 'rm', '--force', '--volumes', id]);
    rmSync(home, { recursive: true, force: true });
    containers++;
}
for (const id of (await docker(['network', 'ls', '--quiet', '--no-trunc', ...filters])).split('\n').filter(Boolean)) {
    const metadata = JSON.parse(await docker(['network', 'inspect', id]))[0];
    verified(metadata);
    await docker(['network', 'rm', id]);
    networks++;
}
console.log(JSON.stringify({ run, removedContainers: containers, removedNetworks: networks }));
