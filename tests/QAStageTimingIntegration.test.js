import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
const finish = script.slice(script.indexOf('\nqa_status=$?'));
// Exact required commands: story readiness strengthens the original complete
// Earth collection stage without dropping any other command or changing order.
const commands = [
    "run_initial_stats",
    "npm run test:e2e:authenticated",
    "npx playwright test tests/e2e/regional-dungeon-gameplay.spec.js tests/e2e/verdant-dungeon-gameplay.spec.js tests/e2e/inventory-quality-of-life.spec.js tests/e2e/dungeon-projectile-wall-gameplay.spec.js tests/e2e/dungeon-movement-wall-gameplay.spec.js tests/e2e/dungeon-ground-area-gameplay.spec.js tests/e2e/dungeon-beam-gameplay.spec.js",
    "run_whip_shape",
    "run_ground_shape",
    "run_purifying_area",
    "run_guardian_roar_area",
    "run_executioner_spin_area",
    "run_guardian_area",
    "run_consecrated_area",
    "run_cleric_area",
    "run_spirit_area",
    "run_whirlwind",
    "run_phone",
    "run_phone_combat",
    "run_party_support",
    "run_phone_inventory",
    "run_equipment_recovery",
    "run_forge_guide",
    "run_fresh_story_ready",
    "run_talent_economy",
    "run_talent_healing",
    "run_talent_duration",
    "run_seraph",
    "run_shield_training",
    "run_entrance_visibility",
    "run_phone_quests",
    "run_phone_build",
    "run_phone_settings",
    "run_phone_adventure",
    "run_dungeon_recovery",
    "run_death_resource_recovery",
    "run_direct_target_classes",
    "npm run test:e2e:movement",
    "run_pvp_cadence",
    "run_animation_classes",
    "run_animation_multiplayer",
    "npx playwright test tests/e2e/nameplate-world.spec.js",
    "run_well_rested",
    "run_forge_socket_appearance"
];
const stages = [
    "initial-stats",
    "authenticated",
    "dungeons-and-inventory",
    "whip-shape",
    "ground-shape",
    "purifying-area",
    "guardian-roar-area",
    "executioner-spin-area",
    "guardian-area",
    "consecrated-area",
    "cleric-area",
    "spirit-area",
    "whirlwind",
    "phone",
    "phone-combat",
    "phone-party",
    "phone-inventory",
    "equipment-recovery",
    "forge-guide",
    "fresh-collection",
    "talent-economy",
    "talent-healing",
    "talent-duration",
    "seraph",
    "shield-training",
    "entrance-visibility",
    "phone-quests",
    "phone-build",
    "phone-settings",
    "phone-adventure",
    "dungeon-recovery",
    "death-resource-recovery",
    "direct-target-classes",
    "movement",
    "pvp-cadence",
    "animation-classes",
    "animation-multiplayer",
    "nameplate-world",
    "well-rested",
    "forge-socket-appearance"
];
const events = (output, prefix) => output.split('\n')
    .filter(line => line.startsWith(prefix)).map(line => line.slice(prefix.length));

function runGate(failureIndex = 0) {
    const mockFunctions = [...new Set(commands.map(command => command.split(' ')[0]))]
        .map(name => `${name}() { record_command ${name} "$@"; }`).join('\n');
    return spawnSync('bash', ['-c', `
        source "$1"
        qa_command_count=0
        qa_failure_index="$2"
        record_command() {
            qa_command_count=$((qa_command_count + 1))
            printf '[qa-command] %s\\n' "$*"
            if [[ "$qa_command_count" == "$qa_failure_index" ]]; then return 19; fi
            return 0
        }
        ${mockFunctions}
        node() { printf '[scan] %s\\n' "$*"; }
        trap 'echo "[cleanup] completed"' EXIT
        set +e
        ${all}
        ${finish}
    `, 'qa-gate', path.resolve('scripts/qa-stage-timing.sh'), String(failureIndex)],
    { encoding: 'utf8', timeout: 5000 });
}

test('full gate retains every required command once, in order, with distinct timings', () => {
    const result = runGate();
    expect(result.status).toBe(0);
    expect(events(result.stdout, '[qa-command] ')).toEqual(commands);
    const timings = events(result.stdout, '[qa-stage] ').map(line => JSON.parse(line));
    expect(timings).toEqual(stages.flatMap(stage => [
        { stage, event: 'start' },
        { stage, event: 'end', status: 0, seconds: expect.any(Number) }
    ]));
    expect(events(result.stdout, '[scan] ')).toEqual(['scripts/sanitize-playwright-artifacts.mjs']);
    expect(result.stdout.trim().endsWith('[cleanup] completed')).toBe(true);
});

test.each(stages.map((stage, index) => [stage, index + 1]))(
    'failure at %s stops later routes, scans artifacts, cleans up and preserves status',
    (stage, failureIndex) => {
        const result = runGate(failureIndex);
        expect(result.status).toBe(19);
        expect(events(result.stdout, '[qa-command] ')).toEqual(commands.slice(0, failureIndex));
        const timings = events(result.stdout, '[qa-stage] ').map(line => JSON.parse(line));
        expect(timings).toHaveLength(failureIndex * 2);
        expect(timings.at(-1)).toMatchObject({ stage, event: 'end', status: 19 });
        expect(events(result.stdout, '[scan] ')).toEqual(['scripts/sanitize-playwright-artifacts.mjs']);
        expect(result.stderr).toContain('Isolated character QA failed.');
        expect(result.stdout.trim().endsWith('[cleanup] completed')).toBe(true);
    }
);

test('helper loading follows runtime preflight and leaves real cleanup registration intact', () => {
    expect(script).toContain('source "${BASH_SOURCE[0]%/*}/qa-stage-timing.sh"');
    expect(script.indexOf('source "${BASH_SOURCE')).toBeGreaterThan(script.indexOf('Missing browser runtime'));
    expect(script).toContain('trap cleanup_isolated_qa EXIT INT TERM');
});
