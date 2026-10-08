import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const soak = readFileSync('.github/workflows/nightly-soak.yml', 'utf8');

test('documentation-only pushes skip publishing without filtering required PR checks', () => {
    const push = ci.split('\n  push:\n')[1].split('\n  pull_request:')[0];
    const ignored = [...push.matchAll(/^ {6}- '([^']+)'$/gm)].map(match => match[1]);
    expect(ignored).toEqual(['README.md', 'docs/**/*.md']);
    expect(push).toContain('branches: [master, main]');
    expect(ci.match(/paths-ignore:/g)).toHaveLength(1);
    const otherTriggers = ci.split('\n  pull_request:\n')[1].split('\npermissions:')[0];
    expect(otherTriggers).toContain('branches: [master, main]');
    expect(otherTriggers).toContain('workflow_dispatch:');
    expect(otherTriggers).not.toMatch(/paths(?:-ignore)?:/);
});

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
    expect(native).toContain("if: github.repository == 'aeml/eidolon' && (github.ref == 'refs/heads/master' || github.ref == 'refs/heads/main') && (github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && inputs.full_stabilization == true))");
    const postDeploy = ci.split('  post-deploy-browser:\n')[1];
    expect(postDeploy).toContain('needs: [deploy, deploy-server]');
    expect(postDeploy).not.toContain('if: ${{ always() }}\n    runs-on:');
});

test('actual self-hosted admission conditions reject foreign repositories, PRs and manual non-release refs', () => {
    const jobCondition = (workflow, name) => {
        const body = workflow.split(`  ${name}:\n`)[1]?.split(/\n {2}[a-z][a-z-]*:\n/)[0];
        const condition = body?.match(/^ {4}if: (.+)$/m)?.[1];
        expect(condition).toBeDefined();
        // These job guards use only the common boolean/exact-literal subset
        // of GitHub expressions. Evaluate the source condition, not a copy.
        expect(condition).not.toMatch(/\$\{|[;{}]/);
        return context => runInNewContext(condition, context, { timeout: 100 });
    };
    const predeploy = jobCondition(ci, 'predeploy-character');
    expect(predeploy({
        github: { repository: 'aeml/eidolon', event_name: 'workflow_dispatch', ref: 'refs/heads/feature' },
        inputs: { full_stabilization: true }
    })).toBe(false);
    const live = jobCondition(ci, 'post-deploy-browser');
    const nightly = jobCondition(soak, 'soak');
    for (const repository of ['aeml/eidolon', 'contributor/eidolon']) {
        for (const event_name of ['push', 'pull_request', 'workflow_dispatch']) {
            for (const ref of ['refs/heads/master', 'refs/heads/main', 'refs/heads/feature', 'refs/pull/42/merge', 'refs/tags/v1.82.0']) {
                for (const full_stabilization of [false, true]) {
                    const context = { github: { repository, event_name, ref }, inputs: { full_stabilization } };
                    const trusted = repository === 'aeml/eidolon'
                        && ['refs/heads/master', 'refs/heads/main'].includes(ref);
                    expect(predeploy(context)).toBe(trusted && (event_name === 'push'
                        || (event_name === 'workflow_dispatch' && full_stabilization)));
                    expect(live(context)).toBe(trusted && event_name === 'push');
                    expect(nightly(context)).toBe(trusted && event_name === 'workflow_dispatch');
                }
            }
        }
    }
    expect(nightly({ github: { repository: 'aeml/eidolon', event_name: 'schedule', ref: 'refs/heads/master' }, inputs: {} })).toBe(true);
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
