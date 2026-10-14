import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const native = workflow.split('  predeploy-character:\n')[1].split('\n  release-inputs:')[0];
const step = name => native.split(`      - name: ${name}\n`)[1]?.split('\n      - name:')[0];
const evidenceStep = folder => {
    const marker = `PLAYWRIGHT_HTML_OUTPUT_DIR: native-visual-evidence/${folder}/report`;
    const matches = native.split('\n      - name:').filter(body => body.split('\n').some(line => line.trim() === marker));
    expect(matches).toHaveLength(1);
    return matches[0];
};

test.each([
    'animation-gallery',
    'regional-quality',
    'dungeon-outfits',
    'class-rune-effects',
    'celebration',
    'authored-equipment'
])('%s preserves both images and report outside the rolling smoke directories', folder => {
    const body = evidenceStep(folder);
    expect(body).toContain(`PLAYWRIGHT_HTML_OUTPUT_DIR: native-visual-evidence/${folder}/report`);
    expect(body).toContain(`--output=native-visual-evidence/${folder}/results`);
    expect(body).not.toMatch(/\|\|\s*(?:true|:)|continue-on-error/);
    expect(body).toContain('EIDOLON_E2E_BROWSER_PATH: /usr/bin/google-chrome');
});

test('retained evidence is scanned before upload and a scan failure prevents upload', () => {
    const scan = step('Sanitize retained native visual evidence');
    expect(scan).toContain('id: native_visual_sanitize');
    expect(scan).toContain('if: ${{ !cancelled() }}');
    expect(scan).toContain('node scripts/sanitize-playwright-artifacts.mjs native-visual-evidence');
    const upload = step('Upload predeploy character evidence');
    expect(upload).toContain("steps.native_visual_sanitize.outcome == 'success'");
    for (const folder of ['playwright-report/', 'test-results/', 'rest-render-results/', 'native-visual-evidence/']) {
        expect(upload).toContain(folder);
    }
    expect(native.indexOf('Sanitize retained native visual evidence')).toBeLessThan(native.indexOf('Upload predeploy character evidence'));
    expect(readFileSync('.gitignore', 'utf8').split('\n')).toContain('native-visual-evidence/');
});

test('artifact retention does not reduce native coverage or enable optional long tests', () => {
    expect(step('Run required native High regional quality-switch coverage')).toContain('--workers=1 --retries=0 --reporter=line,html');
    expect(step('Run required native High regional quality-switch coverage')).toContain('--grep "high at 1280px quality switches"');
    for (const name of ['Run deterministic High/Low animation gallery', 'Run required Well Rested rendering and GPU lifecycle QA', 'Run disposable full-character gameplay']) {
        expect(step(name)).toContain("if: inputs.full_stabilization == true || vars.EIDOLON_FULL_STABILIZATION == 'true'");
    }
    expect(step('Run focused disposable release smoke')).toContain('EIDOLON_ISOLATED_QA_ROUTE: release-smoke');
});


test('native dungeon and outfit assertions block release independently of hosted functional coverage', () => {
    const body = evidenceStep('dungeon-outfits');
    expect(body).toContain("EIDOLON_E2E_REQUIRE_NATIVE_GPU: '1'");
    expect(body).toContain('--workers=1 --retries=0 --reporter=line,html');
    expect(body).not.toContain('if:');
    for (const file of ['dungeon-entry-ward', 'dungeon-floor-material', 'published-game-bundle', 'additive-effects-render']) expect(body).toContain(`tests/e2e/${file}.spec.js`);
    expect(body).toContain('grounded entry wards|floor weathering|geometry scheduling|immutable worker|elemental floor materials');
    expect(body).toContain('|additive status, cast and contact');
});

test('local visual stages isolate their HTTP server and native browser while backend routes retain connectivity', () => {
    for (const folder of ['animation-gallery', 'regional-quality', 'dungeon-outfits', 'class-rune-effects', 'celebration', 'authored-equipment']) {
        expect(evidenceStep(folder)).toContain("sg render -c 'bash scripts/run-native-visual-qa.sh ");
    }
    for (const name of ['Run required Well Rested rendering and GPU lifecycle QA', 'Run disposable full-character gameplay', 'Run focused disposable release smoke']) {
        expect(step(name)).not.toContain('run-native-visual-qa.sh');
    }
});


test('High class rune rendering is mandatory before release and only deferred on trusted hosted runs', () => {
    const body = evidenceStep('class-rune-effects');
    expect(body).not.toContain('if:');
    expect(body).toContain("EIDOLON_E2E_REQUIRE_NATIVE_GPU: '1'");
    expect(body).toContain("EIDOLON_E2E_NATIVE_COVERAGE_PENDING: 'false'");
    expect(body).toContain('--grep "prepared high paid" --workers=1 --retries=0');
    for (const name of ['wizard', 'rogue', 'cleric']) {
        const path = `tests/e2e/${name}-rune-effects.spec.js`;
        expect(body).toContain(path);
        const source = readFileSync(path, 'utf8');
        expect(source).toContain("test.skip(process.env.EIDOLON_E2E_NATIVE_COVERAGE_PENDING === 'true' && quality === 'high'");
        expect(source).toContain('if (requiresHardwareWebGL())');
    }
});
