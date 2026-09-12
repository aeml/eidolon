import { readFileSync } from 'node:fs';

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const soak = readFileSync('.github/workflows/nightly-soak.yml', 'utf8');

test('hosted rehearsals do not hold or replace the production Pages queue', () => {
    const production = "github.event_name == 'push' && (github.ref == 'refs/heads/master' || github.ref == 'refs/heads/main')";
    const concurrency = ci.split('\nconcurrency:\n')[1].split('\njobs:')[0];
    expect(concurrency).toContain(`group: \${{ (${production}) && 'pages' || format('ci-checks-{0}-{1}', github.workflow, github.ref) }}`);
    expect(concurrency).toContain('cancel-in-progress: false');
    for (const job of ['release-inputs', 'deploy', 'deploy-server']) {
        const body = ci.split(`  ${job}:\n`)[1]?.split(/\n {2}[a-z][a-z-]*:\n/)[0];
        expect(body).toContain(`if: ${production}`);
    }
    const native = ci.split('  predeploy-character:\n')[1].split('  release-inputs:')[0];
    expect(native).toContain(`if: (${production}) || inputs.full_stabilization == true`);
    const postDeploy = ci.split('  post-deploy-browser:\n')[1];
    expect(postDeploy).toContain('needs: [deploy, deploy-server]');
    expect(postDeploy).not.toContain('if: ${{ always() }}\n    runs-on:');
});

test('the uninterrupted soak has a queue separate from deployment GPU QA', () => {
    expect(soak).toContain('runs-on: [self-hosted, linux, x64, eidolon-soak]');
    expect(soak).not.toContain('eidolon-live-browser');
    expect(ci.match(/runs-on: \[self-hosted, linux, x64, eidolon-live-browser\]/g)).toHaveLength(2);
    expect(ci).not.toContain('eidolon-soak');
    expect(soak).toContain('default: 24h');
    expect(soak).toContain('timeout-minutes: 1500');
    expect(soak).toContain('cancel-in-progress: false');
    expect(soak).toContain('group: nightly-multiplayer-soak');
});

test('ordinary CI stays hosted and GPU acceptance is not replaced with software rendering', () => {
    for (const job of ['client-tests', 'server-tests', 'browser-smoke']) {
        const body = ci.split(`  ${job}:\n`)[1]?.split(/\n {2}[a-z][a-z-]*:\n/)[0];
        expect(body).toContain('runs-on: ubuntu-latest');
    }
    expect(ci.match(/npm run verify:browser-gpu/g)).toHaveLength(2);
    expect(ci).toContain('npm run test:e2e:isolated');
});

test('the soak remains trusted-branch only and uses an isolated dynamic database port', () => {
    expect(soak).toContain("if: github.repository == 'aeml/eidolon'");
    expect(soak).toContain("github.event_name == 'schedule'");
    expect(soak).toContain("github.event_name == 'workflow_dispatch' && (github.ref == 'refs/heads/master' || github.ref == 'refs/heads/main')");
    expect(soak).not.toMatch(/pull_request/);
    expect(soak).toContain('- 27017/tcp');
    expect(soak).toContain('mongodb://127.0.0.1:${{ job.services.mongodb.ports[27017] }}');
    expect(soak).toContain("SOAK_DISPOSABLE_DATABASE: '1'");
    expect(soak).toContain('node scripts/run-nightly-soak.mjs');
});
