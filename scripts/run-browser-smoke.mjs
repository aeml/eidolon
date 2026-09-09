import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildBrowserSmokePlan, runBrowserSmokePlan } from './browser-smoke-plan.mjs';

const [shardArgument, mode, ...extra] = process.argv.slice(2);
if (!/^[123]$/.test(shardArgument || '') || extra.length || (mode && mode !== '--plan')) {
    throw new Error('Usage: node scripts/run-browser-smoke.mjs <1|2|3> [--plan]');
}
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const plan = buildBrowserSmokePlan(manifest, Number(shardArgument));
if (mode === '--plan') {
    console.log(JSON.stringify(plan, null, 2));
} else {
    process.exitCode = runBrowserSmokePlan(plan, stage => {
        const started = Date.now();
        console.log(`[browser-stage] ${stage.name}: start`);
        const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', ...stage.args],
            { stdio: 'inherit', env: { ...process.env, ...stage.env } });
        console.log(`[browser-stage] ${stage.name}: status=${result.status ?? 'interrupted'} seconds=${((Date.now() - started) / 1000).toFixed(1)}`);
        if (result.error) console.error(result.error.message);
        return result;
    });
}
