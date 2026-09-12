import { readFileSync } from 'node:fs';

test('the complete gate retains real-server interrupted login recovery with one UI click', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const probe = readFileSync('tests/e2e/auth-inflight-recovery.spec.js', 'utf8');
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-auth-recovery"');
    expect(script).toContain('run_qa_stage auth-recovery run_auth_recovery &&');
    expect(script).toContain('npx playwright test --retries=0 tests/e2e/auth-inflight-recovery.spec.js');
    expect(probe.match(/locator\('#btn-login'\)\.click\(\)/g)).toHaveLength(1);
    expect(probe).toContain('socket.connectToServer()');
    expect(probe).not.toContain('loginAndEnterWorld');
});

test('saved-rune rehearsal repeats the same animation characters twice without retries or changing the full route', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('run_animation_classes --repeat-each=2 --retries=0');
    expect(script).toContain('npx playwright test tests/e2e/animation-gameplay.spec.js "$@" || return $?');
    const reuse = script.split('\n  animation-reuse)')[1].split('\n    ;;')[0];
    expect(reuse).not.toContain('QA_USERNAME_BASE=');
    expect(script).toContain('animations)\n    run_animation_classes');
    expect(script.split('\n  all)')[1].split('\n    ;;')[0]).not.toContain('--repeat-each');
});
test('Teleport and Phase have a two-client no-retry route in the complete native gate', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-teleport-protection,${QA_USERNAME_BASE}-teleport-protection-observer"');
    const all = script.split('\n  all)')[1].split('\n    ;;')[0];
    expect(all).toContain('run_qa_stage entrance-visibility run_entrance_visibility &&\n    run_qa_stage teleport-protection run_teleport_protection &&\n    run_qa_stage phone-quests run_phone_quests');
    expect(script).toContain('teleport-protection)\n    run_teleport_protection');
    expect(script).toContain('npx playwright test --retries=0 tests/e2e/teleport-protection-gameplay.spec.js');
});

test('the full gate includes Focus with independent allowlisted owner and observer', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-focus-mastery,${QA_USERNAME_BASE}-focus-mastery-observer"');
    expect(script).toContain('run_qa_stage focus-mastery run_focus_mastery &&');
    expect(script).toContain('focus-mastery)\n    run_focus_mastery');
    expect(script).toContain('EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-focus-mastery" EIDOLON_E2E_CLASS=Wizard');
    expect(script).toContain('npx playwright test --retries=0 tests/e2e/spell-focus-mastery-gameplay.spec.js');
});

test('the release gate retains native Time Warp with its own allowlisted Wizard', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-time-warp"');
    expect(script).toContain('run_qa_stage time-warp-area run_time_warp_area &&');
    expect(script).toContain('time-warp-area)\n    run_time_warp_area');
    expect(script).toContain('EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-time-warp" EIDOLON_E2E_CLASS=Wizard');
    expect(script).toContain('npx playwright test --retries=0 tests/e2e/time-warp-area-gameplay.spec.js');
});

test('the full gate retains the same four-class practice-duel route as focused QA', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('&&\n    run_qa_stage pvp-cadence run_pvp_cadence &&\n    run_qa_stage animation-classes run_animation_classes');
    expect(script).toContain('pvp-cadence)\n    run_pvp_cadence');
    expect(script).toContain('run_pvp_cadence() {\n  npx playwright test tests/e2e/pvp-cadence-gameplay.spec.js');
});

test('fresh collection allows explicit four-class comparisons while keeping Wizard as the default', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('local fresh_class="${EIDOLON_E2E_FRESH_CLASS:-Wizard}"');
    expect(script).toContain('Wizard|Fighter|Rogue|Cleric) ;;');
    expect(script).toContain('EIDOLON_E2E_CLASS="${fresh_class}"');
});

test('early gear/stat comparison is opt-in and preserves the unprepared release baseline', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const early = readFileSync('tests/e2e/early-earned-preparation.js', 'utf8');
    expect(script).toContain('fresh-collection-prepared)\n    EIDOLON_E2E_PREPARED_COLLECTION=1 run_fresh_collection');
    expect(script).toContain('fresh-collection)\n    run_fresh_collection');
    expect(early).not.toContain('network.send');
    expect(early).not.toContain('page.reload');
    expect(early).toContain("'branch', 'talents', 'unlocked', 'hotbar'");
});

test('the full release gate retains an earned fresh collection and a genuinely fresh retry', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const route = readFileSync('tests/e2e/fresh-opening-gameplay.spec.js', 'utf8');
    expect(script).toContain('&&\n    run_qa_stage forge-guide run_forge_guide &&\n    run_qa_stage fresh-collection run_fresh_story_ready &&\n    run_qa_stage talent-economy run_talent_economy');
    expect(script).toContain('${QA_USERNAME_BASE}-first-grove-retry1');
    expect(route).toContain('credentials.username += `-retry${testInfo.retry}`');
    expect(route).toContain('expect((await readPlayerState(page)).level).toBe(1)');
});

test('talent economy retries cannot reuse purchased ranks', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const probe = readFileSync('tests/e2e/talent-economy-gameplay.spec.js', 'utf8');
    expect(script).toContain('${QA_USERNAME_BASE}-economy-retry1');
    expect(script).toContain('EIDOLON_E2E_ECONOMY_RETRY_PROBE=1 run_talent_economy --retries=1');
    expect(probe).toContain('credentials.username += `-retry${testInfo.retry}`');
    expect(probe).not.toContain('stats.mana >= window.game.player.stats.maxMana');
});

