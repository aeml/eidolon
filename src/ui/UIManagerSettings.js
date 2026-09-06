import { DEFAULT_ASSET_VERSION, getRecommendedAssetPackNames } from '../assets/assetManifest.js';
import { AUDIO_CUES } from '../audio/AudioManager.js';
import { installPrototypeMethods } from '../core/PrototypeInstaller.js';

class UIManagerSettingsMethods {
    toggleEscMenu() {
        const isHidden = this.escMenu.style.display === 'none' || this.escMenu.style.display === '';
        this.escMenu.style.display = isHidden ? 'block' : 'none';
        this.playUICue(isHidden ? AUDIO_CUES.uiOpen : AUDIO_CUES.uiClose);
        this.onEscMenuChange?.(isHidden);

        // If closing menu, also close help/patch notes if open
        if (!isHidden) {
            this.closeAllStaticModals();
        }
    }

    toggleHelp() {
        this.toggleStaticModal(this.helpScreen, 'block');
    }

    toggleSettings() {
        if (this.isMobile && !this.isElementVisible(this.settingsScreen)) {
            this.chat?.setMobileExpanded(false);
            if (this.isEscMenuOpen) this.toggleEscMenu();
        }
        this.toggleStaticModal(this.settingsScreen, this.isMobile ? 'flex' : 'block');
    }

    togglePatchNotes() {
        this.toggleStaticModal(this.patchNotesScreen, 'flex');
    }

    toggleReport() {
        this.toggleStaticModal(this.reportScreen, 'block');
    }

    setGraphicsQuality(quality) {
        const valid = quality === 'low' || quality === 'medium' || quality === 'high';
        const nextQuality = valid ? quality : 'high';
        this.graphicsQuality = nextQuality;
        localStorage.setItem('eidolon.graphicsQuality', nextQuality);
        if (this.graphicsQualitySelect && this.graphicsQualitySelect.value !== nextQuality) {
            this.graphicsQualitySelect.value = nextQuality;
        }
        if (this.onGraphicsQualityChange) {
            const applyResult = this.onGraphicsQualityChange(nextQuality);
            if (applyResult && applyResult.reloadRequired) {
                const shouldReload = window.confirm('Some graphics features need a reload to fully apply. Reload now?');
                if (shouldReload) {
                    window.location.reload();
                }
            }
        }
    }

    getGraphicsQuality() {
        return this.graphicsQuality || 'high';
    }

    updateBrightnessLabel() {
        if (this.graphicsBrightnessValue) {
            this.graphicsBrightnessValue.textContent = `${Math.round(this.graphicsBrightness)}%`;
        }
    }

    setBrightnessLevel(level) {
        const numericLevel = Number.isFinite(level) ? level : 100;
        const clamped = Math.max(0, Math.min(100, numericLevel));
        this.graphicsBrightness = clamped;
        localStorage.setItem('eidolon.graphicsBrightness', String(clamped));
        if (this.graphicsBrightnessSlider && Number(this.graphicsBrightnessSlider.value) !== clamped) {
            this.graphicsBrightnessSlider.value = String(clamped);
        }
        this.updateBrightnessLabel();
        if (this.onBrightnessChange) {
            this.onBrightnessChange(clamped);
        }
    }

    getBrightnessLevel() {
        return this.graphicsBrightness;
    }

    updateUiScaleLabel() {
        if (this.uiScaleValue) {
            this.uiScaleValue.textContent = `${Math.round(this.uiScale)}%`;
        }
    }

    applyUiScale() {
        document.documentElement?.style?.setProperty?.('--ui-scale', this.isMobile ? '1' : String(this.uiScale / 100));
        document.documentElement?.style?.setProperty?.('--phone-menu-text-size', `${this.isMobile ? Math.round(16 * this.uiScale) / 100 : 16}px`);
    }

    setUiScale(scalePercent) {
        const numericScale = Number.isFinite(scalePercent) ? scalePercent : 100;
        const clamped = Math.max(this.isMobile ? 100 : 85, Math.min(125, numericScale));
        this.uiScale = clamped;
        localStorage.setItem(this.isMobile ? 'eidolon.phoneMenuTextScale' : 'eidolon.uiScale', String(clamped));
        if (this.uiScaleSlider && Number(this.uiScaleSlider.value) !== clamped) {
            this.uiScaleSlider.value = String(clamped);
        }
        this.applyUiScale();
        this.updateUiScaleLabel();
        if (this.onUiScaleChange) {
            this.onUiScaleChange(clamped / 100);
        }
    }

