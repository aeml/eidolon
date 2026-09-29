import { AUDIO_CUES } from '../audio/AudioManager.js';
import { installPrototypeMethods } from '../core/PrototypeInstaller.js';
import { EnemyHealthBars } from './EnemyHealthBars.js';

class UIManagerWindowMethods {
    updateEnemyBars(entities, camera, hoveredEntity, isAltPressed, targetEntity = null) {
        this.enemyHealthBars ||= new EnemyHealthBars(this.uiLayer, this.floatingBars, this.isMobile);
        this.enemyHealthBars.reconcile(entities, hoveredEntity, isAltPressed, targetEntity);
    }

    updateEnemyBarPositions(camera) {
        this.enemyHealthBars?.updatePositions(camera);
    }

    clearEnemyBars() {
        this.enemyHealthBars?.clear();
    }

    get isEscMenuOpen() {
        return this.escMenu.style.display === 'block';
    }

    get isPatchNotesOpen() {
        return this.patchNotesScreen.style.display === 'flex';
    }

    get isInventoryOpen() { return this.inventory.isInventoryOpen; }

    get isCharacterSheetOpen() {
        return this.characterSheet.style.display === 'block';
    }

    get isShopOpen() { return this.inventory.isShopOpen; }
    get isStashOpen() { return this.inventory.isStashOpen; }

    closePrimaryHudMenus({ except = null } = {}) {
        const inventoryScreen = this.inventory?.inventoryScreen;
        const worldMap = document.getElementById('world-map');

        if (except !== 'character' && this.characterSheet?.style.display === 'block') {
            this.characterSheet.style.display = 'none';
        }
        if (except !== 'inventory' && inventoryScreen?.style.display === 'block') {
            inventoryScreen.style.display = 'none';
        }
        if (except !== 'social' && this.social?.isOpen) {
            this.social.toggleSocial(false);
        }
        if (except !== 'pvp' && this.pvp?.window?.style.display === 'block') {
            this.pvp.toggle(false);
        }
        if (except !== 'journal' && this.quest?.isJournalOpen) {
            this.quest.closeJournal();
        }
        if (except !== 'skills' && this.skillTree?.isOpen) {
            this.skillTree.close();
        }
        if (except !== 'abilities' && this.abilitiesMenu?.style.display === 'flex') {
            this.abilitiesMenu.style.display = 'none';
        }
        if (except !== 'map' && worldMap && (worldMap.style.display === 'flex' || worldMap.style.display === 'block')) {
            worldMap.style.display = 'none';
        }
    }

    registerWindowLayouts() {
        const worldMap = document.getElementById('world-map');
        this.windowLayouts = new Map([
            ['character', { element: this.characterSheet, display: 'block', group: 'primary', placement: 'leftCompanion' }],
            ['inventory', { element: this.inventory?.inventoryScreen, display: 'block', group: 'primary', placement: 'rightCompanion' }],
            ['shop', { element: this.inventory?.shopScreen, display: 'flex', group: 'service', placement: 'center' }],
            ['stash', { element: this.inventory?.stashScreen, display: 'flex', group: 'service', placement: 'center' }],
            ['forge', { element: this.forge?.forgeScreen, display: 'flex', group: 'service', placement: 'center' }],
            ['trading', { element: this.trading?.tradingHouseScreen, display: 'flex', group: 'service', placement: 'center' }],
            ['quest', { element: this.quest?.questWindow, display: 'flex', group: 'service', placement: 'center' }],
            ['journal', { element: this.quest?.questJournal, display: 'flex', group: 'primary', placement: 'center' }],
            ['skills', { element: this.skillTree?.skillTreeWindow, display: 'flex', group: 'primary', placement: 'center' }],
            ['abilities', { element: this.abilitiesMenu, display: 'flex', group: 'primary', placement: 'center' }],
            ['map', { element: worldMap, display: 'flex', group: 'primary', placement: 'center' }],
            ['social', { element: this.social?.socialWindow, display: 'block', group: 'primary', placement: 'center' }],
            ['pvp', { element: this.pvp?.window, display: 'block', group: 'primary', placement: 'center' }],
            ['help', { element: this.helpScreen, display: 'flex', group: 'modal', placement: 'center' }],
            ['administration', { element: this.admin?.root, display: 'flex', group: 'modal', placement: 'center' }],
            ['settings', { element: this.settingsScreen, display: this.isMobile ? 'flex' : 'block', group: 'modal', placement: 'center' }],
            ['report', { element: this.reportScreen, display: 'block', group: 'modal', placement: 'center' }],
            ['patchNotes', { element: this.patchNotesScreen, display: 'flex', group: 'modal', placement: 'center' }]
        ]);
        this.windowLayouts.forEach(({ element, group }, id) => {
            // The fullscreen world map owns a separate overlay layer.
            if (element && id !== 'map') {
                element.dataset.windowLayer = group === 'modal' ? 'modal' : 'panel';
            }
        });
        // Windows are opened before some of their contents arrive/render. A
        // size change must re-clamp the populated panel, not just its empty
        // placeholder. Position-only reflow does not retrigger this observer.
        this.windowLayoutObserver?.disconnect();
        if (typeof ResizeObserver !== 'undefined') {
            this.windowLayoutObserver = new ResizeObserver(() => this.reflowVisibleWindows());
            this.windowLayouts.forEach(({ element }) => {
                if (element) this.windowLayoutObserver.observe(element);
            });
        }
    }