test('anonymous CI retains exact cast aiming and covered-loot pointer regressions', () => {
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/ground-aim.spec.js');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/loot-pointer.spec.js');
});

test('local and CI isolated servers reserve disjoint API/database ports', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const local = Number(script.match(/EIDOLON_ISOLATED_QA_PORT:-(\d+)/)?.[1]);
    const ci = Number(workflow.match(/EIDOLON_ISOLATED_QA_PORT: '(\d+)'/)?.[1]);
    for (const port of [local, ci]) {
        expect(port).toBeGreaterThanOrEqual(1024);
        expect(port + 1).toBeLessThanOrEqual(65535);
    }
    expect(new Set([local, local + 1, ci, ci + 1]).size).toBe(4);
    expect(workflow).toContain("EIDOLON_ISOLATED_QA_NETWORK_MODE: 'host'");
    expect(script).toContain('if [[ "$(uname -s)" == Linux ]]; then\n  qa_default_network_mode=host');
    expect(script).toContain('mongo_bind=--bind_ip=127.0.0.1');
    expect(script).toContain('api_addr="127.0.0.1:${QA_PORT}"');
});

test('phone chat coverage and Purifying retry keep the real player path', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const probe = readFileSync('tests/e2e/purifying-area-gameplay.spec.js', 'utf8');
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(script).toContain('${QA_USERNAME_BASE}-cleanse-retry1');
    expect(script).toContain('EIDOLON_E2E_PURIFYING_RETRY_PROBE=1 run_purifying_area --retries=1');
    expect(probe).toContain('credentials.username += `-retry${testInfo.retry}`');
    expect(probe).toContain("await verifyCast(0, 0, 'high')");
    expect(probe).toContain("await verifyCast(5, 0, 'low')");
    expect(probe).toContain("await verifyCast(5, 5, 'low')");
    expect(probe).toContain("await verifyCast(5, 5, 'high')");
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/mobile-chat-layering.spec.js');
});

test('the full release gate retains Seraph gameplay and rendered fallback checks', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(script).toContain('&&\n    run_qa_stage talent-duration run_talent_duration &&\n    run_qa_stage seraph run_seraph &&');
    expect(script).toContain('${QA_USERNAME_BASE}-seraph-retry1');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/offline-seraph-render.spec.js');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/summon-action-readability.spec.js');
});

test('the full release gate includes saved Guardian Roar training without removing existing area routes', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const probe = readFileSync('tests/e2e/guardian-roar-area-gameplay.spec.js', 'utf8');
    expect(script).toContain('${QA_USERNAME_BASE}-roar-area');
    const untimed = script.replace(/run_qa_stage [a-z0-9-]+ /g, '').replace(/\s+/g, ' ');
    expect(untimed).toContain('&& run_purifying_area && run_guardian_roar_area && run_fortress_mastery && run_executioner_spin_area && run_guardian_area &&');
    expect(script).toContain('guardian-roar-area)\n    run_guardian_roar_area');
    expect(probe).toContain("await verifyCast([0, 0, 0], 15, 'high')");
    expect(probe).toContain("await verifyCast([5, 5, 5], 20.25, 'low')");
    expect(probe).toContain("await verifyCast([5, 5, 5], 20.25, 'high')");
});

test('Executioner Spin area has a saved ordinary-purchase route in the full release gate', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const probe = readFileSync('tests/e2e/executioner-spin-area-gameplay.spec.js', 'utf8');
    expect(script).toContain('${QA_USERNAME_BASE}-spin-area');
    expect(script).toContain('executioner-spin-area)\n    run_executioner_spin_area');
    const untimed = script.replace(/run_qa_stage [a-z0-9-]+ /g, '').replace(/\s+/g, ' ');
    expect(untimed).toContain('&& run_guardian_roar_area && run_fortress_mastery && run_executioner_spin_area && run_guardian_area &&');
    expect(probe).toContain('branch:C');
    expect(probe).toContain("await verifyCast([0, 0, 0], 6, 'high')");
    expect(probe).toContain("await verifyCast([5, 5, 5], 8.1, 'low')");
    expect(probe).toContain("await verifyCast([5, 5, 5], 8.1, 'high')");
});

test('the full release gate retains saved Shield training and hostile absorption', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('&&\n    run_qa_stage seraph run_seraph &&\n    run_qa_stage shield-training run_shield_training &&');
    expect(script).toContain('${QA_USERNAME_BASE}-shield-retry1');
    expect(script).toContain('npx playwright test tests/e2e/shield-training-gameplay.spec.js');
});

test('anonymous CI retains content-sized and long-list phone status coverage', () => {
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/mobile-status-compact.spec.js');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/mobile-status-layout.spec.js');
});

test('the release gate retains rendered entrance cutaways and normal gameplay restoration', () => {
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(commands['test:e2e:anonymous']).toContain('tests/e2e/entrance-visibility.spec.js');
    expect(script).toContain('&&\n    run_qa_stage shield-training run_shield_training &&\n    run_qa_stage entrance-visibility run_entrance_visibility &&');
    expect(script).toContain('${QA_USERNAME_BASE}-sight-retry1');
    expect(script).toContain('EIDOLON_E2E_SCENERY_VISIBILITY=1 npx playwright test tests/e2e/shield-training-gameplay.spec.js');
});
