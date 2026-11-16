#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { Socket } from 'node:net';
import { constants, getPriority, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrowserProxy } from './qa-browser-proxy.mjs';

const image = 'mongo@sha256:0032d2ca20db5fa34926f196c8a43b74e34ed239a7f2453ff1505b6f12ba8ea6';
const owner = 'eidolon-chrome-network';
const run = process.env.GITHUB_RUN_ID || `local-${process.pid}`;
if (!/^[a-zA-Z0-9-]+$/.test(run)) throw new Error('Invalid QA run identifier');
const nonce = randomBytes(8).toString('hex');
const name = `eidolon-chrome-${run}-${nonce}`;
const network = `${name}-net`;
const labelArgs = ['--label', `eidolon.qa.owner=${owner}`, '--label', `eidolon.qa.run=${run}`, '--label', `eidolon.qa.nonce=${nonce}`];
let attached, proxy, root, networkCreated = false, containerCreated = false, stopped = false;
let exitCode = 1;

async function docker(args, { missingOK = false } = {}) {
    return await new Promise((resolve, reject) => {
        const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000);
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr += data; });
        child.once('error', reject);
        child.once('close', code => {
            clearTimeout(timeout);
            if (code === 0) resolve(stdout.trim());
            else if (missingOK && /No such (object|container|network)/i.test(stderr)) resolve(null);
            else reject(new Error(`Docker ${args[0]} failed (${code}): ${stderr.trim()}`));
        });
    });
}

function bind(source, destination = source, readonly = true) {
    if (source.includes(',') || destination.includes(',')) throw new Error('Unsupported bind path');
    return ['--mount', `type=bind,src=${source},dst=${destination}${readonly ? ',readonly' : ''}`];
}

async function removeOwned(kind, resource) {
    const inspected = await docker([kind, 'inspect', resource], { missingOK: true });
    if (inspected === null) return;
    const metadata = JSON.parse(inspected)[0];
    const labels = metadata.Config?.Labels || metadata.Labels;
    if (labels?.['eidolon.qa.owner'] !== owner || labels?.['eidolon.qa.run'] !== run ||
        labels?.['eidolon.qa.nonce'] !== nonce) throw new Error('Refusing to remove an unowned QA resource');
    await docker(kind === 'container' ? [kind, 'rm', '--force', '--volumes', resource] : [kind, 'rm', resource]);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
        stopped = true;
        exitCode = 128 + constants.signals[signal];
        attached?.kill(signal);
    });
}

