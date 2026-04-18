import { GameEngine } from './core/GameEngine.js';
import { AssetCacheManager } from './assets/AssetCacheManager.js';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isMobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800);
const urlParams = new URLSearchParams(window.location.search);
const debugMode = urlParams.get('debug') === '1' || isLocalhost;
const perfOverlayEnabled = urlParams.get('perf') === '1' || debugMode;
const FULLSCREEN_STORAGE_KEY = 'eidolon.fullscreenEnabled';

function getStoredFullscreenPreference() {
    return localStorage.getItem(FULLSCREEN_STORAGE_KEY) === 'true';
}

async function syncFullscreenPreference(enabled) {
    if (enabled) {
        if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
            try {
                await document.documentElement.requestFullscreen();
            } catch (error) {
                console.warn('Fullscreen request failed', error);
            }
        }
        return;
    }

    if (document.fullscreenElement && document.exitFullscreen) {
        try {
            await document.exitFullscreen();
        } catch (error) {
            console.warn('Fullscreen exit failed', error);
        }
    }
}

let suppressNextFullscreenExitMenu = false;


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

const originalConsoleLog = console.log;
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
    document.body.classList.add('mobile-mode');
    console.log = function(...args) {
        originalConsoleLog.apply(console, args);
        logToScreen(args.join(' '), 'LOG');
    };
}

// Keep .mobile-mode class in sync with viewport width so CSS rules apply
// even when the browser is resized after initial load.
const mobileMediaQuery = window.matchMedia('(max-width: 800px)');
function handleMobileMediaChange(e) {
    if (e.matches) {
        document.body.classList.add('mobile-mode');
    } else if (!isMobile) {
        // Only remove if not a genuine mobile device (UA detected).
        // This preserves .mobile-mode on real mobile devices that might
        // temporarily report a wider viewport (e.g. landscape iPad).
        document.body.classList.remove('mobile-mode');
    }
}
mobileMediaQuery.addEventListener('change', handleMobileMediaChange);

window.onerror = function(message, source, lineno, colno, error) {
    logToScreen(`${message} at ${source}:${lineno}:${colno}`, 'CRITICAL');
    return false; 
};

window.addEventListener('unhandledrejection', function(event) {
    logToScreen(`Unhandled Rejection: ${event.reason}`, 'CRITICAL');
});

