import { spawnSync } from 'node:child_process';
import { assessDependencyAudit } from './dependency-audit-policy.mjs';

const result = spawnSync('npm', ['audit', '--json', '--audit-level=low'], {
    encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 8 * 1024 * 1024
});
if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit failed: ${result.error?.message || result.stderr || result.signal || result.status}`);
}
const assessment = assessDependencyAudit(JSON.parse(result.stdout));
for (const advisory of assessment.rejected) console.log(`Rejected CVE-2026-93753 (2026-11-02): ${advisory}`);
for (const advisory of assessment.active) console.error(`${advisory.severity}: ${advisory.name}: ${advisory.title} (${advisory.url})`);
console.log(`Dependency audit: ${assessment.active.length} active source advisories; ${assessment.rejected.length} rejected.`);
process.exitCode = assessment.active.length ? 1 : 0;
