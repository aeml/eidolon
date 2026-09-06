import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const virtualTest = path.join(root, 'server/internal/game/talent_pending_probe_test.go');
if (existsSync(virtualTest)) throw new Error('Refusing to overlay an existing source test');
const temporary = await mkdtemp(path.join(tmpdir(), 'eidolon-talent-consumer-overlay-'));
try {
    const overlay = path.join(temporary, 'overlay.json');
    await writeFile(overlay, JSON.stringify({ Replace: {
        [virtualTest]: path.join(root, 'docs/qa/talent_consumer_probe.go')
    } }));
    console.log('Auditing open talent consumers against actual casts; failures mean work remains. No game source or saved character is modified.');
    const result = spawnSync('go', ['test', '-overlay', overlay, './internal/game', '-run', '^TestPendingTalent', '-count=1'], {
        cwd: path.join(root, 'server'), stdio: 'inherit', timeout: 60_000
    });
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status ?? 1;
} finally {
    // Only the unique directory this process created; it contains overlay JSON.
    await rm(temporary, { recursive: true, force: true });
}
