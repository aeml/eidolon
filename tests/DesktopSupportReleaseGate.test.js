import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const wrapper = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
const helper = name => wrapper.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'))?.[0] || '';

test.each([0, 23])('desktop support gate preserves exit %i and isolated opt-in', status => {
    const result = spawnSync('bash', ['-c', `
        QA_USERNAME_BASE=disposable
        npx() { printf '%s\\n' "$EIDOLON_E2E_USERNAME" "$EIDOLON_E2E_CLASS" "$EIDOLON_E2E_DESKTOP_SUPPORT" "$EIDOLON_E2E_REGISTER" "$*"; return ${status}; }
        ${helper('run_desktop_support')}
        run_desktop_support
    `], { encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(status);
    expect(result.stdout.split('\n')).toEqual(['disposable-desktop-support', 'Cleric', '1', '1',
        'playwright test --retries=0 --output=test-results/desktop-support tests/e2e/desktop-party-support.spec.js', '']);
});

test.each([[0, 0, 0, true], [7, 0, 7, false], [0, 9, 9, true]])('party support keeps phone and desktop failure gates (%i/%i)', (phone, desktop, exit, called) => {
    const result = spawnSync('bash', ['-c', `
        run_phone_party() { return ${phone}; }
        run_desktop_support() { echo desktop; return ${desktop}; }
        ${helper('run_party_support')}
        run_party_support
    `], { encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(exit);
    expect(result.stdout.includes('desktop')).toBe(called);
});

test('full and focused routes require desktop casts without losing the phone gate', () => {
    const all = wrapper.split('\n  all)')[1].split('\n    ;;')[0];
    const untimed = all.replace(/run_qa_stage [a-z0-9-]+ /g, '').replace(/\s+/g, ' ').trim();
    expect(untimed).toContain('run_phone_combat && run_party_support && run_phone_inventory');
    expect(wrapper.split('\n  desktop-support)')[1].split('\n    ;;')[0].trim()).toBe('run_desktop_support');
    expect(wrapper).toContain('${QA_USERNAME_BASE}-desktop-support,${QA_USERNAME_BASE}-desktop-support-ally');
});
