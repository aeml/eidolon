import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('shows alpha 0.21.4 on the login screen', () => {
        expect(indexHtml).toContain('Alpha 0.21.4');
    });

    test('includes player-facing patch 0.21.4 notes', () => {
        expect(indexHtml).toContain('Patch 0.21.4');
        expect(indexHtml).toContain('Dungeon/menu/game-feel polish');
        expect(indexHtml).toContain('Sharper shadows');
        expect(indexHtml).toContain('camera punch');
    });

    test('preserves a cumulative version-by-version patch notes history', () => {
        expect(indexHtml).toContain('PATCH NOTES');
        expect(indexHtml).toContain('Patch 0.21.4');
        expect(indexHtml).toContain('Patch 0.21.3');
        expect(indexHtml).toContain('Patch 0.19');
        expect(indexHtml).toContain('Patch 0.18');
        expect(indexHtml).toContain('Patch 0.17');
        expect(indexHtml).toContain('Patch 0.01');
    });

    test('keeps a dedicated patch notes history container with release entries', () => {
        expect(indexHtml).toContain('id="patch-notes-history"');
        expect(indexHtml).toContain('class="patch-note-entry"');
        expect(indexHtml).toContain('data-version="0.21.4"');
        expect(indexHtml).toContain('data-version="0.21.3"');
        expect(indexHtml).toContain('data-version="0.19"');
    });
});
