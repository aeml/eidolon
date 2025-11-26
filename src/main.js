import { GameEngine } from './core/GameEngine.js';

window.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const buttons = document.querySelectorAll('.class-btn');

    console.log('Main.js loaded. Waiting for user input...');

    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            try {
                // Use currentTarget to ensure we get the button, not a child element
                const type = e.currentTarget.dataset.type;
                console.log(`User selected: ${type}`);
                
                // Hide UI
                startScreen.classList.add('hidden');
                
                // Start Game
                window.game = new GameEngine(type);
                console.log(`Eidolon Engine Started with ${type}`);
            } catch (error) {
                console.error("Failed to start game:", error);
                alert("Error starting game. Check console for details.");
            }
        });
    });
});