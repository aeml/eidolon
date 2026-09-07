import { readFileSync } from 'node:fs';

test('anonymous CI retains exact cast aiming and covered-loot pointer regressions', () => {
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/ground-aim.spec.js');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/loot-pointer.spec.js');
});

test('local and CI isolated servers reserve disjoint API/database ports', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const local = Number(script.match(/EIDOLON_ISOLATED_QA_PORT:-(\d+)/)?.[1]);
    const ci = Number(workflow.match(/EIDOLON_ISOLATED_QA_PORT: '(\d+)'/)?.[1]);
    for (const port of [local, ci]) {
        expect(port).toBeGreaterThanOrEqual(1024);
        expect(port + 1).toBeLessThanOrEqual(65535);
    }
    expect(new Set([local, local + 1, ci, ci + 1]).size).toBe(4);
    expect(workflow).toContain("EIDOLON_ISOLATED_QA_NETWORK_MODE: 'host'");
    expect(script).toContain('if [[ "$(uname -s)" == Linux ]]; then\n  qa_default_network_mode=host');
    expect(script).toContain('mongo_bind=--bind_ip=127.0.0.1');
    expect(script).toContain('api_addr="127.0.0.1:${QA_PORT}"');
});

test('phone chat coverage and Purifying retry keep the real player path', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const probe = readFileSync('tests/e2e/purifying-area-gameplay.spec.js', 'utf8');
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(script).toContain('${QA_USERNAME_BASE}-cleanse-retry1');
    expect(script).toContain('EIDOLON_E2E_PURIFYING_RETRY_PROBE=1 run_purifying_area --retries=1');
    expect(probe).toContain('credentials.username += `-retry${testInfo.retry}`');
    expect(probe).toContain("await verifyCast(0, 'high')");
    expect(probe).toContain("await verifyCast(5, 'low')");
    expect(probe).toContain("await verifyCast(5, 'high')");
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/mobile-chat-layering.spec.js');
});

test('the full release gate retains Seraph gameplay and rendered fallback checks', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(script).toContain('&& run_talent_duration && run_seraph &&');
    expect(script).toContain('${QA_USERNAME_BASE}-seraph-retry1');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/offline-seraph-render.spec.js');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/summon-action-readability.spec.js');
});

test('the full release gate retains saved Shield training and hostile absorption', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('&& run_seraph && run_shield_training &&');
    expect(script).toContain('${QA_USERNAME_BASE}-shield-retry1');
    expect(script).toContain('npx playwright test tests/e2e/shield-training-gameplay.spec.js');
});

test('anonymous CI retains content-sized and long-list phone status coverage', () => {
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/mobile-status-compact.spec.js');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/mobile-status-layout.spec.js');
});
