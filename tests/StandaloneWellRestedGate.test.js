import { readFileSync } from 'node:fs';

test('focused recovery tail preserves the exact required full-gate suffix', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const all = script.split('\n  all)')[1].split('\n    ;;')[0];
    const tail = script.split('\n  recovery-tail)')[1].split('\n    ;;')[0];
    const sequence = 'run_pvp_cadence && run_animation_classes && run_animation_multiplayer && npx playwright test tests/e2e/nameplate-world.spec.js && run_well_rested && run_forge_socket_appearance';
    expect(all.trim().endsWith(sequence)).toBe(true);
    expect(tail.trim().endsWith(sequence)).toBe(true);
    expect(tail).not.toMatch(/--grep|--retries|\|\| true/);
});

test('standalone recovery adds real earned, expiry and phone-party checks to the full gate', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const all = script.split('\n  all)')[1].split('\n    ;;')[0];
    expect(all).toContain('tests/e2e/nameplate-world.spec.js && run_well_rested');
    expect(script).toContain('well-rested-all)\n    run_well_rested');
    const body = script.split('run_well_rested() {')[1].split('\n}')[0];
    expect(body).toContain('EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-rest" EIDOLON_E2E_CLASS=Wizard');
    expect(body).toContain('EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-rest-party" EIDOLON_E2E_CLASS=Wizard');
    expect(body).toContain('tests/e2e/well-rested-gameplay.spec.js');
    expect(body).toContain('tests/e2e/well-rested-expiry-gameplay.spec.js || return $?');
    expect(body).toContain('tests/e2e/well-rested-party-gameplay.spec.js');
    expect(body.match(/EIDOLON_E2E_REGISTER=1/g)).toHaveLength(2);
    expect(body).not.toContain('--grep');
    expect(body).toContain('--output=test-results/well-rested-journey');
    expect(body).toContain('--output=test-results/well-rested-party');
});
