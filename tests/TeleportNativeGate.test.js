import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');

test('Teleport native route keeps owner and observer explicitly allowlisted', () => {
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-teleport-protection,${QA_USERNAME_BASE}-teleport-protection-observer"');
    expect(script).toMatch(/run_teleport_protection\(\) \{[\s\S]*?EIDOLON_E2E_CLASS=Wizard[\s\S]*?npx playwright test --retries=0 tests\/e2e\/teleport-protection-gameplay.spec.js\n\}/);
    expect(script).toContain('  teleport-protection)\n    run_teleport_protection\n    ;;');
});

test('full timed gate runs Teleport after entrance visibility and preserves recovery suffix', () => {
    const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
    expect(all).toContain('run_qa_stage entrance-visibility run_entrance_visibility &&\n    run_qa_stage teleport-protection run_teleport_protection &&\n    run_qa_stage phone-quests run_phone_quests');
    expect(all.match(/run_teleport_protection/g)).toHaveLength(1);
    expect(all.trim()).toMatch(/run_qa_stage well-rested run_well_rested &&\s+run_qa_stage forge-socket-appearance run_forge_socket_appearance$/);
});
