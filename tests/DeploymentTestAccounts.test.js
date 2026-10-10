import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const script = workflow.split('awk -v value="${qa_usernames}" \'')[1].split("' .env")[0];

test.each(['', 'EIDOLON_QA_USERNAMES=old\n', 'EIDOLON_QA_USERNAMES=old\nEIDOLON_TEST_USERNAMES=old\n'])(
    'deployment explicitly classifies its automation identities without changing other settings (%s)', existing => {
        const result = spawnSync('awk', ['-v', 'value=automation.fixture,automation.fixture-f,secondary.fixture', script], {
            input: `DATABASE_SETTING=preserve\n${existing}ADMIN_SETTING=preserve\n`, encoding: 'utf8'
        });
        expect(result.status).toBe(0);
        const lines = result.stdout.trim().split('\n');
        expect(lines.filter(line => line.startsWith('EIDOLON_TEST_USERNAMES='))).toEqual([
            'EIDOLON_TEST_USERNAMES=automation.fixture,automation.fixture-f,secondary.fixture'
        ]);
        expect(lines.filter(line => line.startsWith('EIDOLON_QA_USERNAMES='))).toEqual([
            'EIDOLON_QA_USERNAMES=automation.fixture,automation.fixture-f,secondary.fixture'
        ]);
        expect(lines).toContain('DATABASE_SETTING=preserve');
        expect(lines).toContain('ADMIN_SETTING=preserve');
    }
);
