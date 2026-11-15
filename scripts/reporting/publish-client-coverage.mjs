import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The Jest lcov reporter emits both the tracefile and its matching HTML tree.
// Publish that tree directly so a second renderer cannot reinterpret its data.
export async function publishClientCoverage(artifactDirectory, outputDirectory) {
    const artifact = path.resolve(artifactDirectory);
    const source = path.join(artifact, 'lcov-report');
    for (const filename of [path.join(artifact, 'lcov.info'), path.join(source, 'index.html')]) {
        const file = await stat(filename);
        if (!file.isFile() || file.size === 0) throw new Error(`Missing nonempty client coverage report: ${filename}`);
    }
    const destination = path.resolve(outputDirectory);
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { recursive: true });
    return { source, destination };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/reporting/publish-client-coverage.mjs <artifact-directory> <output-directory>');
    console.log(JSON.stringify(await publishClientCoverage(process.argv[2], process.argv[3])));
}
