import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const native = workflow.split('  predeploy-character:\n')[1].split('\n  release-inputs:')[0];
const step = name => native.split(`      - name: ${name}\n`)[1]?.split('\n      - name:')[0];

test.each([
    ['Run deterministic High/Low animation gallery', 'animation-gallery'],
    ['Run required native High regional quality-switch coverage', 'regional-quality'],
    ['Run focused level-up and sanctuary presentation', 'celebration'],
    ['Verify delivered class bodies and fitted equipment', 'authored-equipment']
])('%s preserves both images and report outside the rolling smoke directories', (name, folder) => {
    const body = step(name);
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