    getUiScale() {
        return Math.max(this.isMobile ? 1 : 0.85, Math.min(1.25, (Number(this.uiScale) || 100) / 100));
    }

    normalizeControlHintLevel(level) {
        return level === 'detailed' ? 'detailed' : 'standard';
    }

    applyControlHintLevel() {
        if (this.keyboardReferenceGuide) {
            this.keyboardReferenceGuide.style.display = this.controlHintLevel === 'detailed' ? 'block' : 'none';
        }
    }

    setControlHintLevel(level) {
        const nextValue = this.normalizeControlHintLevel(level);
        this.controlHintLevel = nextValue;
        localStorage.setItem('eidolon.controlHintLevel', nextValue);
        if (this.controlHintLevelSelect && this.controlHintLevelSelect.value !== nextValue) {
            this.controlHintLevelSelect.value = nextValue;
        }
        this.applyControlHintLevel();
        if (this.onControlHintLevelChange) {
            this.onControlHintLevelChange(nextValue);
        }
    }

    getControlHintLevel() {
        return this.normalizeControlHintLevel(this.controlHintLevel);
    }

    setAutoLootEnabled(enabled) {
        const nextValue = Boolean(enabled);
        this.autoLootEnabled = nextValue;
        localStorage.setItem('eidolon.autoLootEnabled', String(nextValue));
        if (this.autoLootToggle) {
            this.autoLootToggle.checked = nextValue;
        }
        if (this.onAutoLootChange) {
            this.onAutoLootChange(nextValue);
        }
    }

    getAutoLootEnabled() {
        return Boolean(this.autoLootEnabled);
    }

    updateAudioVolumeLabel() {
        if (this.audioVolumeValue) {
            this.audioVolumeValue.textContent = `${Math.round(this.audioVolume)}%`;
        }
    }

    setAudioEnabled(enabled) {
        const nextValue = Boolean(enabled);
        this.audioEnabled = nextValue;
        this.audioManager?.setEnabled?.(nextValue);
        if (this.audioEnabledToggle) {
            this.audioEnabledToggle.checked = nextValue;
        }
        if (this.onAudioEnabledChange) {
            this.onAudioEnabledChange(nextValue);
        }
    }

    getAudioEnabled() {
        return Boolean(this.audioEnabled);
    }

    setAudioVolume(volumePercent) {
        const numericVolume = Number.isFinite(volumePercent) ? volumePercent : 45;
        const clamped = Math.max(0, Math.min(100, numericVolume));
        this.audioVolume = clamped;
        this.audioManager?.setVolume?.(clamped / 100);
        if (this.audioVolumeSlider && Number(this.audioVolumeSlider.value) !== clamped) {
            this.audioVolumeSlider.value = String(clamped);
        }
        this.updateAudioVolumeLabel();
        if (this.onAudioVolumeChange) {
            this.onAudioVolumeChange(clamped / 100);
        }
    }

    getAudioVolume() {
        return Math.max(0, Math.min(1, (Number(this.audioVolume) || 0) / 100));
    }

    setAudioDetailLevel(detailLevel) {
        const nextValue = detailLevel === 'reduced' ? 'reduced' : 'full';
        this.audioDetailLevel = nextValue;
        this.audioManager?.setDetailLevel?.(nextValue);
        if (this.audioDetailSelect && this.audioDetailSelect.value !== nextValue) {
            this.audioDetailSelect.value = nextValue;
        }
        if (this.onAudioDetailLevelChange) {
            this.onAudioDetailLevelChange(nextValue);
        }
    }

    getAudioDetailLevel() {
        return this.audioDetailLevel === 'reduced' ? 'reduced' : 'full';
    }

    setCameraShakeEnabled(enabled) {
        const nextValue = Boolean(enabled);
        this.cameraShakeEnabled = nextValue;
        localStorage.setItem('eidolon.cameraShakeEnabled', String(nextValue));
        if (this.cameraShakeToggle) {
            this.cameraShakeToggle.checked = nextValue;
        }
        if (this.onCameraShakeChange) {
            this.onCameraShakeChange(nextValue);
        }
    }

