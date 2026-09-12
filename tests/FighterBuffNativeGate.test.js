import { readFileSync } from 'node:fs';
const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
test('damage buffs own a non-retrying, allowlisted Fighter route enrolled once in full acceptance', () => {
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-fighter-buff-mastery"');
    expect(script).toMatch(/run_fighter_buff_mastery\(\) \{[\s\S]*?EIDOLON_E2E_CLASS=Fighter[\s\S]*?npx playwright test --retries=0 tests\/e2e\/fighter-buff-mastery-gameplay.spec.js\n\}/);
    expect(script).toContain('  fighter-buff-mastery)\n    run_fighter_buff_mastery\n    ;;');
    const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
    expect(all.match(/run_fighter_buff_mastery/g)).toHaveLength(1);
});
