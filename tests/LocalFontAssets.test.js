import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

test('bundled Cinzel bytes match their pinned source and retain licensing', () => {
    const bytes = readFileSync('assets/fonts/Cinzel-Variable.ttf');
    const digest = createHash('sha256').update(bytes).digest('hex');
    expect(digest).toBe('f4d83d34d1f6c741193e4acf4b3dff9531e5a67b6aa65228d00a7db72a4e0f34');
    expect(bytes.readUInt32BE(0)).toBe(0x00010000);
    expect(bytes.length).toBe(125468);
    const source = readFileSync('assets/fonts/SOURCE.txt', 'utf8');
    expect(source).toContain(digest);
    expect(source).toContain('3dd78844021e948ceb633d1dcee3f7885561b5d9');
    const license = readFileSync('assets/fonts/OFL.txt', 'utf8');
    expect(license).toContain('Copyright 2020 The Cinzel Project Authors');
    expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(license).toContain('OTHER DEALINGS IN THE FONT SOFTWARE.');
});

test('game typography is first-party and the DNS outage seam stays in required browser coverage', () => {
    const html = readFileSync('index.html', 'utf8');
    const styles = readFileSync('src/styles/variables.css', 'utf8');
    expect(html).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    expect(html).toContain('href="./assets/fonts/Cinzel-Variable.ttf" as="font" type="font/ttf" crossorigin');
    expect(styles).toMatch(/font-family:\s*'Cinzel'/);
    expect(styles).toMatch(/font-weight:\s*400 900/);
    expect(styles).toMatch(/font-display:\s*swap/);
    expect(styles).toContain("../../assets/fonts/Cinzel-Variable.ttf");
    const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(scripts['test:e2e:interface'].match(/tests\/e2e\/local-fonts\.spec\.js/g)).toHaveLength(1);
    expect(readFileSync('scripts/serve-static.mjs', 'utf8')).toContain("['.ttf', 'font/ttf']");
});
