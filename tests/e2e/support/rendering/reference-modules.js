import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { repositoryPath } from '../../../support/repositoryPaths.js';

const require = createRequire(import.meta.url);
let linter;

export function createReferenceModules(repository) {
    const trees = new Map();
    let currentFiles;
    const sourceFiles = () => currentFiles ||= readdirSync(path.join(repository, 'src'), { recursive: true })
        .filter(name => name.endsWith('.js')).map(name => `src/${name.split(path.sep).join('/')}`);
    function matchingSource(files, requested) {
        if (files.includes(requested)) return requested;
        const basename = path.posix.basename(requested), area = requested.split('/').slice(0, 2).join('/') + '/';
        const matches = files.filter(name => path.posix.basename(name) === basename);
        const owned = matches.filter(name => name.startsWith(area));
        const candidates = owned.length ? owned : matches;
        if (candidates.length > 1) throw Error(`Ambiguous reference module: ${requested}`);
        return candidates[0];
    }
    function referenceObject(object) {
        const separator = object.indexOf(':');
        const revision = object.slice(0, separator), requested = object.slice(separator + 1);
        if (separator < 1 || !revision || !requested.startsWith('src/') || !requested.endsWith('.js'))
            throw Error(`Expected a pinned source module: ${object}`);
        if (!trees.has(revision)) trees.set(revision, execFileSync('git', ['ls-tree', '-r', '--name-only', revision, '--', 'src'],
            { cwd: repository, encoding: 'utf8' }).trim().split('\n').filter(name => name.startsWith('src/') && name.endsWith('.js')));
        const file = matchingSource(trees.get(revision), requested);
        if (!file) throw Error(`Missing pinned source module: ${object}`);
        return { revision, file };
    }

    // Resolve the file in its recorded tree, rather than asking an old commit for
    // today's directory layout. Its source bytes and algorithm remain unchanged.
    function readReferenceSource(object) {
        const { revision, file } = referenceObject(object);
        return execFileSync('git', ['show', `${revision}:${file}`], { cwd: repository, encoding: 'utf8' });
    }

    function currentReferencePath(object) {
        const { file } = referenceObject(object);
        const current = matchingSource(sourceFiles(), file);
        if (!current) throw Error(`Missing current source module: ${file}`);
        return '/' + current;
    }

    function rebaseReferenceImports(source, object, baseURL) {
        const file = object.includes(':') ? referenceObject(object).file : object;
        const rewrite = specifier => {
            if (!/^(?:\.|\/src\/|https?:)/.test(specifier)) return specifier;
            if (/^https?:/.test(specifier) && (!baseURL || new URL(specifier).origin !== new URL(baseURL).origin)) return specifier;
            const target = new URL(specifier, `https://reference.invalid/${file}`);
            if (!target.pathname.startsWith('/src/')) {
                if (!specifier.startsWith('.')) return specifier;
                const resource = target.pathname + target.search + target.hash;
                return baseURL ? new URL(resource, baseURL).href : resource;
            }
            // Missing physical names may be deliberate test-only Reference modules.
            // Keep their original namespace; ambiguity never selects a different file.
            const current = matchingSource(sourceFiles(), target.pathname.slice(1));
            const pathname = '/' + (current || target.pathname.slice(1)) + target.search + target.hash;
            return baseURL ? new URL(pathname, baseURL).href : pathname;
        };
        linter ||= new (require('eslint').Linter)();
        const messages = linter.verify(source, [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } }]);
        const fatal = messages.find(message => message.fatal);
        if (fatal) throw Error(`Cannot parse reference ${object}: ${fatal.message}`);
        const edits = [];
        const visit = node => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(visit); return; }
            if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) &&
                node.source?.type === 'Literal' && typeof node.source.value === 'string') {
                const value = rewrite(node.source.value);
                if (value !== node.source.value) edits.push({ range: node.source.range, value: JSON.stringify(value) });
            }
            for (const [key, value] of Object.entries(node)) if (!['parent', 'loc', 'tokens', 'comments'].includes(key)) visit(value);
        };
        visit(linter.getSourceCode().ast);
        for (const edit of edits.sort((a, b) => b.range[0] - a.range[0]))
            source = source.slice(0, edit.range[0]) + edit.value + source.slice(edit.range[1]);
        return source;
    }
    return { readReferenceSource, rebaseReferenceImports, currentReferencePath };
}

export const { readReferenceSource, rebaseReferenceImports, currentReferencePath } = createReferenceModules(repositoryPath());
