// Fetch only the next ten archived notes, on explicit request. Versioned paths
// prevent a browser cache from mixing yesterday's archive with today's page.
export function mountPatchNotesPagination(document, fetchPage = globalThis.fetch?.bind(globalThis)) {
    const history = document.getElementById('patch-notes-history');
    const button = document.getElementById('btn-load-more-patch-notes');
    const status = document.getElementById('patch-notes-load-status');
    if (!history || !button || button.dataset.paginationMounted) return;
    const version = history.dataset.notesRelease, pages = Number(history.dataset.notesPages);
    if (!/^\d+\.\d+\.\d+$/.test(version || '') || !Number.isInteger(pages) || pages < 1) {
        button.hidden = true; return;
    }
    button.dataset.paginationMounted = 'true';
    let page = 1, pending = false;
    button.addEventListener('click', async () => {
        if (pending || page > pages) return;
        pending = true; button.disabled = true;
        status.textContent = 'Loading older notes…';
        try {
            const url = new URL(`../../assets/patch-notes/${version}/page-${String(page).padStart(3, '0')}.json`, import.meta.url);
            const response = await fetchPage(url.href);
            if (!response.ok) throw new Error('Archive unavailable');
            const data = await response.json();
            if (data.version !== version || data.page !== page || data.pages !== pages ||
                !Array.isArray(data.entries) || !data.entries.length || data.entries.length > 10) throw new Error('Invalid archive');
            const fragment = document.createDocumentFragment();
            for (const entry of data.entries) {
                if (typeof entry !== 'string') throw new Error('Invalid note');
                const template = document.createElement('template'); template.innerHTML = entry;
                const node = template.content.firstElementChild;
                if (template.content.children.length !== 1 || node?.tagName !== 'DIV' ||
                    node.querySelector('script, iframe, object, embed, style, link')) throw new Error('Invalid note');
                // The earliest notes predate named classes/version attributes.
                const legacyVersion = node.querySelector('h3')?.textContent.match(/(?:Alpha|Patch)\s+(\d+(?:\.\d+)+)/)?.[1];
                if (!node.dataset.version && !legacyVersion) throw new Error('Missing note version');
                node.classList.add('patch-note-entry');
                node.dataset.version ||= legacyVersion;
                for (const element of [node, ...node.querySelectorAll('*')]) for (const attr of [...element.attributes]) {
                    if (/^on/i.test(attr.name) || attr.name === 'srcdoc' ||
                        (['href', 'src'].includes(attr.name) && /^\s*(javascript|data):/i.test(attr.value))) throw new Error('Unsafe note');
                }
                fragment.append(node);
            }
            history.insertBefore(fragment, button.parentElement);
            page++;
            status.textContent = page > pages ? 'All patch notes loaded.' : '';
            button.hidden = page > pages;
        } catch {
            status.textContent = 'Older notes could not load. Please try again.';
        } finally {
            pending = false; button.disabled = false;
        }
    });
}
