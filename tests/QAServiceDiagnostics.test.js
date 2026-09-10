import { jest } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { captureQAServiceDiagnostics, redactServiceDiagnostics } from '../scripts/capture-qa-service-diagnostics.mjs';

test('redaction handles repeats and overlapping secrets before artifact persistence', () => {
    expect(redactServiceDiagnostics('secret-long secret secret-long', ['', 'secret', 'secret-long', undefined]))
        .toBe('[REDACTED] [REDACTED] [REDACTED]');
});

test('startup capture inspects only State and bounded logs, preserving exit evidence without credentials', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'eidolon-service-diagnostics-test-'));
    const run = jest.fn().mockReturnValueOnce({ status: 0, stdout: '{"Running":false,"ExitCode":100}' })
        .mockReturnValueOnce({ status: 0, stdout: 'mongodb://qa-user:qa-password@localhost', stderr: 'Bind failed' });
    try {
        const output = captureQAServiceDiagnostics({ container: 'eidolon-isolated-qa-mongo-unit', label: 'mongo',
            artifactRoot: directory, secrets: ['qa-user', 'qa-password'], run });
        expect(readFileSync(path.join(output, 'state.txt'), 'utf8')).toContain('"ExitCode":100');
        expect(readFileSync(path.join(output, 'service.log'), 'utf8'))
            .toBe('mongodb://[REDACTED]:[REDACTED]@localhost\nBind failed');
        expect(run.mock.calls.map(([, args]) => args)).toEqual([
            ['inspect', '--format', '{{json .State}}', 'eidolon-isolated-qa-mongo-unit'],
            ['logs', '--tail', '80', 'eidolon-isolated-qa-mongo-unit']
        ]);
        for (const [, , options] of run.mock.calls) {
            expect(options).toMatchObject({ timeout: 5000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
        }
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('failed Docker diagnostics retain sanitized partial output instead of masking readiness failure', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'eidolon-service-diagnostics-error-'));
    const run = jest.fn(() => { throw Object.assign(new Error('failed with secret'),
        { stdout: 'partial secret', stderr: 'denied secret' }); });
    try {
        const output = captureQAServiceDiagnostics({ container: 'eidolon-isolated-qa-api-unit', label: 'api',
            artifactRoot: directory, secrets: ['secret'], run });
        for (const name of ['state.txt', 'service.log']) {
            const content = readFileSync(path.join(output, name), 'utf8');
            expect(content).toContain('Diagnostic command failed');
            expect(content).toContain('partial [REDACTED]');
            expect(content).not.toContain('secret');
        }
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('timed-out diagnostics preserve bounded partial stderr with secrets removed', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'eidolon-service-diagnostics-timeout-'));
    const run = jest.fn(() => ({ status: null, signal: 'SIGTERM', error: new Error('timeout secret'),
        stdout: '', stderr: 'partial startup secret' }));
    try {
        const output = captureQAServiceDiagnostics({ container: 'eidolon-isolated-qa-mongo-timeout', label: 'mongo',
            artifactRoot: directory, secrets: ['secret'], run });
        expect(readFileSync(path.join(output, 'service.log'), 'utf8'))
            .toBe('Diagnostic command failed: timeout [REDACTED]\n\npartial startup [REDACTED]');
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test.each([['eidolon-api', 'api'], ['eidolon-isolated-qa-mongo-unit', 'api'], ['--help', 'mongo']])(
    'refuses unrelated or mismatched diagnostic targets: %s/%s', (container, label) => {
        const run = jest.fn();
        expect(() => captureQAServiceDiagnostics({ container, label, run })).toThrow('exact disposable');
        expect(run).not.toHaveBeenCalled();
    });

test('both startup failure paths capture before fatal exit and retain exact cleanup', () => {
    const source = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(source).toContain('capture_isolated_service_failure "${MONGO_CONTAINER}" mongo\n    exit 1');
    expect(source).toContain('capture_isolated_service_failure "${API_CONTAINER}" api\n    exit 1');
    expect(source).toContain('EIDOLON_QA_MONGO_PASSWORD="${mongo_password}"');
    expect(source).toContain('trap cleanup_isolated_qa EXIT INT TERM');
});
