const entrances = ['tests/e2e/entrance-visibility.spec.js'];
const effects = ['tests/e2e/offline-seraph-render.spec.js',
    'tests/e2e/phone-encounter-composition.spec.js', 'tests/e2e/respawn-appearance.spec.js'];
const combatPresentation = ['tests/e2e/combat-action-preview.spec.js', 'tests/e2e/desktop-action-readability.spec.js'];

function scriptFiles(manifest, name) {
    const command = manifest.scripts?.[`test:e2e:${name}`];
    const tokens = command?.trim().split(/\s+/) || [];
    const files = tokens.slice(2);
    if (tokens[0] !== 'playwright' || tokens[1] !== 'test' || !files.length ||
        files.some(file => !/^tests\/e2e\/[a-z0-9-]+\.spec\.js$/.test(file)) ||
        new Set(files).size !== files.length) {
        throw new Error(`Unsupported or missing browser coverage command: ${name}`);
    }
    return files;
}

function supplemental(manifest) {
    return [
        { name: 'nameplates', shard: 1, files: scriptFiles(manifest, 'nameplates') },
        { name: 'resource-hud', shard: 1, files: scriptFiles(manifest, 'resource-hud') },
        { name: 'crystal-art', shard: 2, files: scriptFiles(manifest, 'crystal-art') },
        { name: 'journal', shard: 2, files: scriptFiles(manifest, 'journal') },
        { name: 'combat-presentation', shard: 2, files: combatPresentation }
    ];
}

export function browserSmokeBaselineFiles(manifest) {
    const files = [...scriptFiles(manifest, 'anonymous'), ...supplemental(manifest).flatMap(stage => stage.files)];
    if (new Set(files).size !== files.length) throw new Error('Duplicate required browser coverage');
    return files;
}

export function buildBrowserSmokePlan(manifest, shard) {
    if (!Number.isInteger(shard) || shard < 1 || shard > 3) throw new Error('Browser shard must be 1, 2 or 3');
    browserSmokeBaselineFiles(manifest);
    const anonymous = scriptFiles(manifest, 'anonymous');
    const renderFiles = [...entrances, ...effects];
    for (const file of renderFiles) {
        if (!anonymous.includes(file)) throw new Error(`Missing required rendering coverage: ${file}`);
    }
    const groups = [
        { name: 'layout', files: anonymous.filter(file => !renderFiles.includes(file)), sharded: true },
        // These cases use per-test page/scene fixtures and no beforeAll/serial
        // shared state. Split only these reviewed independent rendering cases.
        { name: 'entrances', files: entrances, sharded: true, independent: true },
        { name: 'effects', files: effects, sharded: true, independent: true },
        ...supplemental(manifest).filter(stage => stage.shard === shard)
    ];
    return groups.map(group => {
        if (!group.files.length) throw new Error(`Empty browser group: ${group.name}`);
        return { name: group.name, files: [...group.files],
            args: ['test', ...group.files, '--workers=1',
                ...(group.sharded ? [`--shard=${shard}/3`] : []),
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
