export class WorldMap {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.container = document.getElementById('world-map');
        this.canvas = document.getElementById('world-map-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.visitedChunks = new Set(); // Stores "x,z" of visited chunks
        this.chunkSize = 50; // Should match CONSTANTS.SCENE.CHUNK_SIZE
        
        // Map Settings
        this.scale = 2; // Pixels per world unit
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Resize observer to handle window resizing
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        
        // Initial resize
        this.resize();
    }

    resize() {
        if (!this.container || this.container.clientWidth === 0 || this.container.clientHeight === 0) return;
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = Math.max(0, this.container.clientHeight - 40); // Minus header
        if (this.gameEngine && this.gameEngine.player) {
            this.draw(this.gameEngine.player);
        }
    }

    toggle() {
        const isHidden = this.container.style.display === 'none' || this.container.style.display === '';
        this.container.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && this.gameEngine.player) {
            this.draw(this.gameEngine.player);
        }
    }

    update(player) {
        if (!player) return;

        // Track visited chunks
        const cx = Math.floor(player.position.x / this.chunkSize);
        const cz = Math.floor(player.position.z / this.chunkSize);
        
        // Mark current and adjacent chunks as visited (fog of war reveal)
        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let z = cz - 1; z <= cz + 1; z++) {
                this.visitedChunks.add(`${x},${z}`);
            }
        }

        // Only redraw if visible
        if (this.container.style.display !== 'none') {
            this.draw(player);
        }
    }

    draw(player) {
        if (!player || !this.ctx) return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // Center map on player
        // World (0,0) should be at screen (cx - player.x * scale, cy - player.z * scale)
        const worldToScreen = (wx, wz) => {
            return {
                x: cx + (wx - player.position.x) * this.scale,
                y: cy + (wz - player.position.z) * this.scale
            };
        };

        // 1. Draw Visited Chunks (Background)
        ctx.fillStyle = '#222';
        this.visitedChunks.forEach(key => {
            const [chunkX, chunkZ] = key.split(',').map(Number);
            const wx = chunkX * this.chunkSize;
            const wz = chunkZ * this.chunkSize;
            
            const screenPos = worldToScreen(wx, wz);
            // Draw chunk rect
            ctx.fillRect(
                screenPos.x, 
                screenPos.y, 
                this.chunkSize * this.scale, 
                this.chunkSize * this.scale
            );
            
            // Grid lines
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                screenPos.x, 
                screenPos.y, 
                this.chunkSize * this.scale, 
                this.chunkSize * this.scale
            );
        });

        // 2. Draw Town (Fixed at 0,0, size 100x100)
        const townPos = worldToScreen(-50, -50); // Town is centered at 0,0, so top-left is -50,-50
        ctx.fillStyle = 'rgba(100, 100, 255, 0.3)';
        ctx.fillRect(townPos.x, townPos.y, 100 * this.scale, 100 * this.scale);
        ctx.strokeStyle = '#44f';
        ctx.lineWidth = 2;
        ctx.strokeRect(townPos.x, townPos.y, 100 * this.scale, 100 * this.scale);
        
        // Town Label
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("TOWN", townPos.x + 50 * this.scale, townPos.y + 50 * this.scale);

        // 3. Draw Player
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Player Direction
        // Assuming isometric rotation logic or just velocity
        // Let's just draw a cone or arrow
        
        // 4. Draw Enemies (only if in visited chunks? or only if active?)
        // Let's draw active enemies for now
        if (this.gameEngine.chunkManager) {
            const activeEntities = this.gameEngine.chunkManager.getActiveEntities();
            activeEntities.forEach(entity => {
                if (entity === player) return;
                if (entity.id.startsWith('skeleton')) {
                    const pos = worldToScreen(entity.position.x, entity.position.z);
                    ctx.fillStyle = '#f00';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
    }
}
