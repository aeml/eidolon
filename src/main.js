import { GameEngine } from './core/GameEngine.js';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;

const debugConsole = document.getElementById('debug-console');
function logToScreen(msg, type = 'INFO') {
    // Debug console disabled for mobile users
    /*
    if (debugConsole && isMobile) {
        debugConsole.style.display = 'block';
        debugConsole.textContent += `[${type}] ${msg}\n`;
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }
    */
}

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

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (!isLocalhost && !isMobile) {
    console.log = function() {};
} else {
    console.log("Debug Mode Enabled (Localhost or Mobile detected)");
}

window.addEventListener('DOMContentLoaded', () => {
    const debugConsole = document.getElementById('debug-console');
    
    const startScreen = document.getElementById('start-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingText = document.getElementById('loading-text');
    const buttons = document.querySelectorAll('.class-btn');
    
    const multiplayerToggle = document.getElementById('multiplayer-toggle');
    const serverInputContainer = document.getElementById('server-input-container');
    const serverAddressInput = document.getElementById('server-address');
    
    // Auth elements
    const authUsernameInput = document.getElementById('auth-username');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const authStatus = document.getElementById('auth-status');
    
    let authSocket = null;
    let isAuthenticated = false;

    const classSelectionContainer = document.getElementById('class-selection-container');
    const playContainer = document.getElementById('play-container');
    const btnPlayCharacter = document.getElementById('btn-play-character');
    let savedCharacterType = null;

    if (multiplayerToggle) {
        multiplayerToggle.addEventListener('change', (e) => {
            const isMulti = e.target.checked;
            serverInputContainer.style.display = isMulti ? 'block' : 'none';
            
            if (isMulti) {
                // Hide class selection until logged in
                classSelectionContainer.style.display = 'none';
                playContainer.style.display = 'none';
            } else {
                // Show class selection for single player
                classSelectionContainer.style.display = 'flex'; // Assuming flex
                playContainer.style.display = 'none';
            }
        });
    }

    // Simple Auth Logic
    const connectAuth = () => {
        if (authSocket && (authSocket.readyState === WebSocket.OPEN || authSocket.readyState === WebSocket.CONNECTING)) return;
        const addr = serverAddressInput.value;
        authSocket = new WebSocket(addr);
        
        authSocket.onopen = () => {
             console.log("Connected to server for auth");
        };

        authSocket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'error') {
                authStatus.textContent = msg.payload;
                authStatus.style.color = '#ff4444';
            } else if (msg.type === 'login_success') {
                isAuthenticated = true;
                
                const data = msg.payload;
                authStatus.textContent = data.message || "Logged in!";
                authStatus.style.color = '#4CAF50';
                
                // Disable auth inputs
                authUsernameInput.disabled = true;
                authEmailInput.disabled = true;
                authPasswordInput.disabled = true;
                btnLogin.disabled = true;
                btnRegister.disabled = true;

                if (data.hasCharacter) {
                    savedCharacterType = data.characterType;
                    playContainer.style.display = 'block';
                    classSelectionContainer.style.display = 'none';
                    btnPlayCharacter.textContent = `Play as ${savedCharacterType}`;
                } else {
                    playContainer.style.display = 'none';
                    classSelectionContainer.style.display = 'flex';
                }
            }
        };
        
        authSocket.onerror = (e) => {
            console.error("Auth socket error", e);
            authStatus.textContent = "Connection error";
            authStatus.style.color = '#ff4444';
        };
    };

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            connectAuth();
            // Wait for connection if needed
            const sendLogin = () => {
                if (authSocket.readyState === WebSocket.OPEN) {
                    authSocket.send(JSON.stringify({
                        type: 'login',
                        payload: {
                            username: authUsernameInput.value,
                            password: authPasswordInput.value
                        }
                    }));
                    authStatus.textContent = "Logging in...";
                    authStatus.style.color = '#ffeb3b';
                } else {
                    setTimeout(sendLogin, 100);
                }
            };
            sendLogin();
        });
    }

    if (btnRegister) {
        btnRegister.addEventListener('click', () => {
            connectAuth();
            const sendRegister = () => {
                if (authSocket.readyState === WebSocket.OPEN) {
                    authSocket.send(JSON.stringify({
                        type: 'register',
                        payload: {
                            username: authUsernameInput.value,
                            email: authEmailInput.value,
                            password: authPasswordInput.value
                        }
                    }));
                    authStatus.textContent = "Register request sent...";
                    authStatus.style.color = '#ffeb3b';
                } else {
                    setTimeout(sendRegister, 100);
                }
            };
            sendRegister();
        });
    }

    console.log('Main.js loaded. Waiting for user input...');

    const startGame = async (type) => {
        try {
            const isMultiplayer = multiplayerToggle ? multiplayerToggle.checked : false;
            const serverAddress = serverAddressInput ? serverAddressInput.value : '';
            const username = authUsernameInput ? authUsernameInput.value : '';

            if (isMultiplayer && !isAuthenticated) {
                alert("Please login first for multiplayer!");
                return;
            }

            console.log(`User selected: ${type}, Multiplayer: ${isMultiplayer}`);
            
            startScreen.classList.add('hidden');
            loadingScreen.style.display = 'flex';
            
            console.log(`Device Check: Mobile=${isMobile} (UA: ${navigator.userAgent}, Width: ${window.innerWidth})`);

            console.log("Creating GameEngine...");
            // Pass username and socket to GameEngine
            window.game = new GameEngine(type, isMobile, isMultiplayer, serverAddress, username, authSocket);
            
            console.log("Calling loadGame...");
            await window.game.loadGame((progress, text) => {
                loadingBarFill.style.width = `${progress}%`;
                if (text) loadingText.textContent = text;
            });
            console.log("loadGame finished.");

            loadingScreen.style.display = 'none';
            
            window.game.uiManager.togglePatchNotes();
            
            console.log(`Eidolon Engine Started with ${type}`);
        } catch (error) {
            console.error("Failed to start game:", error);
            alert("Error starting game. Check console for details.");
        }
    };

    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            startGame(type);
        });
    });

    if (btnPlayCharacter) {
        btnPlayCharacter.addEventListener('click', () => {
            if (savedCharacterType) {
                startGame(savedCharacterType);
            } else {
                alert("Character type not found!");
            }
        });
    }
});