import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'node:url';

const reproHtmlPath = fileURLToPath(new URL('../repro.html', import.meta.url));
const reproJsPath = fileURLToPath(new URL('../src/repro.js', import.meta.url));
const dungeonChecklistPath = fileURLToPath(new URL('../docs/plans/dungeon-manual-qa-checklist.md', import.meta.url));
const releaseChecklistPath = fileURLToPath(new URL('../docs/plans/0.21-release-checklist.md', import.meta.url));

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
