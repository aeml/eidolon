import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const catalogs = new Map();

// Source identity stays explicit while feature directories can be reorganized.
// Ambiguous basenames fail instead of silently inspecting a different module.
function locate(directory, name) {
    const base = path.join(root, directory);
    if (name.includes('/')) {
        const target = path.resolve(base, name);
        if (!target.startsWith(base + path.sep) || !statSync(target).isFile())
            throw new Error(`Invalid source file: ${directory}/${name}`);
        return target;
    }
    if (!catalogs.has(base)) {
        const files = new Map();
        const visit = directory => {
            for (const entry of readdirSync(directory, { withFileTypes: true })) {
                const target = path.join(directory, entry.name);
                if (entry.isDirectory()) visit(target);
                else if (entry.isFile()) files.set(entry.name, [...(files.get(entry.name) || []), target]);
            }
        };
        visit(base);
        catalogs.set(base, files);
    }
    const matches = catalogs.get(base).get(name) || [];
    if (matches.length !== 1) throw new Error(`Expected one ${directory} source file named ${name}; found ${matches.length}`);
    return matches[0];
}

export function clientSourcePath(area, name) {
    return locate(`src/${area}`, name);
}

export function browserTestSourcePath(name) {
    return locate('tests/e2e', name);
}

export function repositoryPath(...parts) {
    return path.join(root, ...parts);
}

export function browserTestRepositoryPath(name) {
    return path.relative(root, browserTestSourcePath(name)).split(path.sep).join('/');
}
