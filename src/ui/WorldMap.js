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
        this.mapOffsetX = 0;
        this.mapOffsetY = 0;
        
        // Interaction State
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Event Listeners for Interaction
        this.setupInteraction();

        // Resize observer to handle window resizing
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        
        // Initial resize
        this.resize();
    }

    setupInteraction() {
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const zoomSpeed = 0.1;
            const delta = -Math.sign(e.deltaY);
            const newScale = this.scale + delta * zoomSpeed * this.scale;
            
            // Clamp scale
            this.scale = Math.max(0.5, Math.min(10.0, newScale));
            
            if (this.gameEngine.player) {
                this.draw(this.gameEngine.player);
            }
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            e.stopPropagation();

            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;

            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            this.mapOffsetX += dx;
            this.mapOffsetY += dy;

            if (this.gameEngine.player) {
                this.draw(this.gameEngine.player);
            }
        });

        const stopDrag = () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'default';
        };

        this.canvas.addEventListener('mouseup', stopDrag);
        this.canvas.addEventListener('mouseleave', stopDrag);
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

        // Center map on player + offset
        // World (0,0) should be at screen (cx - player.x * scale + offsetX, cy - player.z * scale + offsetY)
        const worldToScreen = (wx, wz) => {
            return {
                x: cx + (wx - player.position.x) * this.scale + this.mapOffsetX,
                y: cy + (wz - player.position.z) * this.scale + this.mapOffsetY
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

        // 2. Draw Town (Circular Safe Zone)
        const townCenter = worldToScreen(0, 0);
        const townRadius = 60; // Matches start of Lv 1-10 area

        ctx.fillStyle = 'rgba(100, 100, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(townCenter.x, townCenter.y, townRadius * this.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#44f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(townCenter.x, townCenter.y, townRadius * this.scale, 0, Math.PI * 2);
        ctx.stroke();
        
        // Town Label
        ctx.fillStyle = '#fff';
        ctx.font = `${12 * (this.scale / 2)}px Arial`; // Scale font slightly
        ctx.textAlign = 'center';
        ctx.fillText("TOWN", townCenter.x, townCenter.y);

        // 2.05 Draw Snow World Area
        // Snow World starts at Z = -600 and goes North (negative Z)
        // Let's draw a large area for it
        const snowStartZ = -600;
        const snowWidth = 1000; // Visual width
        const snowDepth = 1000; // Visual depth
        const snowPos = worldToScreen(-snowWidth/2, snowStartZ - snowDepth);
        
        ctx.fillStyle = 'rgba(200, 240, 255, 0.2)'; // Light Cyan/White
        ctx.fillRect(snowPos.x, snowPos.y, snowWidth * this.scale, snowDepth * this.scale);
        
        // Snow World Label
        ctx.fillStyle = '#fff';
        ctx.font = `${14 * (this.scale / 2)}px Arial`;
        const snowLabelPos = worldToScreen(0, -800);
        ctx.fillText("SNOW WORLD", snowLabelPos.x, snowLabelPos.y);

        // Siren Zone (Lv 50-54) - Specific Spawn Area
        const sirenZoneX = -200;
        const sirenZoneZ = -1000; // Top Z (most negative)
        const sirenZoneW = 400;   // -200 to 200
        const sirenZoneD = 400;   // -1000 to -600
        
        const sirenScreenPos = worldToScreen(sirenZoneX, sirenZoneZ);
        
        ctx.fillStyle = 'rgba(0, 100, 255, 0.15)'; // Distinct blue tint
        ctx.fillRect(sirenScreenPos.x, sirenScreenPos.y, sirenZoneW * this.scale, sirenZoneD * this.scale);
        
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sirenScreenPos.x, sirenScreenPos.y, sirenZoneW * this.scale, sirenZoneD * this.scale);

        // Siren Zone Label
        ctx.fillStyle = '#aaffff';
        ctx.font = `${12 * (this.scale / 2)}px Arial`;
        // Position slightly below the main "SNOW WORLD" text
        ctx.fillText("Lv 50-54", snowLabelPos.x, snowLabelPos.y + (20 * this.scale / 2));

        // Fence Line (at Z = -600 approx, radius 620 circle actually)
        // Draw the fence circle
        const fenceCenter = worldToScreen(0, 0);
        ctx.beginPath();
        ctx.arc(fenceCenter.x, fenceCenter.y, 620 * this.scale, 0, Math.PI * 2);
        ctx.strokeStyle = '#8B4513'; // SaddleBrown
        ctx.lineWidth = 3;
        ctx.stroke();

        // 2.1 Draw Level Rings (Donut shapes)
        const drawLevelRing = (minR, maxR, label, color) => {
            const worldCenterX = cx + (0 - player.position.x) * this.scale + this.mapOffsetX;
            const worldCenterY = cy + (0 - player.position.z) * this.scale + this.mapOffsetY;

            ctx.beginPath();
            ctx.arc(worldCenterX, worldCenterY, maxR * this.scale, 0, Math.PI * 2, false); // Outer circle
            ctx.arc(worldCenterX, worldCenterY, minR * this.scale, 0, Math.PI * 2, true);  // Inner circle (counter-clockwise to create hole)
            ctx.fillStyle = color;
            ctx.fill();
            
            // Border lines
            ctx.strokeStyle = color.replace('0.05', '0.2'); // Make border slightly more visible
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(worldCenterX, worldCenterY, minR * this.scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(worldCenterX, worldCenterY, maxR * this.scale, 0, Math.PI * 2);
            ctx.stroke();

            // Label (Top)
            const midR = (minR + maxR) / 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = `${10 * (this.scale / 2)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(label, worldCenterX, worldCenterY - midR * this.scale);
            // Label (Bottom)
            ctx.fillText(label, worldCenterX, worldCenterY + midR * this.scale);
            // Label (Left)
            ctx.fillText(label, worldCenterX - midR * this.scale, worldCenterY);
            // Label (Right)
            ctx.fillText(label, worldCenterX + midR * this.scale, worldCenterY);
        };

        drawLevelRing(60, 160, "Lv 1-10", 'rgba(0, 255, 0, 0.05)');
        drawLevelRing(160, 260, "Lv 10-20", 'rgba(255, 255, 0, 0.05)');
        drawLevelRing(260, 360, "Lv 20-30", 'rgba(255, 165, 0, 0.05)');
        drawLevelRing(360, 450, "Lv 30-40", 'rgba(255, 0, 0, 0.05)');
        drawLevelRing(450, 600, "Lv 40-50", 'rgba(128, 0, 128, 0.05)');

        // 2.5 Draw Entities (Players, Enemies, NPCs)
        if (this.gameEngine.chunkManager) {
            const activeEntities = this.gameEngine.chunkManager.getActiveEntities();
            activeEntities.forEach(entity => {
                if (entity === player) return; // Draw local player last

                const pos = worldToScreen(entity.position.x, entity.position.z);
                const type = entity.constructor.name;
                const meshType = entity.meshType;
                let color = null;
                let size = 3;

                // Determine Color
                if (['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(type) || ['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(meshType)) {
                    color = '#00ffff'; // Cyan for Players
                    size = 4;
                } else if (['Skeleton', 'Imp', 'DemonOrc', 'Construct', 'InfernoTitan'].includes(type) || ['Skeleton', 'Imp', 'DemonOrc', 'Construct', 'InfernoTitan'].includes(meshType)) {
                    if (entity.isElite) {
                        color = '#ffffff'; // White for Elites
                        size = 6;
                    } else if (type === 'InfernoTitan' || meshType === 'InfernoTitan') {
                        color = '#ff4500'; // OrangeRed for Inferno Titan
                        size = 5;
                    } else {
                        color = '#ff0000'; // Red for Enemies
                    }
                } else if (type === 'DwarfSalesman' || meshType === 'DwarfSalesman') {
                    color = '#00ff00'; // Green for NPC
                }

                if (color) {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        // 3. Draw Player (Local)
        ctx.fillStyle = '#00ffff'; // Cyan
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        // Add a white ring to distinguish local player
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
