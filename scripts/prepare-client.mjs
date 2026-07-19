import { access, copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorRoot = path.join(repoRoot, 'vendor');
const nodeModules = path.join(repoRoot, 'node_modules');

const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
const protobufVersion = packageJson.devDependencies.protobufjs;
const threeVersion = packageJson.dependencies.three;

const protobufSource = path.join(nodeModules, 'protobufjs', 'dist', 'minimal', 'protobuf.min.js');
const threeSource = path.join(nodeModules, 'three');

await access(protobufSource);
await access(threeSource);

await rm(vendorRoot, { recursive: true, force: true });
await mkdir(path.join(vendorRoot, 'protobuf'), { recursive: true });
await mkdir(path.join(vendorRoot, 'three'), { recursive: true });

await copyFile(protobufSource, path.join(vendorRoot, 'protobuf', 'protobuf.min.js'));
await copyFile(
    path.join(nodeModules, 'protobufjs', 'LICENSE'),
    path.join(vendorRoot, 'protobuf', 'LICENSE')
);

await cp(path.join(threeSource, 'build'), path.join(vendorRoot, 'three', 'build'), {
    recursive: true
});
await cp(path.join(threeSource, 'examples', 'jsm'), path.join(vendorRoot, 'three', 'examples', 'jsm'), {
    recursive: true
});
await copyFile(path.join(threeSource, 'LICENSE'), path.join(vendorRoot, 'three', 'LICENSE'));

await writeFile(
    path.join(vendorRoot, 'manifest.json'),
    `${JSON.stringify({ protobufjs: protobufVersion, three: threeVersion }, null, 2)}\n`,
    'utf8'
);

console.log(`Prepared browser runtime dependencies in ${path.relative(repoRoot, vendorRoot)}/`);
