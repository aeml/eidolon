import { GameEngine } from './core/GameEngine.js';

// Environment Check for Debugging
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (!isLocalhost) {
    // Disable console.log in production/non-localhost environments
    console.log = function() {};
    // We keep console.warn and console.error for critical issues
} else {
    console.log("Debug Mode Enabled (Localhost detected)");
}

window.addEventListener('DOMContentLoaded', () => {
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
                
                // Check for Mobile
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                console.log(`Device Check: Mobile=${isMobile}`);

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