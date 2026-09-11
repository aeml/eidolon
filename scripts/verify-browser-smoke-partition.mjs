import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildBrowserSmokePlan, browserSmokeBaselineFiles } from './browser-smoke-plan.mjs';
import { discoveredCaseIdentities, verifyDiscoveredPartition } from './browser-smoke-coverage.mjs';

// Discovery only. Does not start a web server, browser or game account.
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const discover = args => {
    const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', ...args,
        '--list', '--reporter=json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error(`Browser discovery failed: ${result.error?.message || result.stderr}`);
    return discoveredCaseIdentities(JSON.parse(result.stdout));
};
const baseline = discover(['test', ...browserSmokeBaselineFiles(manifest)]);
const groups = [];
for (const shard of [1, 2, 3]) {
    for (const stage of buildBrowserSmokePlan(manifest, shard)) {
        const cases = discover(stage.args);
        groups.push(cases);
        console.log(JSON.stringify({ shard, stage: stage.name, count: cases.length }));
    }
}
console.log(`Exact browser case union verified: ${verifyDiscoveredPartition(baseline, groups)} cases, no omissions or duplicates.`);
