import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('shows alpha 0.21.3 on the login screen', () => {
        expect(indexHtml).toContain('Alpha 0.21.3');
    });

    test('includes player-facing patch 0.21.3 notes', () => {
        expect(indexHtml).toContain('Patch 0.21.3');
        expect(indexHtml).toContain('Cached version');
        expect(indexHtml).toContain('Update Cached Assets');
        expect(indexHtml).toContain('Current');
        expect(indexHtml).toContain('Outdated');
    });
});
