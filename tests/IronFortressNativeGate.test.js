import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
test('Iron Fortress owns an allowlisted Fighter account and non-retrying scoped route', () => {
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-fortress-mastery"');
    expect(script).toMatch(/run_fortress_mastery\(\) \{[\s\S]*?EIDOLON_E2E_CLASS=Fighter[\s\S]*?npx playwright test --retries=0 tests\/e2e\/iron-fortress-mastery-gameplay.spec.js\n\}/);
    expect(script).toContain('  fortress-mastery)\n    run_fortress_mastery\n    ;;');
});
test('full timed acceptance runs the Mastery once after Guardian Roar', () => {
    const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
    expect(all).toContain('run_qa_stage guardian-roar-area run_guardian_roar_area &&\n    run_qa_stage fortress-mastery run_fortress_mastery &&\n    run_qa_stage executioner-spin-area run_executioner_spin_area');
    expect(all.match(/run_fortress_mastery/g)).toHaveLength(1);
});
