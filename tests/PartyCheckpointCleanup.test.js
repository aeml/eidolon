import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const source = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
const capture = source.slice(source.indexOf('capture_party_qa_checkpoint() {'), source.indexOf('\ncleanup_isolated_qa() {'));

test.each([
    ['party-dungeon', 'true', '', 0, true],
    ['smoke', 'true', '', 0, false],
    ['party-dungeon', 'false', '', 0, false],
    ['party-dungeon', 'true', 'stop', 1, false],
    ['party-dungeon', 'true', 'exec', 1, false],
    ['party-dungeon', 'true', 'cp', 1, false]
])('private checkpoint is bounded and once-only: %s/%s/%s', (route, created, fail, status, saved) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'eidolon-checkpoint-test-'));
    try {
        const script = `
            set -uo pipefail
            QA_RUN_ID=checkpoint-test
            API_CONTAINER=eidolon-isolated-qa-api-checkpoint-test
            MONGO_CONTAINER=eidolon-isolated-qa-mongo-checkpoint-test
            mongo_port=18286
            api_created="$QA_TEST_CREATED"
            party_checkpoint_attempted=false
            calls=0
            mktemp() { printf '%s' "$QA_TEST_DIR"; }
            docker() {
                calls=$((calls + 1))
                if [[ "$1" == "$QA_TEST_FAIL" ]]; then return 1; fi
                case "$1" in
                    stop) [[ "$4" == "$API_CONTAINER" ]] ;;
                    exec) [[ "$2" == "$MONGO_CONTAINER" ]] ;;
                    cp) [[ "$2" == "$MONGO_CONTAINER:/tmp/party-checkpoint.archive.gz" ]] || return 1
                        printf 'private fixture data' | gzip > "$3" ;;
                    *) return 1 ;;
                esac
            }
            ${capture}
            if capture_party_qa_checkpoint; then result=0; else result=$?; fi
            previous_calls=$calls
            capture_party_qa_checkpoint
            [[ "$calls" == "$previous_calls" ]] || exit 99
            echo "calls=$calls"
            exit "$result"
        `;
        const result = spawnSync('bash', ['-c', script], { encoding: 'utf8', timeout: 5000,
            env: { ...process.env, EIDOLON_ISOLATED_QA_ROUTE: route, QA_TEST_CREATED: created,
                QA_TEST_FAIL: fail, QA_TEST_DIR: directory } });
        expect(result.status).toBe(status);
        const file = path.join(directory, 'save.archive.gz');
        expect(existsSync(file)).toBe(saved);
        if (saved) {
            expect(statSync(file).mode & 0o777).toBe(0o600);
            expect(statSync(directory).mode & 0o777).toBe(0o700);
            expect(result.stdout).toContain('outside uploaded artifacts');
            expect(result.stdout).toContain('calls=3');
        } else if (!fail) expect(result.stdout).toContain('calls=0');
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('checkpoint attempt precedes owned container removal, including signal cleanup', () => {
    const cleanup = source.slice(source.indexOf('cleanup_isolated_qa() {'), source.indexOf('if ! [[ "${QA_PORT}"'));
    expect(cleanup.indexOf('capture_party_qa_checkpoint')).toBeLessThan(cleanup.indexOf('docker container rm'));
    expect(source).toContain('trap cleanup_isolated_qa EXIT INT TERM');
});
