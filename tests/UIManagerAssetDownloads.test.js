import { jest } from '@jest/globals';
import { UIManager } from '../src/ui/UIManager.js';

function buildDom() {
    document.body.innerHTML = `
        <div id="player-hud"></div>
        <div id="player-hp-bar"></div>
        <div id="player-hp-text"></div>
        <div id="player-mana-bar"></div>
        <div id="player-mana-text"></div>
        <div id="ui-layer"></div>
        <div id="game-timer"></div>
        <div id="combat-intent-panel" style="display:none"></div>
        <div id="combat-intent-name"></div>
        <div id="combat-intent-meta"></div>
        <div id="combat-intent-status"></div>
        <div id="combat-intent-preview-basic"></div>
        <div id="combat-intent-preview-ability"></div>
        <div id="combat-intent-preview-ability-label"></div>
        <div id="dungeon-entrance-hint"></div>
        <div id="dungeon-entrance-hint-name"></div>
        <div id="dungeon-entrance-hint-status"></div>
        <div id="dungeon-entrance-hint-prompt"></div>
        <div id="xp-bar-fill"></div>
        <div id="xp-text"></div>
        <div id="character-sheet"></div>
        <div id="stats-content"></div>
        <div id="quest-window"></div>
        <div id="quest-list"></div>
        <div id="quest-journal"></div>
        <div id="journal-list"></div>
        <div id="objectives-panel"></div>
        <div id="objectives-list"></div>
        <button id="btn-close-quest"></button>
        <button id="btn-close-journal"></button>
        <div id="esc-menu"></div>
        <div id="help-screen"></div>
        <div id="settings-screen"></div>
        <div id="patch-notes-screen"></div>
        <button id="btn-resume"></button>
        <button id="btn-help"></button>
        <button id="btn-settings"></button>
        <button id="btn-patch-notes"></button>
        <button id="btn-report"></button>
        <button id="btn-menu"></button>
        <button id="btn-close-help"></button>
        <button id="btn-close-settings"></button>
        <button id="btn-close-patch-notes"></button>
        <button id="btn-respawn"></button>
        <div id="abilities-menu"></div>
        <div id="abilities-content"></div>
        <button id="btn-close-abilities"></button>
        <div id="hotbar-container"></div>
        <div class="hotbar-slot"></div>
        <div id="report-screen"></div>
        <button id="btn-cancel-report"></button>
        <button id="btn-submit-report"></button>
        <select id="report-type"></select>
        <textarea id="report-text"></textarea>
        <select id="graphics-quality"></select>
        <input id="graphics-brightness" />
        <div id="graphics-brightness-value"></div>
        <input id="auto-loot-enabled" type="checkbox" />
        <button id="btn-download-core-assets"></button>
        <button id="btn-download-dungeon-assets"></button>
        <button id="btn-download-environment-assets"></button>
        <button id="btn-download-recommended-assets"></button>
        <button id="btn-refresh-outdated-assets"></button>
        <button id="btn-update-cached-assets"></button>
        <button id="btn-clear-cached-assets"></button>
        <div id="asset-download-status"></div>
        <div id="asset-download-progress"></div>
        <div id="asset-download-progress-bar"></div>
        <div id="asset-cache-state-detail"></div>
        <div id="asset-last-synced-version"></div>
        <div id="asset-pack-core-badge"></div>
        <div id="asset-pack-core-status"></div>
        <div id="asset-pack-core-size"></div>
        <div id="asset-pack-core-version"></div>
        <div id="asset-pack-dungeon-badge"></div>
        <div id="asset-pack-dungeon-status"></div>
        <div id="asset-pack-dungeon-size"></div>
        <div id="asset-pack-dungeon-version"></div>
        <div id="asset-pack-environment-badge"></div>
        <div id="asset-pack-environment-status"></div>
        <div id="asset-pack-environment-size"></div>
        <div id="asset-pack-environment-version"></div>
        <div id="inventory-screen"></div>
        <div id="inventory-grid"></div>
        <button id="btn-sort-inventory"></button>
        <div id="gold-display"></div>
        <div id="shop-screen"></div>
        <div id="shop-gamble-title"></div>
        <div id="shop-content-main"></div>
        <div id="shop-content-buyback"></div>
        <button id="tab-shop-main"></button>
        <button id="tab-shop-buyback"></button>
        <button id="btn-close-shop"></button>
        <button id="btn-sell-common"></button>
        <button id="btn-sell-uncommon"></button>
        <button id="btn-sell-rare"></button>
        <div id="shop-grid"></div>
        <div id="stash-screen"></div>
        <div id="stash-grid"></div>
        <div id="buyback-grid"></div>
        <div id="split-stack-window"></div>
        <button id="btn-close-split"></button>
        <div id="split-item-name"></div>
        <input id="split-amount-range" />
        <input id="split-amount-input" />
        <button id="btn-confirm-split"></button>
        <button id="btn-cancel-split"></button>
        <div id="forge-screen"></div>
        <div id="forge-potency-info"></div>
        <div id="forge-potency-item-name"></div>
        <div id="forge-potency-stats"></div>
        <div id="forge-potency-cost-value"></div>
        <button id="btn-forge-potency"></button>
        <div id="forge-socket-info"></div>
        <div id="forge-socket-item-name"></div>
        <div id="forge-socket-stats"></div>
        <div id="forge-socket-cost-hearts"></div>
        <div id="forge-socket-cost-shards"></div>
        <button id="btn-forge-socket"></button>
        <div id="trading-house-screen"></div>
        <div id="trading-inventory-grid"></div>
        <div id="trading-search-results"></div>
        <div id="trading-my-auctions"></div>
        <button id="btn-trading-search"></button>
        <button id="btn-trading-create"></button>
        <button id="btn-trading-my-auctions"></button>
        <button id="btn-close-trading"></button>
        <input id="trading-search-name" />
        <select id="trading-search-rarity"></select>
        <input id="trading-create-price" />
        <input id="trading-create-duration" />
        <div id="social-window"></div>
        <div id="party-panel"></div>
        <div id="skill-tree-window"></div>
        <div id="menu-bar"></div>
        <button id="btn-menu-map"></button>
        <button id="btn-menu-social"></button>
        <button id="btn-menu-inventory"></button>
        <button id="btn-menu-character"></button>
        <button id="btn-menu-quest"></button>
        <button id="btn-menu-skills"></button>
        <div id="ability-container"></div>
        <div id="ability-icon"></div>
        <div id="ability-cooldown"></div>
        <div id="ability-tooltip"></div>
        <div id="ability-name"></div>
        <div id="ability-desc"></div>
        <div id="ability-cost"></div>
        <div id="stat-tooltip"></div>
        <div id="stat-tooltip-title"></div>
        <div id="stat-tooltip-desc"></div>
        <div id="compare-tooltip"></div>
        <div id="compare-tooltip-title"></div>
        <div id="compare-tooltip-desc"></div>
        <div id="chat-box"></div>
        <div id="chat-messages"></div>
        <input id="chat-input" />
        <div id="death-screen"></div>
        <div id="xp-bar-container"></div>
    `;
}

