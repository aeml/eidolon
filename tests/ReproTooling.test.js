import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'node:url';

const reproHtmlPath = fileURLToPath(new URL('../repro.html', import.meta.url));
const reproJsPath = fileURLToPath(new URL('../src/repro.js', import.meta.url));
const dungeonChecklistPath = fileURLToPath(new URL('../docs/plans/dungeon-manual-qa-checklist.md', import.meta.url));
const sandboxSmokePath = fileURLToPath(new URL('../docs/plans/2026-04-30-0-33-2-repro-sandbox-smoke.md', import.meta.url));
const releaseChecklistPath = fileURLToPath(new URL('../docs/plans/0.21-release-checklist.md', import.meta.url));
const retentionChecklistPath = fileURLToPath(new URL('../docs/plans/2026-04-19-0-25-retention-closeout-qa.md', import.meta.url));

describe('repro and QA tooling', () => {
    test('repro scene exposes focused QA controls for rendering movement VFX menus and dungeon pacing', () => {
        const html = readFileSync(reproHtmlPath, 'utf8');
        const js = readFileSync(reproJsPath, 'utf8');

        [
            'repro-trigger-telegraph',
            'repro-trigger-loot',
            'repro-trigger-jump',
            'repro-trigger-room-verdant',
            'repro-trigger-room-abyss',
            'repro-trigger-room-molten',
            'repro-trigger-room-tempest',
            'repro-toggle-window',
            'repro-reset-scene'
        ].forEach((controlId) => {
            expect(html).toContain(`id="${controlId}"`);
        });

        expect(js).toContain('triggerTelegraphPreview');
        expect(js).toContain('triggerLootPreview');
        expect(js).toContain('triggerJumpPreview');
        expect(js).toContain('triggerDungeonRoomPreview');
        expect(js).toContain('boss_approach');
        expect(js).toContain('dungeonPreviewThemes');
        expect(js).toContain('toggleWindowPreview');
        expect(js).toContain('resetPreviewState');
    });

    test('repro route stays isolated from normal login and live gameplay boot', () => {
        const html = readFileSync(reproHtmlPath, 'utf8');
        const js = readFileSync(reproJsPath, 'utf8');

        expect(html).toContain('<script type="module" src="./src/repro.js"></script>');
        expect(html).not.toContain('./src/main.js');
        expect(js).toContain("import { RenderSystem } from './core/RenderSystem.js'");
        expect(js).not.toContain('new GameEngine');
        expect(js).not.toContain('NetworkManager');
        expect(js).not.toContain('WebSocket');
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

    test('retention closeout doc covers the real 0.25 sticky-loop QA route', () => {
        const checklist = readFileSync(retentionChecklistPath, 'utf8').toLowerCase();

        expect(checklist).toContain('repeatable ladder');
        expect(checklist).toContain('et countdown');
        expect(checklist).toContain('party reward-sharing and bonus visibility');
        expect(checklist).toContain('dungeon rerun ladder');
        expect(checklist).toContain('trading house browse/list/collect flow');
        expect(checklist).toContain('no weekly system exists yet');
    });

    test('0.33.2 sandbox smoke workflow documents deterministic repro usage', () => {
        const checklist = readFileSync(sandboxSmokePath, 'utf8').toLowerCase();

        expect(checklist).toContain('repro.html');
        expect(checklist).toContain('deterministic sandbox');
        expect(checklist).toContain('rendering');
        expect(checklist).toContain('movement');
        expect(checklist).toContain('vfx');
        expect(checklist).toContain('menu');
        expect(checklist).toContain('boss_approach');
        expect(checklist).toContain('does not boot normal login');
    });
});