    getCameraShakeEnabled() {
        return Boolean(this.cameraShakeEnabled);
    }

    setFullscreenEnabled(enabled) {
        const nextValue = Boolean(enabled);
        this.fullscreenEnabled = nextValue;
        localStorage.setItem('eidolon.fullscreenEnabled', String(nextValue));
        if (this.fullscreenToggle) {
            this.fullscreenToggle.checked = nextValue;
        }
        if (this.onFullscreenChange) {
            this.onFullscreenChange(nextValue);
        }
    }

    getFullscreenEnabled() {
        return Boolean(this.fullscreenEnabled);
    }

    getAssetPackLabel(packName) {
        if (packName === 'dungeon-models') return 'Procedural dungeon entrances';
        if (packName === 'environment-textures') return 'Procedural realm terrain';
        return 'Procedural core';
    }

    renderAssetPackEstimates() {
        if (this.assetPackCoreSize) {
            this.assetPackCoreSize.textContent = 'Code-generated locally · no download';
        }
        if (this.assetPackDungeonSize) {
            this.assetPackDungeonSize.textContent = 'Code-generated locally · no download';
        }
        if (this.assetPackEnvironmentSize) {
            this.assetPackEnvironmentSize.textContent = 'Code-generated locally · no download';
        }
        this.renderAssetPackVersion('core-models', DEFAULT_ASSET_VERSION);
        this.renderAssetPackVersion('dungeon-models', DEFAULT_ASSET_VERSION);
        this.renderAssetPackVersion('environment-textures', DEFAULT_ASSET_VERSION, true);
        this.renderAssetPackBadge('core-models', 'current');
        this.renderAssetPackBadge('dungeon-models', 'current');
        this.renderAssetPackBadge('environment-textures', 'current');
    }

    renderLastSyncedVersion() {
        if (!this.assetLastSyncedVersion) {
            return;
        }
        this.assetLastSyncedVersion.textContent = this.assetLastSyncedVersionValue
            ? `Last synced asset version: ${this.assetLastSyncedVersionValue}`
            : 'Last synced asset version: Not yet synced';
    }

    markAssetsSynced(version = DEFAULT_ASSET_VERSION) {
        this.assetLastSyncedVersionValue = version;
        localStorage.setItem('eidolon.assetLastSyncedVersion', version);
        this.renderLastSyncedVersion();
    }

    getAssetPackBadgeElement(packName) {
        if (packName === 'core-models') return this.assetPackCoreBadge;
        if (packName === 'dungeon-models') return this.assetPackDungeonBadge;
        if (packName === 'environment-textures') return this.assetPackEnvironmentBadge;
        return null;
    }

    getAssetPackVersionElement(packName) {
        if (packName === 'core-models') return this.assetPackCoreVersion;
        if (packName === 'dungeon-models') return this.assetPackDungeonVersion;
        if (packName === 'environment-textures') return this.assetPackEnvironmentVersion;
        return null;
    }

    renderAssetPackVersion(packName, version = null, builtIn = packName === 'core-models' || packName === 'dungeon-models') {
        const element = this.getAssetPackVersionElement(packName);
        if (!element) {
            return;
        }
        if (builtIn) {
            element.textContent = `Built-in version: ${version || DEFAULT_ASSET_VERSION}`;
            return;
        }
        element.textContent = version
            ? `Cached version: ${version}`
            : 'Cached version: Not cached';
    }

    renderAssetPackBadge(packName, state = 'not-cached') {
        const element = this.getAssetPackBadgeElement(packName);
        if (!element) {
            return;
        }

        const badgeMap = {
            'not-cached': {
                label: 'Not cached',
                background: 'rgba(140, 148, 163, 0.18)',
                color: '#c7d0dc',
                borderColor: 'rgba(140, 148, 163, 0.35)'
            },
            downloading: {
                label: 'Downloading',
                background: 'rgba(111, 168, 220, 0.18)',
                color: '#cfe9ff',
                borderColor: 'rgba(111, 168, 220, 0.4)'
            },
            partial: {
                label: 'Partial',
                background: 'rgba(224, 188, 92, 0.18)',
                color: '#ffe7a6',
                borderColor: 'rgba(224, 188, 92, 0.42)'
            },
            current: {
                label: 'Current',
                background: 'rgba(91, 189, 106, 0.18)',
                color: '#d6ffd6',
                borderColor: 'rgba(91, 189, 106, 0.42)'
            },
            outdated: {
                label: 'Outdated',
                background: 'rgba(214, 111, 111, 0.18)',
                color: '#ffc7c7',
                borderColor: 'rgba(214, 111, 111, 0.42)'
            }
        };

        const resolved = badgeMap[state] || badgeMap['not-cached'];
        element.dataset.state = state;
        element.textContent = resolved.label;
        element.style.background = resolved.background;
        element.style.color = resolved.color;
        element.style.borderColor = resolved.borderColor;
    }

