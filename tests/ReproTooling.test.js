import { readFileSync, existsSync } from 'fs';

const reproHtmlPath = new URL('../repro.html', import.meta.url).pathname;
const reproJsPath = new URL('../src/repro.js', import.meta.url).pathname;
const dungeonChecklistPath = new URL('../docs/plans/dungeon-manual-qa-checklist.md', import.meta.url).pathname;
const releaseChecklistPath = new URL('../docs/plans/0.21-release-checklist.md', import.meta.url).pathname;

describe('0.21 repro and QA tooling', () => {
    test('repro scene exposes focused QA controls for 0.21 closeout surfaces', () => {
        const html = readFileSync(reproHtmlPath, 'utf8');
        const js = readFileSync(reproJsPath, 'utf8');

        [
            'repro-trigger-telegraph',
            'repro-trigger-loot',
            'repro-trigger-jump',
            'repro-toggle-window',
            'repro-reset-scene'
        ].forEach((controlId) => {
            expect(html).toContain(`id="${controlId}"`);
        });

        expect(js).toContain('triggerTelegraphPreview');
        expect(js).toContain('triggerLootPreview');
        expect(js).toContain('triggerJumpPreview');
        expect(js).toContain('toggleWindowPreview');
        expect(js).toContain('resetPreviewState');
    });

    test('manual QA docs cover the 0.21 closeout surfaces and release checklist exists', () => {
        const checklist = readFileSync(dungeonChecklistPath, 'utf8').toLowerCase();

        expect(checklist).toContain('login/start flow basics');
        expect(checklist).toContain('dungeon enter/exit');
        expect(checklist).toContain('objective/minimap/room-state behavior');
        expect(checklist).toContain('menu close interactions');
        expect(checklist).toContain('auto-loot/inventory behavior');
        expect(checklist).toContain('combat readability surfaces changed in 0.21');
        expect(existsSync(releaseChecklistPath)).toBe(true);
    });
});
