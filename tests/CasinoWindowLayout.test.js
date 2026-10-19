import { jest } from '@jest/globals';
import { clampCasinoWindow, CasinoWindowLayout } from '../src/ui/CasinoWindowLayout.js';
import { WindowLayoutPreferences } from '../src/ui/WindowLayoutPreferences.js';
import { CasinoInfoDialog } from '../src/ui/CasinoInfoDialog.js';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('large casino windows remain reachable at every edge and after viewport shrink', () => {
    expect(clampCasinoWindow(-500, -600, 900, 600, 1000, 700)).toEqual({ left:8, top:8 });
    expect(clampCasinoWindow(500, 600, 900, 600, 1000, 700)).toEqual({ left:92, top:92 });
    expect(clampCasinoWindow(100, 100, 304, 724, 320, 740)).toEqual({ left:8, top:8 });
});

test('header keyboard movement persists without erasing other menu positions and reset centers the live window', () => {
    const root = document.createElement('section'), header = document.createElement('header'); root.append(header); document.body.append(root);
    const prefs = new WindowLayoutPreferences(); prefs.remember('inventory','wide',{left:40,top:50});
    const layout = new CasinoWindowLayout(root,header,prefs);
    root.getBoundingClientRect = () => ({ left:parseFloat(root.style.left)||0,top:parseFloat(root.style.top)||0,width:800,height:500 });
    try {
        layout.restore(); const before = parseFloat(root.style.left);
        header.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
        expect(parseFloat(root.style.left)).toBe(before+12);
        expect(prefs.get('inventory','wide')).toEqual({left:40,top:50});
        const remembered=prefs.get('casino','wide'); layout.place(8,8); layout.restore();
        expect(parseFloat(root.style.left)).toBe(remembered.left);
        layout.reset(); expect(parseFloat(root.style.left)).toBe((innerWidth-800)/2);
        layout.dispose(); const left=root.style.left;
        header.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); expect(root.style.left).toBe(left);
    } finally { layout.dispose(); root.remove(); }
});

test('rules open in a separate popup, restore focus, and dispose closes all owned UI', () => {
    const info = new CasinoInfoDialog('Roulette rules'); document.body.append(info.button);
    try {
        info.body.textContent='Single zero roulette.'; info.button.click();
        expect(info.root.open).toBe(true); expect(info.root.getAttribute('aria-label')).toBe('Roulette rules');
        expect(document.activeElement).toBe(info.closeButton); info.closeButton.click();
        expect(info.root.open).toBe(false); expect(document.activeElement).toBe(info.button);
        info.button.click(); info.dispose(); expect(info.root.isConnected).toBe(false);
        info.button.click(); expect(info.root.open).toBe(false);
    } finally { info.dispose(); info.button.remove(); }
});
