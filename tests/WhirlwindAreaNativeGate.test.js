import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
test('trained Whirlwind owns an allowlisted Fighter account and non-retrying scoped route', () => {
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-whirlwind-area"');
    expect(script).toMatch(/run_whirlwind_area\(\) \{[\s\S]*?EIDOLON_E2E_CLASS=Fighter[\s\S]*?npx playwright test --retries=0 tests\/e2e\/whirlwind-area-gameplay.spec.js\n\}/);
    expect(script).toContain('  whirlwind-area)\n    run_whirlwind_area\n    ;;');
});
test('full timed acceptance keeps existing duration coverage and runs area purchases once afterward', () => {
    const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
    expect(all).toContain('run_qa_stage whirlwind run_whirlwind &&\n    run_qa_stage earthshaker-area run_earthshaker_area &&\n    run_qa_stage whirlwind-area run_whirlwind_area &&\n    run_qa_stage fighter-buff-mastery run_fighter_buff_mastery &&\n    run_qa_stage phone run_phone');
    expect(all.match(/run_whirlwind_area/g)).toHaveLength(1);
});

test('Whirlwind purchases select the specialization that actually unlocks it', () => {
    const route = readFileSync('tests/e2e/whirlwind-area-gameplay.spec.js', 'utf8');
    expect(route).toContain('[data-build-action="branch:A"]');
    expect(route).not.toContain('[data-build-action="branch:B"]');
});
