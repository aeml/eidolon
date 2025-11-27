import { GameEngine } from './core/GameEngine.js';

// Detect Mobile Early
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;

// Debug Console Logic
const debugConsole = document.getElementById('debug-console');
function logToScreen(msg, type = 'INFO') {
    if (debugConsole) {
        debugConsole.style.display = 'block';
        debugConsole.textContent += `[${type}] ${msg}\n`;
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }
}

// Override console methods to capture logs
const originalConsoleError = console.error;
console.error = function(...args) {
    originalConsoleError.apply(console, args);
    logToScreen(args.join(' '), 'ERROR');
};

const originalConsoleWarn = console.warn;
console.warn = function(...args) {
    originalConsoleWarn.apply(console, args);
    logToScreen(args.join(' '), 'WARN');
};

// Capture Logs on Mobile (even in production)
if (isMobile) {
    const originalConsoleLog = console.log;
    console.log = function(...args) {
        originalConsoleLog.apply(console, args);
        logToScreen(args.join(' '), 'LOG');
    };
}

window.onerror = function(message, source, lineno, colno, error) {
    logToScreen(`${message} at ${source}:${lineno}:${colno}`, 'CRITICAL');
    return false; 
};

window.addEventListener('unhandledrejection', function(event) {
    logToScreen(`Unhandled Rejection: ${event.reason}`, 'CRITICAL');
});

// Environment Check for Debugging
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (!isLocalhost && !isMobile) {
    // Disable console.log in production desktop only
    console.log = function() {};
} else {
    console.log("Debug Mode Enabled (Localhost or Mobile detected)");
}

window.addEventListener('DOMContentLoaded', () => {
    // Re-fetch debug console in case DOM wasn't ready
    const debugConsole = document.getElementById('debug-console');
    
    const startScreen = document.getElementById('start-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingText = document.getElementById('loading-text');
    const buttons = document.querySelectorAll('.class-btn');

    console.log('Main.js loaded. Waiting for user input...');

    buttons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            try {
                // Use currentTarget to ensure we get the button, not a child element
                const type = e.currentTarget.dataset.type;
                console.log(`User selected: ${type}`);
                
                // Hide UI
                startScreen.classList.add('hidden');
                loadingScreen.style.display = 'flex';
                
                console.log(`Device Check: Mobile=${isMobile} (UA: ${navigator.userAgent}, Width: ${window.innerWidth})`);

                // Start Game
                console.log("Creating GameEngine...");
                window.game = new GameEngine(type, isMobile);
                
                console.log("Calling loadGame...");
                await window.game.loadGame((progress, text) => {
                    loadingBarFill.style.width = `${progress}%`;
                    if (text) loadingText.textContent = text;
                });
                console.log("loadGame finished.");

                loadingScreen.style.display = 'none';
                
                // Show Patch Notes on Launch
                window.game.uiManager.togglePatchNotes();
                
                console.log(`Eidolon Engine Started with ${type}`);
            } catch (error) {
                console.error("Failed to start game:", error);
                alert("Error starting game. Check console for details.");
                loadingScreen.style.display = 'none';
                startScreen.classList.remove('hidden');
            }
        });
    });
});