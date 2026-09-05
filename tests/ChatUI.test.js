import { jest } from '@jest/globals';
import { ChatUI } from '../src/ui/ChatUI.js';

function buildChatDom() {
    document.body.innerHTML = `
        <div id="chat-box" style="display:none">
            <div class="chat-tabs" role="tablist">
                <button class="chat-tab chat-tab--active" data-chat-tab="chat" aria-selected="true">
                    All <span data-chat-unread hidden></span>
                </button>
                <button class="chat-tab" data-chat-tab="party" aria-selected="false">
                    Party <span data-chat-unread hidden></span>
                </button>
                <button class="chat-tab" data-chat-tab="whisper" aria-selected="false">
                    Whispers <span data-chat-unread hidden></span>
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
        expect(document.getElementById('chat-box').style.display).toBe('flex');
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

    test('arrow, Home and End keys navigate channel tabs without moving focus to the composer', () => {
        const chat = new ChatUI();
        chat.show();
        chat.tabs[0].focus();
        for (const [key, stream] of [['ArrowLeft', 'game'], ['Home', 'chat'], ['ArrowRight', 'party'], ['End', 'game']]) {
            document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            expect(chat.activeStream).toBe(stream);
            expect(document.activeElement.dataset.chatTab).toBe(stream);
            expect(document.querySelectorAll('.chat-tab[tabindex="0"]')).toHaveLength(1);
        }
        expect(document.getElementById('chat-box').style.display).toBe('flex');
    });

    test('game events do not force pre-session chat open and gameplay chat cannot be dismissed', () => {
        const chat = new ChatUI();
        const chatBox = document.getElementById('chat-box');

        chat.addMessage('Experience', '+50 XP', { stream: 'game' });
        expect(chatBox.style.display).toBe('none');

        chat.addMessage('Server', 'Welcome back', { channel: 'server' });
        expect(chatBox.style.display).toBe('flex');

        chat.show(false);
        chat.addMessage('Server', 'Delayed reply', { channel: 'server' });
        expect(chatBox.style.display).toBe('flex');

        chat.focusChatInput();
        expect(chatBox.style.display).toBe('flex');
        expect(document.activeElement).toBe(document.getElementById('chat-input'));
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

    test('filters party and whisper channels and Escape returns to All', () => {
        const chat = new ChatUI();
        chat.addMessage('Ayla', 'world route', { channel: 'world' });
        chat.addMessage('Borin', 'party route', { channel: 'party' });
        chat.addMessage('Cyra', 'quiet route', { channel: 'whisper' });

        document.querySelector('[data-chat-tab="party"]').click();
        let entries = Array.from(document.querySelectorAll('.chat-message'));
        expect(entries.map((entry) => entry.hidden)).toEqual([true, false, true]);

        document.querySelector('[data-chat-tab="whisper"]').click();
        entries = Array.from(document.querySelectorAll('.chat-message'));
        expect(entries.map((entry) => entry.hidden)).toEqual([true, true, false]);

        const input = document.getElementById('chat-input');
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(chat.activeStream).toBe('chat');
        expect(entries.every((entry) => !entry.hidden)).toBe(true);
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
