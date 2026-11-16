// File order is deliberate: browser-smoke-plan partitions interface files by index.
// Keep account/fixture setup in the existing isolated QA wrappers, not this catalog.
export function suiteFiles(catalog, name) {
    const files = Object.hasOwn(catalog, name) ? catalog[name] : undefined;
    if (!Array.isArray(files) || !files.length ||
        files.some(file => typeof file !== 'string' || !/^tests\/e2e\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.spec\.js$/.test(file)) ||
        new Set(files).size !== files.length) {
        throw new Error(`Unsupported or missing browser coverage suite: ${name}`);
    }
    return [...files];
}
