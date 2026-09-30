// Compose existing phone navigation controls; their input callbacks and
// authoritative actions stay owned by InputManager and UIManager.
import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

export class PhoneMenuUI {
    constructor(menu, closeMenu) {
        menu.__eidolonPhoneMenu?.dispose();
        this.menu = menu;
        menu.__eidolonPhoneMenu = this;
        for (const id of ['btn-mobile-inv', 'btn-mobile-char', 'btn-mobile-quest', 'btn-mobile-map', 'btn-mobile-social']) {
            for (const event of ['touchstart', 'click']) {
                ownedEvent(this, document.getElementById(id), event, closeMenu, { capture: true });
            }
        }
        if (menu.querySelector('.phone-navigation')) return;
        const header = menu.querySelector('.window-header');
        const actions = menu.querySelector('.pause-menu__actions');
        if (!header || !actions) return;
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-label', 'Game menu');
        const launcher = document.getElementById('btn-mobile-menu');
        launcher?.setAttribute('aria-controls', menu.id);
        launcher?.setAttribute('aria-expanded', 'false');
        header.textContent = 'MENU';
        const resume = document.getElementById('btn-resume');
        if (resume) { resume.textContent = 'Back to game'; header.append(resume); }
        const navigation = document.createElement('nav');
        navigation.className = 'phone-navigation';
        navigation.setAttribute('aria-label', 'Adventure menus');
        for (const [id, label] of [
            ['btn-mobile-inv', 'Bag'], ['btn-mobile-char', 'Hero'],
            ['btn-mobile-quest', 'Quests'], ['btn-mobile-map', 'World map'],
            ['btn-mobile-social', 'Social & party']
        ]) {
            const button = document.getElementById(id);
            if (!button) continue;
            button.textContent = label;
            navigation.append(button);
        }
        actions.prepend(navigation);
    }

    dispose() {
        disposeOwnedEvents(this);
        if (this.menu.__eidolonPhoneMenu === this) delete this.menu.__eidolonPhoneMenu;
    }
}