describe('UIManager asset download settings', () => {
    beforeEach(() => {
        localStorage.clear();
        buildDom();
    });

    test('starts with idle asset download status labels', () => {
        const ui = new UIManager(false);

        expect(ui.assetDownloadStatus.textContent).toContain('Procedural core built in');
        expect(ui.assetPackCoreStatus.textContent).toContain('Procedural core built in');
        expect(ui.assetPackDungeonStatus.textContent).toContain('Dungeon models not downloaded');
        expect(ui.assetPackCoreSize.textContent).toContain('no download');
        expect(ui.assetPackEnvironmentSize.textContent).toContain('MB');
        expect(document.getElementById('asset-pack-core-version').textContent).toContain('Built-in version');
        expect(document.getElementById('asset-pack-core-badge').textContent).toContain('Current');
        expect(document.getElementById('asset-pack-core-badge').dataset.state).toBe('current');
        expect(document.getElementById('asset-pack-core-badge').style.color).toBe('rgb(214, 255, 214)');
        expect(document.getElementById('btn-download-core-assets').disabled).toBe(true);
        expect(ui.assetLastSyncedVersion.textContent).toContain('Not yet synced');
    });

    test('procedural core is built in and cannot trigger a redundant download', async () => {
        const ui = new UIManager(false);
        ui.onAssetDownloadRequest = jest.fn(async () => undefined);

        document.getElementById('btn-download-core-assets').click();
        await Promise.resolve();

        expect(ui.onAssetDownloadRequest).not.toHaveBeenCalled();
        expect(ui.assetPackCoreStatus.textContent).toContain('Procedural core built in');
    });

    test('download success updates pack-specific status text', async () => {
        const ui = new UIManager(false);
        ui.onAssetDownloadRequest = jest.fn(async (packName) => {
            ui.setAssetPackStatus(packName, 'cached');
        });

        document.getElementById('btn-download-dungeon-assets').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(ui.assetPackDungeonStatus.textContent).toContain('Dungeon models cached');
        expect(document.getElementById('asset-pack-dungeon-badge').textContent).toContain('Current');
        expect(document.getElementById('asset-pack-dungeon-badge').dataset.state).toBe('current');
        expect(document.getElementById('asset-pack-dungeon-badge').style.color).toBe('rgb(214, 255, 214)');
        expect(ui.assetDownloadStatus.textContent).toContain('All selected packs ready offline');
    });

    test('progress updates render percent text and progress bar width', () => {
        const ui = new UIManager(false);

        ui.updateAssetDownloadProgress({ completed: 2, total: 4, percent: 50 });

        expect(ui.assetDownloadProgress.textContent).toContain('50%');
        expect(ui.assetDownloadProgressBar.style.width).toBe('50%');
    });

    test('clear cache button invokes callback and resets statuses', async () => {
        const ui = new UIManager(false);
        ui.setAssetPackStatus('core-models', 'cached');
        ui.setAssetPackStatus('dungeon-models', 'cached');
        ui.onAssetCacheClearRequest = jest.fn(async () => ({ cleared: 2 }));

        document.getElementById('btn-clear-cached-assets').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(ui.onAssetCacheClearRequest).toHaveBeenCalled();
        expect(ui.assetDownloadStatus.textContent).toContain('Cache cleared');
        expect(ui.assetPackCoreStatus.textContent).toContain('Procedural core built in');
        expect(ui.assetPackDungeonStatus.textContent).toContain('Dungeon models not downloaded');
    });

    test('reflects real cache inspection results in status labels', async () => {
        const ui = new UIManager(false);
        ui.assetCacheManager.inspectPack = jest.fn(async (packName) => ({
            packName,
            cached: packName === 'core-models',
            cachedCount: packName === 'core-models' ? 4 : packName === 'environment-textures' ? 2 : 1,
            total: 4,
            updateAvailable: packName === 'dungeon-models',
            cachedVersion: packName === 'core-models' ? '2026-09-02-14' : packName === 'dungeon-models' ? 'legacy-build' : null
        }));

        await ui.refreshAssetCacheState();

        expect(ui.assetPackCoreStatus.textContent).toContain('Procedural core built in');
        expect(ui.assetPackDungeonStatus.textContent).toContain('1/4 cached');
        expect(ui.assetPackEnvironmentStatus.textContent).toContain('2/4 cached');
        expect(document.getElementById('asset-pack-core-version').textContent).toContain('2026-09-02-14');
        expect(document.getElementById('asset-pack-dungeon-version').textContent).toContain('legacy-build');
        expect(document.getElementById('asset-pack-environment-version').textContent).toContain('Not cached');
        expect(document.getElementById('asset-pack-core-badge').textContent).toContain('Current');
        expect(document.getElementById('asset-pack-core-badge').dataset.state).toBe('current');
        expect(document.getElementById('asset-pack-core-badge').style.color).toBe('rgb(214, 255, 214)');
        expect(document.getElementById('asset-pack-dungeon-badge').textContent).toContain('Outdated');
        expect(document.getElementById('asset-pack-dungeon-badge').dataset.state).toBe('outdated');
        expect(document.getElementById('asset-pack-dungeon-badge').style.color).toBe('rgb(255, 199, 199)');
        expect(document.getElementById('asset-pack-environment-badge').textContent).toContain('Partial');
        expect(document.getElementById('asset-pack-environment-badge').dataset.state).toBe('partial');
        expect(document.getElementById('asset-pack-environment-badge').style.color).toBe('rgb(255, 231, 166)');
        expect(ui.assetCacheStateDetail.textContent).toContain('1 pack need refresh');
    });

    test('environment asset button requests environment textures pack', async () => {
        const ui = new UIManager(false);
        ui.onAssetDownloadRequest = jest.fn(async () => undefined);

        document.getElementById('btn-download-environment-assets').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(ui.onAssetDownloadRequest).toHaveBeenCalledWith('environment-textures');
    });

    test('refresh outdated assets requests only stale packs', async () => {
        const ui = new UIManager(false);
        ui.assetCacheManager.inspectPack = jest.fn(async (packName) => ({
            packName,
            cached: false,
            cachedCount: packName === 'core-models' ? 4 : 1,
            total: 4,
            updateAvailable: packName !== 'core-models'
        }));
        ui.onAssetDownloadRequest = jest.fn(async () => undefined);

        await ui.refreshOutdatedAssets();

        expect(ui.onAssetDownloadRequest).toHaveBeenCalledWith('dungeon-models');
        expect(ui.onAssetDownloadRequest).toHaveBeenCalledWith('environment-textures');
        expect(ui.onAssetDownloadRequest).not.toHaveBeenCalledWith('core-models');
    });

    test('update cached assets refreshes every cached pack', async () => {
        const ui = new UIManager(false);
        ui.assetCacheManager.inspectPack = jest.fn(async (packName) => ({
            packName,
            cached: packName === 'core-models',
            builtIn: packName === 'core-models',
            cachedCount: packName === 'dungeon-models' ? 0 : 2,
            total: 4,
            updateAvailable: packName === 'environment-textures'
        }));
        ui.onAssetDownloadRequest = jest.fn(async () => undefined);

        await ui.updateCachedAssets();

        expect(ui.onAssetDownloadRequest).not.toHaveBeenCalledWith('core-models');
        expect(ui.onAssetDownloadRequest).toHaveBeenCalledWith('environment-textures');
        expect(ui.onAssetDownloadRequest).not.toHaveBeenCalledWith('dungeon-models');
        expect(ui.assetDownloadStatus.textContent).toContain('Updated cached asset packs');
    });

    test('recommended assets button skips built-in core and downloads environment textures', async () => {
        const ui = new UIManager(false);
        ui.onAssetDownloadRequest = jest.fn(async () => undefined);

        document.getElementById('btn-download-recommended-assets').click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(ui.onAssetDownloadRequest).not.toHaveBeenCalledWith('core-models');
        expect(ui.onAssetDownloadRequest).toHaveBeenCalledWith('environment-textures');
        expect(ui.onAssetDownloadRequest).not.toHaveBeenCalledWith('dungeon-models');
    });

    test('successful downloads update last synced asset version', async () => {
        const ui = new UIManager(false);
        ui.onAssetDownloadRequest = jest.fn(async () => undefined);

        await ui.requestAssetDownload('environment-textures');

        expect(ui.assetLastSyncedVersion.textContent).toContain('2026-09-02-14');
        expect(localStorage.getItem('eidolon.assetLastSyncedVersion')).toBe('2026-09-02-14');
    });
});