    setAssetPackStatus(packName, status) {
        this.assetPackStatuses[packName] = status;
        localStorage.setItem(`eidolon.assetPack.${packName}`, status);
        const badgeState = status === 'cached'
            ? 'current'
            : status === 'downloading'
                ? 'downloading'
                : status === 'partial'
                    ? 'partial'
                    : 'not-cached';
        this.renderAssetPackBadge(packName, badgeState);
        this.refreshAssetDownloadStatus();
    }

    updateAssetDownloadProgress({ completed = 0, total = 0, percent = 0 } = {}) {
        const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));
        if (this.assetDownloadProgress) {
            if (total > 0) {
                this.assetDownloadProgress.textContent = `${clampedPercent}% (${completed}/${total})`;
            } else {
                this.assetDownloadProgress.textContent = `${clampedPercent}%`;
            }
        }
        if (this.assetDownloadProgressBar) {
            this.assetDownloadProgressBar.style.width = `${clampedPercent}%`;
        }
    }

    async refreshAssetCacheState() {
        try {
            const inspections = await Promise.all([
                this.assetCacheManager.inspectPack('core-models'),
                this.assetCacheManager.inspectPack('dungeon-models'),
                this.assetCacheManager.inspectPack('environment-textures')
            ]);

            for (const inspection of inspections) {
                if (inspection.cached) {
                    this.setAssetPackStatus(inspection.packName, 'cached');
                } else if (inspection.cachedCount > 0) {
                    this.assetPackStatuses[inspection.packName] = 'partial';
                } else {
                    this.assetPackStatuses[inspection.packName] = 'not-downloaded';
                }

                const badgeState = inspection.updateAvailable && inspection.cachedCount > 0
                    ? 'outdated'
                    : inspection.cached
                        ? 'current'
                        : inspection.cachedCount > 0
                            ? 'partial'
                            : 'not-cached';
                this.renderAssetPackBadge(inspection.packName, badgeState);

                if (inspection.packName === 'core-models' && !inspection.cached && inspection.cachedCount > 0 && this.assetPackCoreStatus) {
                    this.assetPackCoreStatus.textContent = `${inspection.cachedCount}/${inspection.total} cached`;
                }
                if (inspection.packName === 'dungeon-models' && !inspection.cached && inspection.cachedCount > 0 && this.assetPackDungeonStatus) {
                    this.assetPackDungeonStatus.textContent = `${inspection.cachedCount}/${inspection.total} cached`;
                }
                if (inspection.packName === 'environment-textures' && !inspection.cached && inspection.cachedCount > 0 && this.assetPackEnvironmentStatus) {
                    this.assetPackEnvironmentStatus.textContent = `${inspection.cachedCount}/${inspection.total} cached`;
                }
                this.renderAssetPackVersion(inspection.packName, inspection.cachedVersion || null, inspection.builtIn);
            }

            const staleCount = inspections.filter((inspection) => inspection.updateAvailable && inspection.cachedCount > 0).length;
            if (this.assetCacheStateDetail) {
                this.assetCacheStateDetail.textContent = staleCount > 0
                    ? `${staleCount} pack${staleCount === 1 ? '' : 's'} need refresh`
                    : 'Assets are up to date';
            }
        } catch (error) {
            if (this.assetCacheStateDetail) {
                this.assetCacheStateDetail.textContent = 'Cache inspection unavailable';
            }
        }
    }

    refreshAssetDownloadStatus() {
        if (this.assetPackCoreStatus) {
            this.assetPackCoreStatus.textContent = 'Procedural core built in';
        }
        if (this.assetPackDungeonStatus) {
            this.assetPackDungeonStatus.textContent = 'Procedural dungeon entrances built in';
        }
        if (this.assetPackEnvironmentStatus) {
            this.assetPackEnvironmentStatus.textContent = 'Procedural realm terrain built in';
        }
        if (this.assetDownloadStatus) {
            if (this.assetPackStatuses['core-models'] === 'downloading') {
                this.assetDownloadStatus.textContent = 'Preparing procedural core';
            } else if (this.assetPackStatuses['core-models'] === 'cached' && this.assetPackStatuses['dungeon-models'] === 'cached') {
                this.assetDownloadStatus.textContent = 'Procedural world art built in';
            } else if (this.assetPackStatuses['core-models'] === 'cached') {
                this.assetDownloadStatus.textContent = 'Procedural core built in';
            } else {
                this.assetDownloadStatus.textContent = 'Not downloaded';
            }
        }
    }

    async requestAssetDownload(packName) {
        this.setAssetPackStatus(packName, 'downloading');
        this.updateAssetDownloadProgress({ completed: 0, total: 0, percent: 0 });
        const defaultHandler = (nextPack) => this.assetCacheManager.warmPack(nextPack, {
            onProgress: (progress) => this.updateAssetDownloadProgress(progress)
        });
        const handler = this.onAssetDownloadRequest || defaultHandler;
        try {
            await handler(packName);
            this.setAssetPackStatus(packName, 'cached');
            this.markAssetsSynced();
            if (!this.onAssetDownloadRequest) {
                this.updateAssetDownloadProgress({ completed: 1, total: 1, percent: 100 });
            }
            await this.refreshAssetCacheState();
        } catch (error) {
            this.setAssetPackStatus(packName, 'not-downloaded');
            this.updateAssetDownloadProgress({ completed: 0, total: 0, percent: 0 });
            this.addChatMessage('System', `Failed to cache ${this.getAssetPackLabel(packName).toLowerCase()}.`);
            throw error;
        }
    }

    async downloadRecommendedAssets() {
        const recommendedPacks = getRecommendedAssetPackNames();
        for (const packName of recommendedPacks) {
            await this.requestAssetDownload(packName);
        }
        return recommendedPacks;
    }

    async refreshOutdatedAssets() {
        const outdatedPacks = await this.assetCacheManager.getOutdatedPacks();
        for (const packName of outdatedPacks) {
            await this.requestAssetDownload(packName);
        }
        if (this.assetDownloadStatus && outdatedPacks.length === 0) {
            this.assetDownloadStatus.textContent = 'Assets already up to date';
        }
        return outdatedPacks;
    }

    async updateCachedAssets() {
        const inspections = await Promise.all([
            this.assetCacheManager.inspectPack('core-models'),
            this.assetCacheManager.inspectPack('dungeon-models'),
            this.assetCacheManager.inspectPack('environment-textures')
        ]);
        const cachedPacks = inspections
            .filter((inspection) => !inspection.builtIn && (inspection.cached || inspection.cachedCount > 0))
            .map((inspection) => inspection.packName);

        for (const packName of cachedPacks) {
            await this.requestAssetDownload(packName);
        }

        if (this.assetDownloadStatus) {
            this.assetDownloadStatus.textContent = cachedPacks.length > 0
                ? 'Updated cached asset packs'
                : 'No cached asset packs to update';
        }

        return cachedPacks;
    }

    async clearCachedAssets() {
        const handler = this.onAssetCacheClearRequest || (() => this.assetCacheManager.clearAll());
        const result = await handler();
        this.setAssetPackStatus('core-models', 'cached');
        this.setAssetPackStatus('dungeon-models', 'cached');
        this.setAssetPackStatus('environment-textures', 'cached');
        this.updateAssetDownloadProgress({ completed: 0, total: 0, percent: 0 });
        if (this.assetDownloadStatus) {
            this.assetDownloadStatus.textContent = result?.cleared > 0 ? 'Cache cleared' : 'Nothing to clear';
        }
        if (this.assetCacheStateDetail) {
            this.assetCacheStateDetail.textContent = 'Assets are up to date';
        }
        return result;
    }

}

export function installUIManagerSettings(targetClass) {
    installPrototypeMethods(targetClass, UIManagerSettingsMethods);
}
