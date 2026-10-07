import { readFile } from 'node:fs/promises';
import { assessCohortBudget } from './lib/cohort-budget.mjs';

try {
    if (process.argv.length !== 3) throw new Error('Expected one full-cohort log path');
    const result = assessCohortBudget(await readFile(process.argv[2], 'utf8'));
    console.log(JSON.stringify(result, null, 2));
    if (!result.phaseBudget.passed) process.exitCode = 1;
} catch {
    // A private path, raw log or arbitrary parse error must not be echoed.
    console.error('Full-cohort budget verification unavailable: require a completed original passing cohort and its two valid phase samples.');
    process.exitCode = 1;
}
