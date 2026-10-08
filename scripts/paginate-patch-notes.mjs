import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { execFileSync } from 'node:child_process';

// Mechanical migration/repagination: retain each original entry's exact source.
// Add new release notes at the top of index.html, then run this script again.
const root = resolve(process.argv[2] || '.');
const file = resolve(root, 'index.html'), html = readFileSync(file, 'utf8');
const dom = new JSDOM(html, { includeNodeLocations: true });
const history = dom.window.document.getElementById('patch-notes-history');
if (!history) throw new Error('Patch history is missing');
const location = dom.nodeLocation(history);
let entries = [...history.children].filter(node => !node.classList.contains('patch-notes-controls')).map(node => {
    const span = dom.nodeLocation(node);
    return html.slice(span.startOffset, span.endOffset);
});
const priorVersion = history.dataset.notesRelease;
if (process.argv.includes('--recover-full-head')) {
    const original = execFileSync('git', ['show', 'HEAD:index.html'], { cwd: root, encoding: 'utf8' });
    const originalDOM = new JSDOM(original, { includeNodeLocations: true });
    const originalHistory = originalDOM.window.document.getElementById('patch-notes-history');
    if (originalHistory.dataset.notesRelease) throw new Error('Recovery requires an unpaginated HEAD');
    const latest = new Map([...history.querySelectorAll('.patch-note-entry')].map(node =>
        [node.dataset.version, html.slice(dom.nodeLocation(node).startOffset, dom.nodeLocation(node).endOffset)]));
    entries = [...originalHistory.children].map(node => {
        const span = originalDOM.nodeLocation(node);
        return latest.get(node.dataset.version) || original.slice(span.startOffset, span.endOffset);
    });
    originalDOM.window.close();
} else if (priorVersion) for (let page = 1; page <= Number(history.dataset.notesPages); page++) {
    entries.push(...JSON.parse(readFileSync(resolve(root,
        `assets/patch-notes/${priorVersion}/page-${String(page).padStart(3, '0')}.json`), 'utf8')).entries);
}
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
const pages = Math.ceil(Math.max(0, entries.length - 10) / 10);
const directory = resolve(root, 'assets/patch-notes', version);
mkdirSync(directory, { recursive: true });
for (let page = 1; page <= pages; page++) writeFileSync(resolve(directory,
    `page-${String(page).padStart(3, '0')}.json`), JSON.stringify({
        version, page, pages, total: entries.length,
        entries: entries.slice(page * 10, (page + 1) * 10)
    }) + '\n');
const opening = html.slice(location.startTag.startOffset, location.startTag.endOffset)
    .replace(/ data-notes-(release|pages|total)="[^"]*"/g, '').replace(/>$/,
        ` data-notes-release="${version}" data-notes-pages="${pages}" data-notes-total="${entries.length}">`);
const controls = `
                <div class="patch-notes-controls">
                    <button id="btn-load-more-patch-notes" class="menu-btn" type="button"${pages ? '' : ' hidden'}>Load more notes</button>
                    <p id="patch-notes-load-status" role="status" aria-live="polite"></p>
                </div>
            `;
writeFileSync(file, html.slice(0, location.startTag.startOffset) + opening + '\n'
    + entries.slice(0, 10).map(entry => '                ' + entry).join('\n')
    + controls + html.slice(location.endTag.startOffset));
dom.window.close();
console.log(`Retained ${entries.length} exact entries; initial10 / ${pages} lazy pages.`);
