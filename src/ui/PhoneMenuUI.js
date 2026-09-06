// Compose existing phone navigation controls; their input callbacks and
// authoritative actions stay owned by InputManager and UIManager.
export class PhoneMenuUI {
    constructor(menu, closeMenu) {
        menu._phoneCloseMenu = closeMenu;
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
            // Close before the existing control callback opens its destination.
            for (const event of ['touchstart', 'click']) {
                button.addEventListener(event, () => menu._phoneCloseMenu?.(), { capture: true });
            }
        }
        actions.prepend(navigation);
    }
}
