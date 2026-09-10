import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const source = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
const forge = source.match(/^run_forge_guide\(\) \{[\s\S]*?^\}/m)?.[0];
const route = source.match(/^ {2}equipment-refresh\)\n([\s\S]*?)^ {4};;/m)?.[1];
function execute(fail = false) {
    expect(forge).toBeTruthy(); expect(route).toBeTruthy();
    return spawnSync('bash', ['-c', `
        QA_USERNAME_BASE=fixture
        MONGO_CONTAINER=fixture
        mongo_port=19001
        npx() { printf '%s\\n' "$*"; return ${fail ? 19 : 0}; }
        ${forge}
        ${route}
    `], { encoding: 'utf8' });
}

test('the real shell route isolates output directories beneath the scanned artifact root', () => {
    const result = execute();
    expect(result.status).toBe(0);
    const commands = result.stdout.trim().split('\n');
    expect(commands).toHaveLength(2);
    expect(commands[0]).toContain('earned-equipment-upgrades.spec.js --retries=0 --repeat-each=3 --output=test-results/equipment-upgrades');
    expect(commands[1]).toContain('forge-guide-gameplay.spec.js --output=test-results/forge-guide');
});

test('a failed native upgrade gate cannot be hidden by running the Forge gate afterwards', () => {
    const result = execute(true);
    expect(result.status).toBe(19);
    expect(result.stdout).not.toContain('forge-guide-gameplay');
});
