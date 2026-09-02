import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RELEASE_PARAMETER = 'release';
const SAFE_RELEASE = /^[A-Za-z0-9._-]{7,80}$/;

function splitFragment(specifier) {
    const fragmentIndex = specifier.indexOf('#');
    return fragmentIndex === -1
        ? { resource: specifier, fragment: '' }
        : {
            resource: specifier.slice(0, fragmentIndex),
            fragment: specifier.slice(fragmentIndex)
        };
}

function isLocalSpecifier(specifier, allowDocumentRelative = false) {
    if (typeof specifier !== 'string' || specifier.length === 0) return false;
    if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/|#)/.test(specifier)) return false;
    return allowDocumentRelative || /^(?:\.\.?\/|\/)/.test(specifier);
}

function hasExtension(specifier, extensions) {
    const { resource } = splitFragment(specifier);
    const pathname = resource.split('?')[0];
    return extensions.some((extension) => pathname.endsWith(extension));
}

export function appendReleaseVersion(specifier, release, { allowDocumentRelative = false } = {}) {
    if (!SAFE_RELEASE.test(release)) {
        throw new Error(`Release id must match ${SAFE_RELEASE}; received "${release}"`);
    }
    if (!isLocalSpecifier(specifier, allowDocumentRelative)) return specifier;

    const encodedRelease = encodeURIComponent(release);
    const { resource, fragment } = splitFragment(specifier);
    const existingRelease = new RegExp(`([?&]${RELEASE_PARAMETER}=)[^&#]*`);
    const versionedResource = existingRelease.test(resource)
        ? resource.replace(existingRelease, `$1${encodedRelease}`)
        : `${resource}${resource.includes('?') ? '&' : '?'}${RELEASE_PARAMETER}=${encodedRelease}`;
    return `${versionedResource}${fragment}`;
}

function versionMatchedSpecifier(prefix, specifier, suffix, release, options = {}) {
    if (!hasExtension(specifier, options.extensions || ['.js'])) {
        return `${prefix}${specifier}${suffix}`;
    }
    return `${prefix}${appendReleaseVersion(specifier, release, options)}${suffix}`;
}

export function rewriteJavaScript(source, release) {
    return source
        .replace(/(\bfrom\s*["'])([^"']+)(["'])/g, (match, prefix, specifier, suffix) =>
            versionMatchedSpecifier(prefix, specifier, suffix, release))
        .replace(/(\bimport\s*(?:\(\s*)?["'])([^"']+)(["'])/g, (match, prefix, specifier, suffix) =>
            versionMatchedSpecifier(prefix, specifier, suffix, release))
        .replace(/(\bimportScripts\s*\(\s*["'])([^"']+)(["'])/g, (match, prefix, specifier, suffix) =>
            versionMatchedSpecifier(prefix, specifier, suffix, release));
}

export function rewriteCss(source, release) {
    const importsVersioned = source.replace(
        /(@import\s+(?:url\(\s*)?["'])([^"']+)(["'])/gi,
        (match, prefix, specifier, suffix) => versionMatchedSpecifier(
            prefix,
            specifier,
            suffix,
            release,
            { allowDocumentRelative: true, extensions: ['.css'] }
        )
    );
    return importsVersioned.replace(
        /(url\(\s*["']?)([^"')]+)(["']?\s*\))/gi,
        (match, prefix, specifier, suffix) => {
            if (!isLocalSpecifier(specifier, true)) return match;
            return `${prefix}${appendReleaseVersion(specifier, release, {
                allowDocumentRelative: true
            })}${suffix}`;
        }
    );
}

export function rewriteHtml(source, release) {
    return source.replace(
        /(\b(?:src|href)\s*=\s*["'])([^"']+)(["'])/gi,
        (match, prefix, specifier, suffix) => versionMatchedSpecifier(
            prefix,
            specifier,
            suffix,
            release,
            { allowDocumentRelative: true, extensions: ['.js', '.css'] }
        )
    );
}

async function listRuntimeFiles(root) {
    const files = [];
    const visit = async (directory) => {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            if (directory === root && entry.isDirectory() && entry.name === 'coverage') continue;
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await visit(entryPath);
            } else if (/\.(?:css|html|js)$/i.test(entry.name)) {
                files.push(entryPath);
            }
        }
    };
    await visit(root);
    return files;
}

export async function versionPagesRuntime(root, release) {
    const absoluteRoot = path.resolve(root);
    const files = await listRuntimeFiles(absoluteRoot);
    let changedFiles = 0;
    for (const filePath of files) {
        const source = await fs.readFile(filePath, 'utf8');
        const extension = path.extname(filePath).toLowerCase();
        const rewritten = extension === '.js'
            ? rewriteJavaScript(source, release)
            : extension === '.css'
                ? rewriteCss(source, release)
                : rewriteHtml(source, release);
        if (rewritten === source) continue;
        await fs.writeFile(filePath, rewritten);
        changedFiles += 1;
    }
    return { root: absoluteRoot, release, scannedFiles: files.length, changedFiles };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
    const [root, release] = process.argv.slice(2);
    if (!root || !release) {
        throw new Error('Usage: node scripts/version-pages-runtime.mjs <site-root> <release-id>');
    }
    const result = await versionPagesRuntime(root, release);
    process.stdout.write(`Versioned ${result.changedFiles}/${result.scannedFiles} Pages runtime files for ${release}.\n`);
}