try {
    if (process.platform !== 'linux' || process.getuid() === 0) throw new Error('QA Chrome requires an ordinary Linux user');
    const browserArgs = process.argv.slice(2);
    if (!browserArgs.includes('--remote-debugging-pipe')) throw new Error('QA Chrome requires the Playwright CDP pipe');
    const profileArg = browserArgs.find(arg => arg.startsWith('--user-data-dir='));
    if (!profileArg) throw new Error('Missing owned Playwright profile');
    const profile = realpathSync(profileArg.slice('--user-data-dir='.length));
    const downloads = realpathSync(process.env.EIDOLON_QA_DOWNLOADS);
    if (dirname(profile) !== realpathSync(tmpdir()) || !profile.split('/').at(-1).startsWith('playwright_chromiumdev_profile-') ||
        dirname(downloads) !== realpathSync(tmpdir()) || !downloads.split('/').at(-1).startsWith('eidolon-browser-downloads-') ||
        [profile, downloads].some(path => statSync(path).uid !== process.getuid())) throw new Error('Unowned browser directories');
    let chrome = realpathSync(process.env.EIDOLON_QA_REAL_CHROME);
    if (chrome === '/opt/google/chrome/google-chrome') chrome = '/opt/google/chrome/chrome';
    if (chrome !== '/opt/google/chrome/chrome' || !existsSync('/dev/dri/renderD128')) throw new Error('System Chrome/GPU runner required');
    root = mkdtempSync(join(tmpdir(), 'eidolon-chrome-home-'));
    networkCreated = true;
    await docker(['network', 'create', ...labelArgs, network]);
    const origins = ['https://play.eidolonrealms.com', 'https://server.eidolonrealms.com', 'https://eserver.mendola.tech',
        ...['EIDOLON_E2E_BASE_URL', 'EIDOLON_E2E_WS_URL', 'EIDOLON_E2E_HEALTH_URL'].map(key => process.env[key]).filter(Boolean)];
    proxy = await createBrowserProxy({ socketPath: join(root, 'proxy.sock'), origins,
        allowLoopback: true, backendOriginIP: process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP });
    const cpus = readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1];
    if (!cpus) throw new Error('Missing caller CPU affinity');
    const nodeRoot = dirname(dirname(realpathSync(process.execPath)));
    const capsuleScript = fileURLToPath(new URL('./qa-browser-capsule.mjs', import.meta.url));
    const args = ['create', '--interactive', '--init', '--log-driver', 'none', '--name', name, ...labelArgs,
        '--network', network, '--user', `${process.getuid()}:${process.getgid()}`, '--cpuset-cpus', cpus,
        '--group-add', String(statSync('/dev/dri/renderD128').gid), '--device', '/dev/dri/renderD128',
        ...bind(profile, profile, false), ...bind(downloads, downloads, false), ...bind(root, '/data/db', false),
        ...bind(nodeRoot), ...bind(capsuleScript, '/run/eidolon-browser-capsule.mjs'),
        ...['/opt/google/chrome', '/usr/lib/x86_64-linux-gnu', '/usr/share/vulkan', '/usr/share/glvnd',
            '/usr/share/fonts', '/etc/fonts', '/etc/ssl/certs'].flatMap(path => bind(path)),
        '--entrypoint', '/usr/bin/nice', image, '-n', String(getPriority()),
        '/bin/bash', '-c', 'read -r ready || exit 1; exec 3<&0 4>&1; exec "$@"',
        'eidolon-chrome', process.execPath, '/run/eidolon-browser-capsule.mjs', '/data/db/proxy.sock', chrome, ...browserArgs];
    containerCreated = true;
    await docker(args);
    if (stopped) throw new Error('Browser launch interrupted');
    attached = spawn('docker', ['start', '--attach', '--interactive', name], { stdio: ['pipe', 'pipe', 'pipe'] });
    const closed = new Promise((resolve, reject) => {
        attached.once('error', reject);
        attached.once('close', (code, signal) => resolve(code ?? (128 + constants.signals[signal])));
    });
    attached.stderr.pipe(process.stderr);
    const cdpInput = new Socket({ fd: 3, readable: true, writable: false });
    const cdpOutput = new Socket({ fd: 4, readable: false, writable: true });
    // No parsing, logging, serialization or buffering of CDP payloads here.
    attached.stdout.pipe(cdpOutput);
    attached.stdin.on('error', () => cdpInput.destroy());
    cdpOutput.on('error', () => { stopped = true; attached.kill('SIGTERM'); });
    if (stopped) throw new Error('Browser launch interrupted');
    attached.stdin.write('\n');
    cdpInput.pipe(attached.stdin);
    const code = await closed;
    cdpInput.destroy();
    cdpOutput.end();
    if (!stopped) exitCode = code;
} catch (error) {
    console.error(`QA browser isolation: ${error.message}`);
} finally {
    let containerRemoved = !containerCreated;
    for (const cleanup of [
        async () => { if (containerCreated) await removeOwned('container', name); containerRemoved = true; },
        async () => { if (proxy) await proxy.close(); },
        async () => { if (networkCreated) await removeOwned('network', network); },
        async () => { if (root && containerRemoved) rmSync(root, { recursive: true, force: true }); }
    ]) {
        try { await cleanup(); }
        catch (error) { console.error(`QA browser cleanup failed: ${error.message}`); exitCode = 1; }
    }
}
process.exitCode = exitCode;
