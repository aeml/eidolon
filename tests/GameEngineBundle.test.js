import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { versionPagesRuntime } from '../scripts/version-pages-runtime.mjs';

const execute = promisify(execFile);
async function bundleGameEngine(root) {
    const { stdout } = await execute(process.execPath, ['scripts/bundle-game-engine.mjs', root]);
    return JSON.parse(stdout);
}
const fixtures = [];
async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), 'eidolon-engine-bundle-'));
    fixtures.push(root);
    await mkdir(path.join(root, 'src/core'), { recursive: true });
    await mkdir(path.join(root, 'src/ui'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(root, 'release.json'), '{"version":"Alpha 1.79.11"}');
    await writeFile(path.join(root, 'src/main.js'), "import {setToken} from './core/CredentialToken.js'; export {setToken}; export const enter=()=>import('./core/GameEngine.js'); export const retry=()=>import('./core/GameEngine.js?startupRetry=1');");
    await writeFile(path.join(root, 'src/core/CredentialToken.js'), 'let token=null; export const setToken=value=>token=value; export const getToken=()=>token;');
    await writeFile(path.join(root, 'src/ui/Paths.js'), "export const asset=()=>new URL('../../assets/help.json',import.meta.url).href; export const release=()=>new URL(import.meta.url).searchParams.get('release');");
    await writeFile(path.join(root, 'src/core/GameEngine.js'), "import {getToken} from './CredentialToken.js'; import {asset,release} from '../ui/Paths.js'; export class GameEngine {token(){return getToken()} asset(){return asset()} release(){return release()}}");
    return root;
}
afterEach(async () => { for (const root of fixtures.splice(0)) await rm(root, { recursive: true, force: true }); });

test('published lazy engine preserves shared credential identity, asset paths and release metadata', async () => {
    const root = await fixture();
    const original = await readFile(path.join(root, 'src/core/GameEngine.js'), 'utf8');
    const result = await bundleGameEngine(root);
    expect(result.bundledModules).toBe(2);
    expect(result.externalImports).toEqual(['./CredentialToken.js']);
    expect(await readFile(path.join(root, 'src/core/GameEngine.js'), 'utf8')).toBe(original);
    await versionPagesRuntime(root, 'abcdefgh123');
    const mainURL = `${pathToFileURL(path.join(root, 'src/main.js'))}?release=abcdefgh123`;
    const { stdout } = await execute(process.execPath, ['--input-type=module', '-e',
        `const login=await import(${JSON.stringify(mainURL)}); login.setToken('synthetic-only');
        const {GameEngine}=await login.enter(), game=new GameEngine();
        const result={token:game.token(),asset:game.asset(),release:game.release()};
        const recovered=await login.retry(); result.recoveryToken=new recovered.GameEngine().token();
        login.setToken(null); result.cleared=game.token(); console.log(JSON.stringify(result));`]);
    expect(JSON.parse(stdout)).toEqual({ token: 'synthetic-only',
        asset: pathToFileURL(path.join(root, 'assets/help.json')).href,
        release: 'abcdefgh123', recoveryToken: 'synthetic-only', cleared: null });
    await expect(bundleGameEngine(root)).rejects.toThrow('exactly one lazy');
});

test('editable repository is never a publishing destination', async () => {
    await expect(bundleGameEngine(process.cwd())).rejects.toThrow('copied publication tree');
});

