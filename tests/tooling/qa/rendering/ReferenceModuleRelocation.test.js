import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from '@babel/parser';
import { createReferenceModules } from '../../../e2e/support/rendering/reference-modules.js';

let root, revision;
const original = "import { real } from './Real.js';\nexport const message = \"from './Real.js'\";\nexport const compute = value => real(value) + 1;\n";
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'eidolon-reference-modules-'));
    mkdirSync(path.join(root, 'src/art'), { recursive: true });
    writeFileSync(path.join(root, 'src/art/Real.js'), 'export const real = value => value * 2;\n');
    writeFileSync(path.join(root, 'src/art/Comparison.js'), original);
    git(['init', '--quiet', '--initial-branch=master']);
    git(['add', '.']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'Recorded source']);
    revision = git(['rev-parse', 'HEAD']);
    mkdirSync(path.join(root, 'src/art/foliage'));
    renameSync(path.join(root, 'src/art/Real.js'), path.join(root, 'src/art/foliage/Real.js'));
    renameSync(path.join(root, 'src/art/Comparison.js'), path.join(root, 'src/art/foliage/Comparison.js'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function algorithm(source) {
    const clean = node => {
        if (Array.isArray(node)) return node.map(clean);
        if (!node || typeof node !== 'object') return node;
        const result = Object.fromEntries(Object.entries(node).filter(([key]) => !['start', 'end', 'loc', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)).map(([key, value]) => [key, clean(value)]));
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && result.source) result.source.value = '<module>';
        return result;
    };
    return clean(parse(source, { sourceType: 'module' }));
}

test('today\'s relocated filename reads the byte-exact historical module without deep checkout history', () => {
    const { readReferenceSource } = createReferenceModules(root);
    expect(readReferenceSource(`${revision}:src/art/foliage/Comparison.js`)).toBe(original);
    expect(readReferenceSource('HEAD:src/art/Comparison.js')).toBe(original);
    expect(readFileSync(path.join(root, 'src/art/foliage/Comparison.js'), 'utf8')).toBe(original);
});

test('rebasing changes actual import locations while preserving executable statements and string data', () => {
    const { rebaseReferenceImports } = createReferenceModules(root);
    const result = rebaseReferenceImports(original, `${revision}:src/art/Comparison.js`);
    expect(result).toContain('from "/src/art/foliage/Real.js"');
    expect(result).toContain('message = "from \'./Real.js\'"');
    expect(algorithm(result)).toEqual(algorithm(original));
});

test('virtual comparison modules, bare dependencies and external origins keep their identities', () => {
    const { rebaseReferenceImports } = createReferenceModules(root);
    const source = "import * as THREE from 'three';\nimport { real } from './Real.js?review=1#source';\nimport { old } from './RealReference.js';\nimport { external } from 'https://outside.invalid/src/art/Real.js';";
    const result = rebaseReferenceImports(source, `${revision}:src/art/Comparison.js`);
    expect(result).toContain("from 'three'");
    expect(result).toContain('from "/src/art/foliage/Real.js?review=1#source"');
    expect(result).toContain('from "/src/art/RealReference.js"');
    expect(result).toContain("from 'https://outside.invalid/src/art/Real.js'");
});

test('data-URL references receive absolute dependencies on the supplied local origin', () => {
    const { rebaseReferenceImports } = createReferenceModules(root);
    const result = rebaseReferenceImports(original, `${revision}:src/art/Comparison.js`, 'http://127.0.0.1:4173');
    expect(result).toContain('from "http://127.0.0.1:4173/src/art/foliage/Real.js"');
});

test('ambiguous current filenames fail rather than selecting a different dependency', () => {
    mkdirSync(path.join(root, 'src/art/other'));
    writeFileSync(path.join(root, 'src/art/other/Real.js'), 'export const real = () => 0;');
    const { rebaseReferenceImports } = createReferenceModules(root);
    expect(() => rebaseReferenceImports(original, `${revision}:src/art/Comparison.js`)).toThrow('Ambiguous reference module');
});

test('a missing historical filename retains a clear failure', () => {
    const { readReferenceSource } = createReferenceModules(root);
    expect(() => readReferenceSource(`${revision}:src/art/Missing.js`)).toThrow('Missing pinned source module');
});

test('a reference route follows its current physical module without losing the pinned source', () => {
    const { currentReferencePath, readReferenceSource } = createReferenceModules(root);
    expect(currentReferencePath(`${revision}:src/art/Comparison.js`)).toBe('/src/art/foliage/Comparison.js');
    expect(readReferenceSource(`${revision}:src/art/Comparison.js`)).toBe(original);
});

test('an external source snapshot can retain its historical namespace without a Git object', () => {
    const { rebaseReferenceImports } = createReferenceModules(root);
    for (const context of ['src/art/Comparison.js', 'src/art/foliage/Comparison.js'])
        expect(rebaseReferenceImports(original, context)).toContain('from "/src/art/foliage/Real.js"');
});
