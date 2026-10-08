import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Existing historical-content assertions still inspect EVERY original note,
// while pagination tests independently check the small real login document.
export function readIndexWithPatchHistory() {
    const html = readFileSync('index.html', 'utf8');
    const release = html.match(/data-notes-release="([^"]+)"/)?.[1];
    const pages = Number(html.match(/data-notes-pages="(\d+)"/)?.[1] || 0);
    if (!release) return html;
    const older = [];
    for (let page = 1; page <= pages; page++) older.push(...JSON.parse(readFileSync(resolve(
        'assets/patch-notes', release, `page-${String(page).padStart(3, '0')}.json`), 'utf8')).entries);
    return html.replace('<div class="patch-notes-controls">', older.join('\n') + '<div class="patch-notes-controls">');
}
