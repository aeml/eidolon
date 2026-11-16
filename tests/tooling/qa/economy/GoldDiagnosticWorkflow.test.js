import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import yaml from 'js-yaml';

const workflow = yaml.load(readFileSync('.github/workflows/live-gold-provenance.yml', 'utf8'));
const spec = readFileSync('tests/e2e/economy/live-gold-provenance.spec.js', 'utf8');

test('the privileged diagnostic is manual, bounded and restricted to the trusted master branch', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.workflow_dispatch.inputs.expected_commit).toMatchObject({ required: true, type: 'string' });
    const job = workflow.jobs.observe;
    expect(job['timeout-minutes']).toBe(10);
    for (const [repository, ref, event, allowed] of [
        ['aeml/eidolon', 'refs/heads/master', 'workflow_dispatch', true],
        ['aeml/eidolon', 'refs/heads/work', 'workflow_dispatch', false],
        ['someone/fork', 'refs/heads/master', 'workflow_dispatch', false],
        ['aeml/eidolon', 'refs/heads/master', 'push', false]
    ]) expect(runInNewContext(job.if, { github: { repository, ref, event_name: event } })).toBe(allowed);
    expect(job.env.EIDOLON_EXPECTED_COMMIT).toBe('${{ inputs.expected_commit }}');
});

test('the exact frontend/backend identity is required before credentials are used to enter the game', () => {
    const identity = spec.indexOf('expect(release.commit).toBe(expected)');
    expect(identity).toBeGreaterThan(spec.indexOf('toMatch(/^[a-f0-9]{40}$/)'));
    expect(spec.indexOf('expect(health.commit).toBe(expected)')).toBeGreaterThan(identity);
    expect(spec.indexOf('await loginAndEnterWorld')).toBeGreaterThan(identity);
    expect(spec).toContain("const expected = process.env.EIDOLON_EXPECTED_COMMIT;");
    expect(spec).toContain('test.setTimeout(180_000)');
});

test('one observation retains failed assertions and sanitized evidence without deployment steps', () => {
    const job = workflow.jobs.observe;
    expect(job.steps.find(step => step.name === 'Observe the existing live QA boundary once').run).toContain('--workers=1 --retries=0');
    expect(job.steps.some(step => /deploy-pages|deploy_linux|ssh/.test(step.run || step.uses || ''))).toBe(false);
    expect(job.steps.find(step => step.name === 'Upload actual diagnostic evidence').if).toContain("steps.sanitize.outcome == 'success'");
    expect(spec).toContain('finally {');
    expect(spec).toContain('Every packet forwarded verbatim');
    expect(spec).toContain('not a rerun/waiver of the failed release gate');
});
