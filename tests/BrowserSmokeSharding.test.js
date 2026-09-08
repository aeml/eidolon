import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const browser = workflow.split('  browser-smoke:\n')[1].split('\n  predeploy-character:')[0];
const predeploy = workflow.split('  predeploy-character:\n')[1].split('\n  release-inputs:')[0];

test('all three hosted browser shards keep the complete anonymous command and independent evidence', () => {
    expect(browser).toContain('runs-on: ubuntu-latest');
    expect(browser).toContain('fail-fast: false');
    expect(browser).toContain('shard: [1, 2, 3]');
    expect(browser).toContain('npm run test:e2e:anonymous -- --shard=${{ matrix.shard }}/3');
    expect(browser).toContain('name: predeploy-browser-evidence-${{ matrix.shard }}');
    expect(browser).not.toContain('continue-on-error');
    expect(browser).not.toContain('--grep');
    expect(browser).not.toContain('--fully-parallel');
});

test('production character QA still waits on the complete browser matrix', () => {
    expect(predeploy).toContain('needs: [browser-smoke]');
    expect(predeploy).toContain("if: github.event_name == 'push'");
    expect(predeploy).not.toContain('always()');
    const config = readFileSync('playwright.config.js', 'utf8');
    expect(config).toContain('fullyParallel: false');
    expect(config).toContain('workers: 1');
});
