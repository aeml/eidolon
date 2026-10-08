import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { mountPatchNotesPagination } from '../src/ui/PatchNotesPagination.js';

const note = version => `<div class="patch-note-entry" data-version="${version}"><h3>${version}</h3></div>`;
const setup = () => {
    document.body.innerHTML = `<div id="patch-notes-history" data-notes-release="1.79.11" data-notes-pages="2">
        ${note('1.79.11')}<div><button id="btn-load-more-patch-notes">Load more notes</button>
        <p id="patch-notes-load-status"></p></div></div>`;
    return document.getElementById('btn-load-more-patch-notes');
};
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('real login contains exactly ten notes and no embedded archived history', () => {
    const html = readFileSync('index.html', 'utf8');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    expect(parsed.querySelectorAll('#patch-notes-history .patch-note-entry')).toHaveLength(10);
    expect(html.length).toBeLessThan(150_000);
    expect(html).not.toContain('data-version="0.22.0"');
});
test('does not fetch before clicking; appends in order, prevents duplicate mounts and ends cleanly', async () => {
    const button = setup(), fetchPage = jest.fn(async () => ({ ok: true,
        json: async () => ({ version: '1.79.11', pages: 2, page: fetchPage.mock.calls.length,
            entries: [note(fetchPage.mock.calls.length === 1 ? '1.79.10' : '1.79.9')] }) }));
    mountPatchNotesPagination(document, fetchPage); mountPatchNotesPagination(document, fetchPage);
    expect(fetchPage).not.toHaveBeenCalled();
    button.click(); button.click(); await settle();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.patch-note-entry')).toHaveLength(2);
    button.click(); await settle();
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(button.hidden).toBe(true);
    expect(document.getElementById('patch-notes-load-status').textContent).toBe('All patch notes loaded.');
});
test('a failed request retries the same page without losing notes', async () => {
    const button = setup(), fetchPage = jest.fn().mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue({ ok: true, json: async () => ({ version: '1.79.11', pages: 2, page: 1, entries: [note('1.79.10')] }) });
    mountPatchNotesPagination(document, fetchPage); button.click(); await settle();
    expect(button.disabled).toBe(false); expect(document.querySelectorAll('.patch-note-entry')).toHaveLength(1);
    button.click(); await settle();
    expect(fetchPage.mock.calls[0][0]).toBe(fetchPage.mock.calls[1][0]);
    expect(document.querySelectorAll('.patch-note-entry')).toHaveLength(2);
});
test('malformed/active archived markup is rejected atomically', async () => {
    const button = setup(), fetchPage = jest.fn(async () => ({ ok: true, json: async () => ({
        version: '1.79.11', pages: 2, page: 1, entries: [note('1.79.10'), '<div class="patch-note-entry" data-version="1"><img onerror="alert(1)"></div>']
    }) }));
    mountPatchNotesPagination(document, fetchPage); button.click(); await settle();
    expect(document.querySelectorAll('.patch-note-entry')).toHaveLength(1); expect(button.disabled).toBe(false);
});

test('all archive pages including the earliest legacy notes load exactly once to the declared total', async () => {
    const parsed = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
    document.body.innerHTML = parsed.getElementById('patch-notes-history').outerHTML;
    const history = document.getElementById('patch-notes-history'), button = document.getElementById('btn-load-more-patch-notes');
    mountPatchNotesPagination(document, async url => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL(url), 'utf8')) }));
    for (let page = 0; page < Number(history.dataset.notesPages); page++) { button.click(); await settle(); }
    expect(history.querySelectorAll('.patch-note-entry')).toHaveLength(Number(history.dataset.notesTotal));
    expect(history.textContent).toContain('Patch 0.01'); expect(history.textContent).toContain('Patch 0.18');
    expect(button.hidden).toBe(true);
});
