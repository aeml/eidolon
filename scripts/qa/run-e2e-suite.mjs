import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { suiteFiles } from './e2e-suite-catalog.mjs';

// npm run test:e2e:<name> -- <options> keeps Playwright's existing argument order.
// Do not supply defaults here: config, privacy guards and output paths stay owned
// by Playwright and the dedicated QA wrappers.
const [name, ...options] = process.argv.slice(2);
const catalog = JSON.parse(readFileSync(new URL('./e2e-suites.json', import.meta.url), 'utf8'));
const files = suiteFiles(catalog, name);
const cli = fileURLToPath(new URL('../../node_modules/@playwright/test/cli.js', import.meta.url));
const result = spawnSync(process.execPath, [cli, 'test', ...files, ...options], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
