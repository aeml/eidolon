import { readFileSync } from 'node:fs';

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
