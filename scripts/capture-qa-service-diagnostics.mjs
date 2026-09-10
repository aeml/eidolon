import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function redactServiceDiagnostics(value, secrets) {
    let text = String(value ?? '');
    for (const secret of [...new Set(secrets.filter(Boolean))].sort((a, b) => b.length - a.length)) {
        text = text.split(secret).join('[REDACTED]');
    }
    return text;
}

export function captureQAServiceDiagnostics({ container, label, artifactRoot = 'test-results',
    secrets = [], run = spawnSync }) {
    if (!/^eidolon-isolated-qa-(mongo|api)-[a-z0-9][a-z0-9_.-]{0,30}$/.test(container) ||
        !['mongo', 'api'].includes(label) || !container.startsWith(`eidolon-isolated-qa-${label}-`)) {
        throw new Error('Diagnostics require the exact disposable service container');
    }
    const capture = args => {
        try {
            const result = run('docker', args, { encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024,
                stdio: ['ignore', 'pipe', 'pipe'] });
            const prefix = result.error || result.status !== 0
                ? `Diagnostic command failed: ${result.error?.message || `exit ${result.status}, signal ${result.signal || 'none'}`}\n` : '';
            return `${prefix}${result.stdout || ''}${result.stderr ? `\n${result.stderr}` : ''}`;
        } catch (error) {
            return `Diagnostic command failed: ${error.message}\n${error.stdout || ''}\n${error.stderr || ''}`;
        }
    };
    // Never inspect Config/Env. Redact in memory before writing any artifact,
    // including partial output from failed commands. Both calls are bounded.
    const state = capture(['inspect', '--format', '{{json .State}}', container]);
    const logs = capture(['logs', '--tail', '80', container]);
    mkdirSync(artifactRoot, { recursive: true });
    const directory = mkdtempSync(path.join(artifactRoot, `isolated-${label}-failure-`));
    writeFileSync(path.join(directory, 'state.txt'), redactServiceDiagnostics(state, secrets), { mode: 0o600 });
    writeFileSync(path.join(directory, 'service.log'), redactServiceDiagnostics(logs, secrets), { mode: 0o600 });
    return directory;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const secrets = ['EIDOLON_E2E_USERNAME', 'EIDOLON_E2E_PASSWORD',
        'EIDOLON_E2E_USERNAME_SECONDARY', 'EIDOLON_E2E_PASSWORD_SECONDARY',
        'EIDOLON_QA_MONGO_USERNAME', 'EIDOLON_QA_MONGO_PASSWORD'].map(name => process.env[name]);
    const directory = captureQAServiceDiagnostics({ container: process.argv[2], label: process.argv[3], secrets });
    console.log(`[qa-service-diagnostics] Retained redacted startup evidence: ${directory}`);
}
