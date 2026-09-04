import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function javascriptFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return javascriptFiles(target);
        return entry.name.endsWith('.js') ? [target] : [];
    });
}

describe('client/server action protocol audit', () => {
    test('every statically named NetworkManager action has a server admission policy', () => {
        const clientTypes = new Set();
        for (const filename of javascriptFiles(path.join(root, 'src'))) {
            const source = fs.readFileSync(filename, 'utf8');
            for (const match of source.matchAll(/\.network\.send\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
                clientTypes.add(match[1]);
            }
            for (const match of source.matchAll(/this\.network\.send\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
                clientTypes.add(match[1]);
            }
        }

        const constantsSource = fs.readFileSync(path.join(root, 'server/protocol_types.go'), 'utf8');
        const policySource = fs.readFileSync(path.join(root, 'server/protocol_policy.go'), 'utf8');
        const constantsByValue = new Map(
            [...constantsSource.matchAll(/(Msg[A-Za-z0-9]+)\s*=\s*"([^"]+)"/g)].map((match) => [match[2], match[1]])
        );
        expect(clientTypes.size).toBeGreaterThan(50);
        for (const type of clientTypes) {
            const constant = constantsByValue.get(type);
            expect(constant).toBeDefined();
            expect(policySource).toMatch(new RegExp(`\\b${constant}:\\s+policy\\(`));
        }
    });
});
