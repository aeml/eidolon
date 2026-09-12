import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
test('Earthshaker area owns an allowlisted Fighter account and no-retry standalone route', () => {
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-earthshaker-area"');
    expect(script).toMatch(/run_earthshaker_area\(\) \{[\s\S]*?EIDOLON_E2E_CLASS=Fighter[\s\S]*?npx playwright test --retries=0 tests\/e2e\/earthshaker-area-gameplay.spec.js\n\}/);
    expect(script).toContain('  earthshaker-area)\n    run_earthshaker_area\n    ;;');
});
test('full timing retains existing Whirlwind and runs Earthshaker once before phone coverage', () => {
    const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
    expect(all).toContain('run_qa_stage whirlwind run_whirlwind &&\n    run_qa_stage earthshaker-area run_earthshaker_area &&\n    run_qa_stage whirlwind-area run_whirlwind_area &&\n    run_qa_stage fighter-buff-mastery run_fighter_buff_mastery &&\n    run_qa_stage phone run_phone');
    expect(all.match(/run_earthshaker_area/g)).toHaveLength(1);
});