    isWindowOpen(id) {
        const layout = this.windowLayouts?.get(id);
        return this.isElementVisible(layout?.element);
    }

    unlockAudio() {
        return this.audioManager?.unlock?.() || false;
    }

    playAudioCue(cueName, options = {}) {
        return this.audioManager?.play?.(cueName, options) || false;
    }

    playUICue(cueName) {
        this.unlockAudio();
        return this.playAudioCue(cueName);
    }

    setupAudioInteractionCues() {
        if (this.audioInteractionCuesSetup) return;
        this.audioInteractionCuesSetup = true;
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!target?.closest) return;
            const interactive = target.closest('button, .hud-menu-btn, .class-btn, .auth-btn, .start-version-row__link, input, select, textarea');
            if (interactive) {
                this.playUICue(AUDIO_CUES.uiClick);
            }
        }, true);
    }

    getOpenWindowIds(group = null) {
        if (!this.windowLayouts) return [];
        return [...this.windowLayouts.entries()]
            .filter(([, layout]) => (!group || layout.group === group) && this.isElementVisible(layout.element))
            .map(([id]) => id);
    }

    shouldUseCompanionServiceLayout() {
        return window.innerWidth >= 960;
    }

    prepareWindowForLayout(element) {
        if (!element) return;
        element.style.position = 'fixed';
        element.style.margin = '0';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transformOrigin = 'center center';
    }

    centerWindow(element) {
        this.prepareWindowForLayout(element);
        element.style.left = '50%';
        element.style.top = '50%';
        element.style.transform = 'translate(-50%, -50%)';
    }

    placeWindowPair(primaryElement, companionElement) {
        this.prepareWindowForLayout(primaryElement);
        this.prepareWindowForLayout(companionElement);

        const gap = 16;
        const primaryRect = primaryElement.getBoundingClientRect();
        const companionRect = companionElement.getBoundingClientRect();
        const totalWidth = primaryRect.width + companionRect.width + gap;
        const left = Math.max(12, Math.round((window.innerWidth - totalWidth) / 2));
        const top = Math.max(12, Math.round((window.innerHeight - Math.max(primaryRect.height, companionRect.height)) / 2));

        primaryElement.style.left = `${left}px`;
        primaryElement.style.top = `${top}px`;
        primaryElement.style.transform = 'none';
        companionElement.style.left = `${left + primaryRect.width + gap}px`;
        companionElement.style.top = `${top}px`;
        companionElement.style.transform = 'none';
        this.clampWindowToViewport(primaryElement);
        this.clampWindowToViewport(companionElement);
    }

    clampWindowToViewport(element) {
        if (!element || !this.isElementVisible(element)) return;

        const margin = 12;
        const rect = element.getBoundingClientRect();
        let left = rect.left;
        let top = rect.top;
        const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
        const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

        if (rect.width <= window.innerWidth - margin * 2) {
            left = Math.min(Math.max(left, margin), maxLeft);
        } else {
            left = margin;
        }

        if (rect.height <= window.innerHeight - margin * 2) {
            top = Math.min(Math.max(top, margin), maxTop);
        } else {
            top = margin;
        }

        element.style.position = 'fixed';
        element.style.left = `${Math.round(left)}px`;
        element.style.top = `${Math.round(top)}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'none';
    }

    openManagedWindow(id, { keepCompanion = false, silent = false } = {}) {
        const layout = this.windowLayouts?.get(id);
        if (!layout?.element) return;
        const wasOpen = this.isElementVisible(layout.element);

        if (layout.group === 'primary') {
            const companionId = id === 'character'
                ? 'inventory'
                : id === 'inventory'
                    ? 'character'
                    : null;
            this.closeManagedGroup('primary', { except: companionId ? [id, companionId] : id });
        }

        if (layout.group === 'service') {
            this.closeManagedGroup('primary');
            this.closeManagedGroup('service', { except: id });
            this.closeAllStaticModals();
        }

        if (layout.group === 'modal') {
            this.closeManagedGroup('service');
            this.closeManagedGroup('primary');
        }

        layout.element.style.display = layout.display;

        if (!silent && !wasOpen) {
            this.playUICue(AUDIO_CUES.uiOpen);
        }

        if (keepCompanion && this.inventory?.inventoryScreen) {
            this.inventory.inventoryScreen.style.display = 'block';
        }

        this.reflowVisibleWindows();
    }

    closeManagedWindow(id, { silent = false } = {}) {
        const details = this.inventory?.mobileDetails;
        if ((id === 'inventory' && details?.source?.type === 'inventory')
            || (id === 'character' && details?.source?.type === 'equipment')) details.close();
        const layout = this.windowLayouts?.get(id);
        if (layout?.element) {
            const wasOpen = this.isElementVisible(layout.element);
            layout.element.style.display = 'none';
            if (!silent && wasOpen) {
                this.playUICue(AUDIO_CUES.uiClose);
            }
        }
        if (id === 'social' && this.social?.partyPanel && !this.social.inParty) {
            this.social.setPartyPanelVisible(false);
        }
    }

    closeManagedGroup(group, { except = null } = {}) {
        if (!this.windowLayouts) return;
        const excludedIds = new Set(Array.isArray(except) ? except : [except]);
        this.windowLayouts.forEach((layout, id) => {
            if (!excludedIds.has(id) && layout.group === group && layout.element) {
                this.closeManagedWindow(id, { silent: true });
            }
        });
    }

    toggleManagedWindow(id, options = {}) {
        if (this.isWindowOpen(id)) {
            this.closeManagedWindow(id);
            this.reflowVisibleWindows();
            return false;
        }

        this.openManagedWindow(id, options);
        return true;
    }

    reflowVisibleWindows() {
        if (!this.windowLayouts) return;

        const openService = this.getOpenWindowIds('service');
        const serviceId = openService[0] || null;
        const serviceLayout = serviceId ? this.windowLayouts.get(serviceId) : null;
        const inventoryElement = this.inventory?.inventoryScreen;
        const serviceWithInventory = serviceLayout?.element && inventoryElement && this.isElementVisible(inventoryElement);
        const characterElement = this.characterSheet;
        const characterWithInventory = characterElement && inventoryElement &&
            this.isElementVisible(characterElement) && this.isElementVisible(inventoryElement);

        if (serviceWithInventory && this.shouldUseCompanionServiceLayout()) {
            this.placeWindowPair(serviceLayout.element, inventoryElement);
        } else if (serviceLayout?.element) {
            this.centerWindow(serviceLayout.element);
            if (inventoryElement && serviceId !== 'inventory') {
                inventoryElement.style.display = 'none';
            }
        }

        if (!serviceLayout?.element && characterWithInventory && this.shouldUseCompanionServiceLayout()) {
            this.placeWindowPair(characterElement, inventoryElement);
        }

        this.windowLayouts.forEach((layout, id) => {
            if (!layout.element || !this.isElementVisible(layout.element)) return;
            if (layout.group === 'service') return;
            if (id === 'inventory' && serviceWithInventory && this.shouldUseCompanionServiceLayout()) return;
            if ((id === 'character' || id === 'inventory') && characterWithInventory &&
                this.shouldUseCompanionServiceLayout()) return;
            if (!layout.element.dataset.draggedWindow &&
                (layout.placement === 'center' || layout.placement.endsWith('Companion'))) {
                this.centerWindow(layout.element);
            }
            this.clampWindowToViewport(layout.element);
        });
    }

    toggleCharacterSheet() {
        const isHidden = this.characterSheet.style.display === 'none' || this.characterSheet.style.display === '';
        this.toggleManagedWindow('character');

        if (isHidden && this.lastPlayerRef) {
            this.lastCharacterSheetSignature = '';
            this.updateCharacterSheet(this.lastPlayerRef);
        }
    }

    isElementVisible(element) {
        return Boolean(element && element.style.display !== 'none' && element.style.display !== '');
    }

    getStaticModalWindows() {
        return [this.patchNotesScreen, this.settingsScreen, this.reportScreen, this.helpScreen, this.admin?.root].filter(Boolean);
    }

    ensureStaticModalBackdrop() {
        let backdrop = document.getElementById('ui-static-modal-backdrop');
        if (backdrop) {
            return backdrop;
        }

        backdrop = document.createElement('div');
        backdrop.id = 'ui-static-modal-backdrop';
        backdrop.addEventListener('click', () => this.closeOpenStaticModal());
        (this.uiLayer || document.getElementById('ui-layer') || document.body).appendChild(backdrop);
        return backdrop;
    }

    syncStaticModalBackdrop() {
        const backdrop = document.getElementById('ui-static-modal-backdrop');
        if (this.getStaticModalWindows().some((windowElement) => this.isElementVisible(windowElement))) {
            this.ensureStaticModalBackdrop();
            return;
        }

        backdrop?.remove();
    }

    closeStaticModal(element) {
        if (!this.isElementVisible(element)) {
            return false;
        }

        element.style.display = 'none';
        this.playUICue(AUDIO_CUES.uiClose);
        this.syncStaticModalBackdrop();
        return true;
    }

    closeAllStaticModals() {
        let closedAny = false;
        this.getStaticModalWindows().forEach((windowElement) => {
            if (this.isElementVisible(windowElement)) {
                windowElement.style.display = 'none';
                closedAny = true;
            }
        });
        this.syncStaticModalBackdrop();
        return closedAny;
    }

    closeOpenStaticModal() {
        for (const windowElement of [...this.getStaticModalWindows()].reverse()) {
            if (this.closeStaticModal(windowElement)) {
                return true;
            }
        }

        return false;
    }

    toggleStaticModal(element, openDisplay = 'block') {
        if (!element) {
            return;
        }

        const isHidden = !this.isElementVisible(element);
        if (isHidden) {
            this.closeManagedGroup?.('service');
            this.closeManagedGroup?.('primary');
            this.getStaticModalWindows().forEach((windowElement) => {
                if (windowElement && windowElement !== element) {
                    windowElement.style.display = 'none';
                }
            });
            element.style.display = openDisplay;
            this.playUICue(AUDIO_CUES.uiOpen);
        } else {
            element.style.display = 'none';
            this.playUICue(AUDIO_CUES.uiClose);
        }

        this.syncStaticModalBackdrop();
        if (isHidden) {
            this.reflowVisibleWindows();
        }
    }

    // --- Inventory delegates (InventoryUI module) ---
}

export function installUIManagerWindows(targetClass) {
    installPrototypeMethods(targetClass, UIManagerWindowMethods);
}
