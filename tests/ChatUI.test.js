import { jest } from '@jest/globals';
import { ChatUI } from '../src/ui/ChatUI.js';

function buildChatDom() {
    document.body.innerHTML = `
        <div id="chat-box" style="display:none">
            <div class="chat-tabs" role="tablist">
                <button class="chat-tab chat-tab--active" data-chat-tab="chat" aria-selected="true">
                    Chat <span data-chat-unread hidden></span>
                </button>
                <button class="chat-tab" data-chat-tab="game" aria-selected="false">
                    Game <span data-chat-unread hidden></span>
                </button>
            </div>
            <div id="chat-messages"></div>
            <div id="chat-composer"><input id="chat-input" /></div>
        </div>
    `;
}

describe('ChatUI', () => {
    beforeEach(() => {
        localStorage.clear();
        buildChatDom();
    });

    test('separates communication and character game events into switchable tabs', () => {
        const chat = new ChatUI();

        chat.addMessage('Ayla', 'Meet at the gate', { channel: 'global' });
        chat.addMessage('Loot', 'Rare: Radiant Ruby', { stream: 'game' });

        const [communication, gameEvent] = document.querySelectorAll('.chat-message');
        const gameTab = document.querySelector('[data-chat-tab="game"]');

        expect(communication.dataset.chatStream).toBe('chat');
        expect(communication.textContent).toContain('[Global]');
        expect(communication.hidden).toBe(false);
        expect(gameEvent.dataset.chatStream).toBe('game');
        expect(gameEvent.hidden).toBe(true);
        expect(gameTab.classList.contains('chat-tab--unread')).toBe(true);
        expect(gameTab.querySelector('[data-chat-unread]').textContent).toBe('1');

        gameTab.click();

        expect(communication.hidden).toBe(true);
        expect(gameEvent.hidden).toBe(false);
        expect(document.getElementById('chat-composer').hidden).toBe(true);
        expect(gameTab.getAttribute('aria-selected')).toBe('true');
        expect(gameTab.classList.contains('chat-tab--unread')).toBe(false);
    });

    test('sends trimmed communication from the Chat composer', () => {
        const onSend = jest.fn();
        new ChatUI({ onSend });
        const input = document.getElementById('chat-input');
        input.value = '  hello world  ';

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(onSend).toHaveBeenCalledWith('hello world');
        expect(input.value).toBe('');
    });

    test('restores a remembered desktop size within the current viewport', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
        localStorage.setItem('eidolon.chatSize', JSON.stringify({ width: 460, height: 320 }));

        new ChatUI();

        expect(document.getElementById('chat-box').style.width).toBe('460px');
        expect(document.getElementById('chat-box').style.height).toBe('320px');
    });
});
