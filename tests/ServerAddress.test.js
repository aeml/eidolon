import { readFileSync } from 'node:fs';
import {
    productionWebSocketURL,
    legacyWebSocketURL,
    resolveServerAddress
} from '../src/core/serverAddress.js';

describe('production domain migration', () => {
    test('the shipped login defaults to the new secure backend', () => {
        const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
        expect(html).toContain(`id="server-address" value="${productionWebSocketURL}"`);
        expect(resolveServerAddress(productionWebSocketURL, 'play.eidolonrealms.com'))
            .toBe('wss://server.eidolonrealms.com/ws');
    });
    test('the old frontend retains its working backend during cutover', () => {
        expect(resolveServerAddress(productionWebSocketURL, 'eidolon.mendola.tech'))
            .toBe(legacyWebSocketURL);
    });
    test.each(['127.0.0.1', 'localhost', 'play.eidolonrealms.com', 'eidolon.mendola.tech'])(
        'explicit QA overrides are preserved on %s', hostname => {
            expect(resolveServerAddress('ws://127.0.0.1:18580/ws', hostname))
                .toBe('ws://127.0.0.1:18580/ws');
        }
    );
});
