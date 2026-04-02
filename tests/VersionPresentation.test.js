import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('shows alpha 0.21.2 on the login screen', () => {
        expect(indexHtml).toContain('Alpha 0.21.2');
    });

    test('includes player-facing patch 0.21.2 notes', () => {
        expect(indexHtml).toContain('Patch 0.21.2');
        expect(indexHtml).toContain('Download Recommended Assets');
        expect(indexHtml).toContain('Environment Textures');
        expect(indexHtml).toContain('packs need refresh');
        expect(indexHtml).toContain('Last synced asset version');
    });
});
