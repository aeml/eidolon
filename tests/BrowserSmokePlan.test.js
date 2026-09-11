import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { buildBrowserSmokePlan, browserSmokeBaselineFiles, runBrowserSmokePlan } from '../scripts/browser-smoke-plan.mjs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));

test('each required shard separates expensive independent render families from ordinary file groups', () => {
    for (const shard of [1, 2, 3]) {
        const plan = buildBrowserSmokePlan(manifest, shard);
        expect(plan.slice(0, 3).map(stage => stage.name)).toEqual(['layout', 'entrances', 'effects']);
        for (const stage of plan.slice(0, 3)) expect(stage.args).toContain(`--shard=${shard}/3`);
        expect(plan[0].args).not.toContain('--fully-parallel');
        for (const stage of plan.slice(1, 3)) expect(stage.args).toContain('--fully-parallel');
        expect(plan[1].files).toEqual(['tests/e2e/entrance-visibility.spec.js']);
        expect(plan[2].files).toHaveLength(3);
        for (const stage of plan) {
            expect(stage.args).toContain('--workers=1');
            expect(stage.args).toContain(`--output=test-results/browser-${shard}/${stage.name}`);
            expect(stage.env.PLAYWRIGHT_HTML_OUTPUT_DIR).toBe(`playwright-report/browser-${shard}/${stage.name}`);
            expect(stage.args).not.toContain('--pass-with-no-tests');
        }
    }
});

test('file families partition the unchanged local anonymous command exactly once', () => {
    const original = manifest.scripts['test:e2e:anonymous'].split(/\s+/).slice(2).sort();
    const stages = buildBrowserSmokePlan(manifest, 1).slice(0, 3);
    const actual = stages.flatMap(stage => stage.files);
    expect(actual.slice().sort()).toEqual(original);
    expect(new Set(actual).size).toBe(actual.length);
});

test('all supplemental coverage stays in exactly one required job', () => {
    const extras = [1, 2, 3].flatMap(shard => buildBrowserSmokePlan(manifest, shard).slice(3));
    expect(extras.map(stage => stage.name)).toEqual(['nameplates', 'resource-hud', 'crystal-art', 'interface']);
    const supplementalFiles = extras.flatMap(stage => stage.files);
    expect(new Set(supplementalFiles).size).toBe(supplementalFiles.length);
    for (const stage of extras) expect(stage.args.some(arg => arg.startsWith('--shard='))).toBe(false);
    expect(browserSmokeBaselineFiles(manifest).length).toBe(new Set(browserSmokeBaselineFiles(manifest)).size);
});

test('baseline preserves the complete current release workflow command union', () => {
    const files = ['anonymous', 'nameplates', 'resource-hud', 'crystal-art', 'interface']
        .flatMap(name => manifest.scripts[`test:e2e:${name}`].split(/\s+/).slice(2));
    expect(browserSmokeBaselineFiles(manifest).slice().sort()).toEqual(files.slice().sort());
    expect(new Set(files).size).toBe(files.length);
});

test('interface additions follow the manifest into the sole required interface stage', () => {
    const changed = { ...manifest, scripts: { ...manifest.scripts } };
    const added = 'tests/e2e/future-interface-coverage.spec.js';
    changed.scripts['test:e2e:interface'] += ` ${added}`;
    const stages = [1, 2, 3].flatMap(shard => buildBrowserSmokePlan(changed, shard));
    expect(stages.filter(stage => stage.files.includes(added)).map(stage => stage.name)).toEqual(['interface']);
    expect(browserSmokeBaselineFiles(changed)).toContain(added);
    delete changed.scripts['test:e2e:interface'];
    expect(() => buildBrowserSmokePlan(changed, 1)).toThrow('interface');
});

test('expanded story crystal art remains mandatory once in the integrated browser gate', () => {
    const plans = [1, 2, 3].flatMap(shard => buildBrowserSmokePlan(manifest, shard));
    const expected = manifest.scripts['test:e2e:crystal-art'].split(/\s+/).slice(2);
    for (const file of expected) {
        expect(plans.filter(stage => stage.files.includes(file)).map(stage => stage.name)).toEqual(['crystal-art']);
        expect(browserSmokeBaselineFiles(manifest)).toContain(file);
    }
    const changed = { ...manifest, scripts: { ...manifest.scripts } };
    delete changed.scripts['test:e2e:crystal-art'];
    expect(() => buildBrowserSmokePlan(changed, 2)).toThrow('crystal-art');
});

test.each([0, 4, -1, 1.5, '1', NaN])('invalid shard %p fails closed', shard => {
    expect(() => buildBrowserSmokePlan(manifest, shard)).toThrow('shard');
});

test('unsupported shell arguments or missing required coverage fail before a browser starts', () => {
    const changed = { ...manifest, scripts: { ...manifest.scripts } };
    changed.scripts['test:e2e:anonymous'] += ' --grep smoke';
    expect(() => buildBrowserSmokePlan(changed, 1)).toThrow();
    changed.scripts['test:e2e:anonymous'] = manifest.scripts['test:e2e:anonymous'].replace('tests/e2e/entrance-visibility.spec.js', '');
    expect(() => buildBrowserSmokePlan(changed, 1)).toThrow('entrance-visibility');
});

test('a failed stage preserves its exact exit status and stops later commands', () => {
    const plan = buildBrowserSmokePlan(manifest, 1);
    const execute = jest.fn().mockReturnValueOnce({ status: 0 }).mockReturnValueOnce({ status: 7 });
    expect(runBrowserSmokePlan(plan, execute)).toBe(7);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(2, plan[1]);
});

test('all planned stages must succeed, and failed launch or signal is never success', () => {
    const plan = buildBrowserSmokePlan(manifest, 3);
    const execute = jest.fn(() => ({ status: 0 }));
    expect(runBrowserSmokePlan(plan, execute)).toBe(0);
    expect(execute).toHaveBeenCalledTimes(plan.length);
    expect(runBrowserSmokePlan(plan, () => ({ status: null, signal: 'SIGTERM' }))).toBe(1);
    expect(runBrowserSmokePlan(plan, () => ({ error: new Error('spawn failed') }))).toBe(1);
});