window.addEventListener('DOMContentLoaded', () => {
    void syncFullscreenPreference(false);
    void AssetCacheManager.registerServiceWorker().catch((error) => {
        console.warn('Asset service worker registration failed', error);
    });

    const debugConsole = document.getElementById('debug-console');
    const perfOverlay = document.getElementById('perf-overlay');
    
    const startScreen = document.getElementById('start-screen');

    const loadingScreen = document.getElementById('loading-screen');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingText = document.getElementById('loading-text');
    const buttons = document.querySelectorAll('.class-btn');
    
    // const multiplayerToggle = document.getElementById('multiplayer-toggle'); // Removed
    // const serverInputContainer = document.getElementById('server-input-container'); // Removed
    const serverAddressInput = document.getElementById('server-address');
    
    // Auth elements
    const authUsernameInput = document.getElementById('auth-username');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const authStatus = document.getElementById('auth-status');
    const loginPanel = document.getElementById('login-panel');
    
    let authSocket = null;
    let isAuthenticated = false;

    const classSelectionContainer = document.getElementById('class-selection-container');
    const playContainer = document.getElementById('play-container');
    const btnPlayCharacter = document.getElementById('btn-play-character');
    const loginPatchNotesLink = document.getElementById('login-patch-notes-link');
    const patchNotesScreen = document.getElementById('patch-notes-screen');
    const btnClosePatchNotes = document.getElementById('btn-close-patch-notes');
    const btnClosePatchNotesHeader = document.getElementById('btn-close-patch-notes-header');
    const browserWarning = document.getElementById('browser-warning');
    const btnCloseBrowserWarning = document.getElementById('btn-close-browser-warning');
    let hadFullscreen = Boolean(document.fullscreenElement);

    document.addEventListener('fullscreenchange', () => {
        const isFullscreen = Boolean(document.fullscreenElement);
        const exitedFullscreen = hadFullscreen && !isFullscreen;
        hadFullscreen = isFullscreen;

        if (!exitedFullscreen) {
            return;
        }

        if (suppressNextFullscreenExitMenu) {
            suppressNextFullscreenExitMenu = false;
            return;
        }

        const game = window.game;
        const uiManager = game?.uiManager;
        const gameIsActive = startScreen?.classList?.contains('hidden') && loadingScreen?.style?.display !== 'flex';
        if (!game || !uiManager || !gameIsActive) {
            return;
        }

        uiManager.handleEscape?.();
    });

    const closePatchNotes = () => {
        if (patchNotesScreen) {
            patchNotesScreen.style.display = 'none';
        }
    };

    if (loginPatchNotesLink) {
        loginPatchNotesLink.addEventListener('click', () => {
            if (patchNotesScreen) {
                patchNotesScreen.style.display = 'flex';
            }
        });
    }

    if (btnCloseBrowserWarning) {
        btnCloseBrowserWarning.addEventListener('click', () => {
            if (browserWarning) {
                browserWarning.style.display = 'none';
            }
        });
    }

    [btnClosePatchNotes, btnClosePatchNotesHeader].forEach((button) => {
        if (button) {
            button.addEventListener('click', closePatchNotes);
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && patchNotesScreen && patchNotesScreen.style.display === 'flex') {
            closePatchNotes();
        }
    });

    let savedCharacterType = null;

    const startFlowTitle = document.getElementById('start-flow-title');
    const startFlowCopy = document.getElementById('start-flow-copy');
    const startFlowSteps = document.getElementById('start-flow-steps');

    const updateStartFlow = ({ title, copy, steps } = {}) => {
        if (startFlowTitle && title) startFlowTitle.textContent = title;
        if (startFlowCopy && copy) startFlowCopy.textContent = copy;
        if (startFlowSteps && steps) startFlowSteps.textContent = steps;
    };

    const showReturningPlayerFlow = (characterType) => {
        updateStartFlow({
            title: 'Continue your character',
            copy: `Enter world as ${characterType}, get your bearings in town, then push back into quests or dungeons.`,
            steps: '1. Enter world. 2. Open quests (J). 3. Follow the objective tracker or world map to your next stop.'
        });
    };

    const showNewPlayerFlow = () => {
        updateStartFlow({
            title: 'Create your first character',
            copy: 'Choose a class, enter town, head to the Quest Giver by the Forge, and follow the quest tracker through your first combat and dungeon steps. Common gear is usually junk to Vendor / Repair, better gear is worth checking, and Shards, Hearts, and Gems are forging materials worth keeping.',
            steps: 'Recommended starter picks: Fighter for the cleanest first run, Rogue for mobility, Wizard for ranged burst, Cleric for sustain. Then open World Map (M) or Journal (J), head to the Quest Giver by the Forge, vendor obvious junk, save Shards, Hearts, and Gems, reach level 30 to unlock all base dungeons, and push to level 100 for Heroic and Mythic runs.'
        });
    };

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
                
                // Hide login panel
                if (loginPanel) loginPanel.style.display = 'none';

                if (data.hasCharacter) {
                    savedCharacterType = data.characterType;
                    playContainer.style.display = 'block';
                    classSelectionContainer.style.display = 'none';
                    btnPlayCharacter.textContent = `ENTER WORLD (${savedCharacterType})`;
                    showReturningPlayerFlow(savedCharacterType);
                } else {
                    playContainer.style.display = 'none';
                    classSelectionContainer.style.display = 'flex';
                    showNewPlayerFlow();
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

        // Allow Enter key to trigger login
        const handleLoginEnter = (e) => {
            if (e.key === 'Enter') {
                btnLogin.click();
            }
        };
        if (authUsernameInput) authUsernameInput.addEventListener('keydown', handleLoginEnter);
        if (authPasswordInput) authPasswordInput.addEventListener('keydown', handleLoginEnter);
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
            const isMultiplayer = true; // Always multiplayer
            const serverAddress = serverAddressInput ? serverAddressInput.value : '';
            const username = authUsernameInput ? authUsernameInput.value : '';

            if (!isAuthenticated) {
                alert("Please login first!");
                return;
            }

            console.log(`User selected: ${type}, Multiplayer: ${isMultiplayer}`);
            
            startScreen.classList.add('hidden');
            loadingScreen.style.display = 'flex';
            if (getStoredFullscreenPreference()) {
                await syncFullscreenPreference(true);
            }
            
            console.log(`Device Check: Mobile=${isMobile} (UA: ${navigator.userAgent}, Width: ${window.innerWidth})`);

            console.log("Creating GameEngine...");
            if (window.game) {
                console.log("Destroying previous GameEngine instance...");
                window.game.destroy();
            }
            // Pass username and socket to GameEngine
            window.game = new GameEngine(type, isMobile, isMultiplayer, serverAddress, username, authSocket);
            if (window.game?.uiManager) {
                const existingFullscreenChange = window.game.uiManager.onFullscreenChange;
                const existingEscMenuChange = window.game.uiManager.onEscMenuChange;
                const existingEscMenuClosedByEscape = window.game.uiManager.onEscMenuClosedByEscape;
                window.game.uiManager.onFullscreenChange = (enabled) => {
                    existingFullscreenChange?.(enabled);
                    if (!enabled && document.fullscreenElement) {
                        suppressNextFullscreenExitMenu = true;
                    }
                    void syncFullscreenPreference(enabled);
                };
                window.game.uiManager.onEscMenuChange = (isOpen) => {
                    existingEscMenuChange?.(isOpen);
                    if (!isOpen && getStoredFullscreenPreference()) {
                        void syncFullscreenPreference(true);
                    }
                };
                window.game.uiManager.onEscMenuClosedByEscape = () => {
                    existingEscMenuClosedByEscape?.();
                    if (getStoredFullscreenPreference()) {
                        void syncFullscreenPreference(true);
                    }
                };
            }
            
            console.log("Calling loadGame...");
            await window.game.loadGame((progress, text) => {
                loadingBarFill.style.width = `${progress}%`;
                if (text) loadingText.textContent = text;
            });
            console.log("loadGame finished.");

            if (perfOverlayEnabled && window.game.renderSystem && perfOverlay) {
                try {
                    window.game.renderSystem.enablePerfOverlay(perfOverlay);
                } catch (error) {
                    console.warn("Perf overlay failed to initialize", error);
                }
            }

            loadingScreen.style.display = 'none';
            
            // window.game.uiManager.togglePatchNotes(); // Disabled auto-show
            
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
