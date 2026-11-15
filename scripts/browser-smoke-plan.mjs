import { suiteFiles } from './e2e-suite-catalog.mjs';

const entrances = ['tests/e2e/entrance-visibility.spec.js'];
const effects = ['tests/e2e/offline-seraph-render.spec.js',
    'tests/e2e/phone-encounter-composition.spec.js', 'tests/e2e/respawn-appearance.spec.js'];

function supplemental(catalog) {
    return [
        { name: 'nameplates', shard: 1, files: suiteFiles(catalog, 'nameplates') },
        { name: 'resource-hud', shard: 1, files: suiteFiles(catalog, 'resource-hud') },
        { name: 'crystal-art', shard: 2, files: suiteFiles(catalog, 'crystal-art') },
        { name: 'privacy', shard: 3, files: suiteFiles(catalog, 'privacy') },
        { name: 'interface', partitionFiles: true, files: suiteFiles(catalog, 'interface') }
    ];
}

export function browserSmokeBaselineFiles(catalog) {
    const files = [...suiteFiles(catalog, 'anonymous'), ...supplemental(catalog).flatMap(stage => stage.files)];
    if (new Set(files).size !== files.length) throw new Error('Duplicate required browser coverage');
    return files;
}

export function buildBrowserSmokePlan(catalog, shard) {
    if (!Number.isInteger(shard) || shard < 1 || shard > 3) throw new Error('Browser shard must be 1, 2 or 3');
    browserSmokeBaselineFiles(catalog);
    const anonymous = suiteFiles(catalog, 'anonymous');
    const renderFiles = [...entrances, ...effects];
    for (const file of renderFiles) {
        if (!anonymous.includes(file)) throw new Error(`Missing required rendering coverage: ${file}`);
    }
    const groups = [
        { name: 'layout', files: anonymous.filter(file => !renderFiles.includes(file)), testShard: shard },
        // These cases use per-test page/scene fixtures and no beforeAll/serial
        // shared state. Split only these reviewed independent rendering cases.
        // Rotate the independent families so one hosted job does not receive
        // every expensive first partition. Each family still runs shards1–3
        // exactly once; artifact paths retain the owning workflow job number.
        { name: 'entrances', files: entrances, testShard: shard % 3 + 1, independent: true },
        { name: 'effects', files: effects, testShard: (shard + 1) % 3 + 1, independent: true },
        // The growing interface family used to run wholly on job2. Partition
        // whole files across the existing jobs: no duplicated suite setup or
        // splitting of serial/shared-state cases, and no coverage is removed.
        ...supplemental(catalog).filter(stage => stage.partitionFiles || stage.shard === shard)
            .map(stage => ({ ...stage, files: stage.partitionFiles
                ? stage.files.filter((_, index) => index % 3 === shard - 1) : stage.files }))
    ];
    return groups.map(group => {
        if (!group.files.length) throw new Error(`Empty browser group: ${group.name}`);
        return { name: group.name, files: [...group.files],
            args: ['test', ...group.files, '--workers=1',
                ...(group.testShard ? [`--shard=${group.testShard}/3`] : []),
                ...(group.independent ? ['--fully-parallel'] : []),
                '--reporter=line,html', `--output=test-results/browser-${shard}/${group.name}`],
            env: { PLAYWRIGHT_HTML_OUTPUT_DIR: `playwright-report/browser-${shard}/${group.name}`,
                PLAYWRIGHT_HTML_OPEN: 'never' } };
    });
}

export function runBrowserSmokePlan(plan, execute) {
    for (const stage of plan) {
        const result = execute(stage);
        if (result?.error || result?.status == null) return 1;
        if (result.status !== 0) return result.status;
    }
    return 0;
}