test('publication preserves gameplay class names when separate modules have colliding identifiers', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'src/ui/Skeleton.js'), 'export class Skeleton { constructor(){this.kind="rig";} }');
    await writeFile(path.join(root, 'src/core/Skeleton.js'), 'export class Skeleton { constructor(){this.kind="enemy";} }');
    await writeFile(path.join(root, 'src/core/GameEngine.js'),
        "import {Skeleton as Rig} from '../ui/Skeleton.js'; import {Skeleton as Enemy} from './Skeleton.js'; export class GameEngine { actors(){return [new Rig(),new Enemy()]} }");
    await bundleGameEngine(root);
    await versionPagesRuntime(root, 'namesfixture20261009');
    const entry = pathToFileURL(path.join(root, 'src/main.js')).href;
    const { stdout } = await execute(process.execPath, ['--input-type=module', '-e',
        `const login=await import(${JSON.stringify(entry)}); const {GameEngine}=await login.enter();
        console.log(JSON.stringify(new GameEngine().actors().map(actor=>({kind:actor.kind,name:actor.constructor.name}))));`]);
    expect(JSON.parse(stdout)).toEqual([{ kind: 'rig', name: 'Skeleton' }, { kind: 'enemy', name: 'Skeleton' }]);
});

test('linked source tree is rejected without modifying its original', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'eidolon-engine-linked-')); fixtures.push(root);
    await symlink(path.join(process.cwd(), 'src'), path.join(root, 'src'));
    const original = await readFile('src/main.js', 'utf8');
    await expect(bundleGameEngine(root)).rejects.toThrow('copied, not linked');
    expect(await readFile('src/main.js', 'utf8')).toBe(original);
});

test('unexpected import.meta.url depth fails before publishing altered main', async () => {
    const root = await fixture();
    await mkdir(path.join(root, 'src/ui/deeper'));
    await writeFile(path.join(root, 'src/ui/deeper/Paths.js'), 'export const asset=()=>import.meta.url;');
    const main = await readFile(path.join(root, 'src/main.js'), 'utf8');
    await writeFile(path.join(root, 'src/core/GameEngine.js'), "import {asset} from '../ui/deeper/Paths.js'; export class GameEngine {asset(){return asset()}}");
    await expect(bundleGameEngine(root)).rejects.toThrow('Review import.meta.url');
    expect(await readFile(path.join(root, 'src/main.js'), 'utf8')).toBe(main);
});

test('actual game graph compiles while login state and Three remain external', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'eidolon-engine-actual-')); fixtures.push(root);
    await cp('src', path.join(root, 'src'), { recursive: true });
    const originalMain = await readFile('src/main.js', 'utf8');
    const result = await bundleGameEngine(root);
    expect(result.bundledModules).toBeGreaterThan(350);
    expect(result.externalImports.length).toBeLessThan(25);
    expect(result.externalImports).toEqual(expect.arrayContaining(['three', './CredentialToken.js', './GraphicsStartup.js']));
    expect(await readFile('src/main.js', 'utf8')).toBe(originalMain);
    const main = await readFile(path.join(root, 'src/main.js'), 'utf8');
    expect(main).toBe(originalMain.replaceAll("./core/GameEngine.js", "./core/GameEngine.bundle.js"));
});

test('Pages publication bundles the copied engine before versioning runtime URLs', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
    const bundle = workflow.indexOf('node scripts/bundle-game-engine.mjs public');
    const version = workflow.indexOf('node scripts/version-pages-runtime.mjs public');
    expect(bundle).toBeGreaterThan(workflow.indexOf('cp sw.js release.json public/'));
    expect(bundle).toBeLessThan(version);
});


test.each(['missing', 'duplicate', 'unsupported'])('publication rejects %s recovery imports', async kind => {
    const root = await fixture(), main = path.join(root, 'src/main.js');
    let source = await readFile(main, 'utf8');
    if (kind === 'missing') source = source.replace("export const retry=()=>import('./core/GameEngine.js?startupRetry=1');", '');
    if (kind === 'duplicate') source += "export const extra=()=>import('./core/GameEngine.js?startupRetry=1');";
    if (kind === 'unsupported') source = source.replace('startupRetry=1', 'startupRetry=2');
    await writeFile(main, source);
    await expect(bundleGameEngine(root)).rejects.toThrow('one bounded recovery');
    expect(await readFile(main, 'utf8')).toBe(source);
});
