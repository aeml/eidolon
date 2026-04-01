import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('shows alpha 0.21.1 on the login screen', () => {
        expect(indexHtml).toContain('Alpha 0.21.1');
    });

    test('includes player-facing patch 0.21.1 notes', () => {
        expect(indexHtml).toContain('Patch 0.21.1');
        expect(indexHtml).toContain('Combat readability and dungeon guidance');
        expect(indexHtml).toContain('Keep Assets on This Device');
    });
});
