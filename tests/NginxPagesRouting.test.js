import fs from 'node:fs';
import path from 'node:path';

const configuration = fs.readFileSync(path.resolve('server/deploy/nginx/eidolonrealms-http.conf'), 'utf8');
const frontend = configuration.split('server_name server.eidolonrealms.com;')[0];

describe('Pages proxy configuration for the IPv4-only origin host', () => {
    test('applies the runtime resolver to a fixed upstream, preserving asset paths and release queries', () => {
        expect(frontend).toContain('resolver 127.0.0.53 valid=60s ipv6=off;');
        expect(frontend).toContain('resolver_timeout 5s;');
        expect(frontend).toContain('set $eidolon_pages_host aeml.github.io;');
        expect(frontend).toContain('proxy_pass https://$eidolon_pages_host$request_uri;');
        expect(frontend).not.toContain('proxy_pass https://aeml.github.io;');
    });

    test('retains Pages custom-domain routing and upstream TLS SNI', () => {
        expect(frontend).toContain('proxy_set_header Host play.eidolonrealms.com;');
        expect(frontend).toContain('proxy_ssl_server_name on;');
        expect(frontend).toContain('proxy_ssl_name aeml.github.io;');
    });

    test('keeps the backend on loopback with WebSocket upgrades', () => {
        const backend = configuration.split('server_name server.eidolonrealms.com;')[1];
        expect(backend).toContain('proxy_pass http://127.0.0.1:18082;');
        expect(backend).toContain('proxy_set_header Upgrade $http_upgrade;');
        expect(backend).not.toContain('resolver ');
    });
});
