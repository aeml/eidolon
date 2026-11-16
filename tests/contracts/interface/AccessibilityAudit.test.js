import fs from 'node:fs';

describe('Alpha 1.0 accessibility audit', () => {
    const html = fs.readFileSync(`${process.cwd()}/index.html`, 'utf8');
    const css = fs.readFileSync(`${process.cwd()}/src/styles/accessibility.css`, 'utf8');

    test('HUD menu actions are native keyboard-operable buttons', () => {
        for (const id of ['map', 'social', 'pvp', 'inventory', 'character', 'quest', 'skills']) {
            expect(html).toMatch(new RegExp(`<button[^>]+id="btn-menu-${id}"`));
        }
    });

    test('live communication and invite surfaces expose semantics', () => {
        expect(html).toContain('id="chat-messages" role="log" aria-live="polite"');
        expect(html).toContain('id="party-request-modal" class="party-request-modal" role="dialog" aria-modal="true"');
        expect(html).toContain('id="party-invite-input" class="party-panel__invite-input" placeholder="Player Name" aria-label=');
    });

    test('shared styles preserve focus, reduced-motion, and forced-color modes', () => {
        expect(css).toContain(':focus-visible');
        expect(css).toContain('prefers-reduced-motion: reduce');
        expect(css).toContain('forced-colors: active');
    });
});
