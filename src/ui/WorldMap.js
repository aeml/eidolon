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
        
        // Camera Center (Snapshot of player pos when map opens)
        this.cameraX = 0;
        this.cameraZ = 0;
        
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
            // Center on player initially
            this.cameraX = this.gameEngine.player.position.x;
            this.cameraZ = this.gameEngine.player.position.z;
            this.mapOffsetX = 0;
            this.mapOffsetY = 0;
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

        // Center map on camera + offset
        // World (0,0) should be at screen (cx - cameraX * scale + offsetX, cy - cameraZ * scale + offsetY)
        const worldToScreen = (wx, wz) => {
            return {
                x: cx + (wx - this.cameraX) * this.scale + this.mapOffsetX,
                y: cy + (wz - this.cameraZ) * this.scale + this.mapOffsetY
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

        // 2. Draw Town (Rectangular Safe Zone)
        // Bounds: X: -100 to 100, Z: 100 to 300
        const townMinX = -100;
        const townMaxX = 100;
        const townMinZ = 100;
        const townMaxZ = 300;
        
        const townTopLeft = worldToScreen(townMinX, townMinZ);
        const townWidth = (townMaxX - townMinX) * this.scale;
        const townHeight = (townMaxZ - townMinZ) * this.scale;
        const townCenter = worldToScreen(0, 200); // For label

        ctx.fillStyle = 'rgba(100, 100, 255, 0.3)';
        ctx.fillRect(townTopLeft.x, townTopLeft.y, townWidth, townHeight);

        ctx.strokeStyle = '#44f';
        ctx.lineWidth = 2;
        ctx.strokeRect(townTopLeft.x, townTopLeft.y, townWidth, townHeight);
        
        // Town Label
        ctx.fillStyle = '#fff';
        ctx.font = `${36 * (this.scale / 2)}px Arial`; // Scale font slightly
        ctx.textAlign = 'center';
        ctx.fillText("TOWN", townCenter.x, townCenter.y);

        // 2.05 Draw Snow World Area
        // Snow World starts at Z = -600 and goes North (negative Z)
        // Let's draw a large area for it
        const snowStartZ = -600;
        const snowWidth = 2000; // Visual width (Matches Earth Realm now)
        const snowDepth = 1600; // Visual depth (Extended to -2200)
        const snowPos = worldToScreen(-snowWidth/2, snowStartZ - snowDepth);
        
        ctx.fillStyle = 'rgba(200, 240, 255, 0.2)'; // Light Cyan/White
        ctx.fillRect(snowPos.x, snowPos.y, snowWidth * this.scale, snowDepth * this.scale);
        
        // Snow World Label
        ctx.fillStyle = '#fff';
        ctx.font = `${48 * (this.scale / 2)}px Arial`;
        const snowLabelPos = worldToScreen(0, -1400);
        ctx.fillText("The Abyssal Well (Water Realm)", snowLabelPos.x, snowLabelPos.y);

        // Earth Realm Label (Main Area)
        ctx.font = `${48 * (this.scale / 2)}px Arial`;
        const earthLabelPos = worldToScreen(0, 200);
        ctx.fillText("The Iron Weald (Earth Realm)", earthLabelPos.x, earthLabelPos.y + 100 * this.scale);

        // Siren Zone (Lv 50-54) - Specific Spawn Area
        const sirenZoneX = -1000;
        const sirenZoneZ = -1000; // Top Z (most negative)
        const sirenZoneW = 2000;   // -1000 to 1000
        const sirenZoneD = 400;   // -1000 to -600
        
        const sirenScreenPos = worldToScreen(sirenZoneX, sirenZoneZ);
        
        ctx.fillStyle = 'rgba(0, 100, 255, 0.15)'; // Distinct blue tint
        ctx.fillRect(sirenScreenPos.x, sirenScreenPos.y, sirenZoneW * this.scale, sirenZoneD * this.scale);
        
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sirenScreenPos.x, sirenScreenPos.y, sirenZoneW * this.scale, sirenZoneD * this.scale);

        // Siren Zone Label
        ctx.fillStyle = '#aaffff';
        ctx.font = `${36 * (this.scale / 2)}px Arial`;
        const sirenLabelPos = worldToScreen(0, -800);
        ctx.fillText("Sirens (Lv 50-54)", sirenLabelPos.x, sirenLabelPos.y);

        // Frost Guardian Zone (Lv 54-58)
        const fgZoneX = -1000;
        const fgZoneZ = -1400;
        const fgZoneW = 2000;
        const fgZoneD = 400;

        const fgScreenPos = worldToScreen(fgZoneX, fgZoneZ);

        ctx.fillStyle = 'rgba(0, 255, 255, 0.15)'; // Cyan tint
        ctx.fillRect(fgScreenPos.x, fgScreenPos.y, fgZoneW * this.scale, fgZoneD * this.scale);

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(fgScreenPos.x, fgScreenPos.y, fgZoneW * this.scale, fgZoneD * this.scale);

        // Frost Guardian Label
        const fgLabelPos = worldToScreen(0, -1200); // Center of -1000 to -1400
        ctx.fillStyle = '#aaffff';
        ctx.font = `${36 * (this.scale / 2)}px Arial`;
        ctx.fillText("Frost Guardians (Lv 54-58)", fgLabelPos.x, fgLabelPos.y);

        // Future Zone 2 (Placeholder)
        const zone2Z = -1400;
        const zone2ScreenPos = worldToScreen(-1000, zone2Z);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(zone2ScreenPos.x, zone2ScreenPos.y, 2000 * this.scale, 400 * this.scale);
        
        // Future Zone 3 (Placeholder)
        const zone3Z = -1800;
        const zone3ScreenPos = worldToScreen(-1000, zone3Z);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(zone3ScreenPos.x, zone3ScreenPos.y, 2000 * this.scale, 400 * this.scale);

        // Future Zone 4 (Placeholder)
        const zone4Z = -2200;
        const zone4ScreenPos = worldToScreen(-1000, zone4Z);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(zone4ScreenPos.x, zone4ScreenPos.y, 2000 * this.scale, 400 * this.scale);


        // Fence Line (Rectangular)
        // Bounds: X: -1000 to 1000, Z: -600 to 1000
        const fenceMinX = -1000;
        const fenceMaxX = 1000;
        const fenceMinZ = -600;
        const fenceMaxZ = 1000;
        
        // Gap for Water Realm: -20 to 20 on North Wall (Z = -600)
        const gapMinX = -20;
        const gapMaxX = 20;

        ctx.strokeStyle = '#8B4513'; // SaddleBrown
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        // North Wall (Left Part)
        let start = worldToScreen(fenceMinX, fenceMinZ);
        let end = worldToScreen(gapMinX, fenceMinZ);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        
        // North Wall (Right Part)
        start = worldToScreen(gapMaxX, fenceMinZ);
        end = worldToScreen(fenceMaxX, fenceMinZ);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        
        // East Wall
        start = worldToScreen(fenceMaxX, fenceMinZ);
        end = worldToScreen(fenceMaxX, fenceMaxZ);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        
        // South Wall
        start = worldToScreen(fenceMaxX, fenceMaxZ);
        end = worldToScreen(fenceMinX, fenceMaxZ);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        
        // West Wall
        start = worldToScreen(fenceMinX, fenceMaxZ);
        end = worldToScreen(fenceMinX, fenceMinZ);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        
        ctx.stroke();

        // Snow World Fence (Water Realm)
        // Bounds: X: -1000 to 1000, Z: -2200 to -600
        const snowFenceMinX = -1000;
        const snowFenceMaxX = 1000;
        const snowFenceMinZ = -2200;
        const snowFenceMaxZ = -600;
        
        ctx.beginPath();
        // West Wall
        start = worldToScreen(snowFenceMinX, snowFenceMaxZ); // Starts at connection
        end = worldToScreen(snowFenceMinX, snowFenceMinZ);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        
        // North Wall
        start = worldToScreen(snowFenceMinX, snowFenceMinZ);
        end = worldToScreen(snowFenceMaxX, snowFenceMinZ);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        
        // East Wall
        start = worldToScreen(snowFenceMaxX, snowFenceMinZ);
        end = worldToScreen(snowFenceMaxX, snowFenceMaxZ); // Ends at connection
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        
        ctx.stroke();

        // 2.1 Draw Level Rectangles (Vertical Strips)
        const drawLevelRect = (minX, maxX, label, color) => {
            const minZ = -600;
            const maxZ = 1000;
            
            const topLeft = worldToScreen(minX, minZ);
            const w = (maxX - minX) * this.scale;
            const h = (maxZ - minZ) * this.scale;

            ctx.fillStyle = color;
            ctx.fillRect(topLeft.x, topLeft.y, w, h);
            
            ctx.strokeStyle = color.replace('0.05', '0.2');
            ctx.lineWidth = 1;
            ctx.strokeRect(topLeft.x, topLeft.y, w, h);

            // Label
            const centerX = (minX + maxX) / 2;
            const centerZ = (minZ + maxZ) / 2;
            const labelPos = worldToScreen(centerX, centerZ);
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = `${36 * (this.scale / 2)}px Arial`;
            ctx.textAlign = 'center';
            // Offset label slightly if it overlaps town
            let yOffset = 0;
            if (Math.abs(centerX - 0) < 10 && Math.abs(centerZ - 200) < 10) {
                yOffset = 150 * this.scale; // Push down below town
            }
            ctx.fillText(label, labelPos.x, labelPos.y + yOffset);
        };

        // Sector 3 (Center): Lv 1-10
        drawLevelRect(-200, 200, "Lv 1-10", 'rgba(0, 255, 0, 0.05)');
        // Sector 2 (Left): Lv 10-20
        drawLevelRect(-600, -200, "Lv 10-20", 'rgba(255, 255, 0, 0.05)');
        // Sector 4 (Right): Lv 20-30
        drawLevelRect(200, 600, "Lv 20-30", 'rgba(255, 165, 0, 0.05)');
        // Sector 1 (Far Left): Lv 30-40
        drawLevelRect(-1000, -600, "Lv 30-40", 'rgba(255, 0, 0, 0.05)');
        // Sector 5 (Far Right): Lv 40-50
        drawLevelRect(600, 1000, "Lv 40-50", 'rgba(128, 0, 128, 0.05)');

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
        const playerScreenPos = worldToScreen(player.position.x, player.position.z);
        ctx.fillStyle = '#00ffff'; // Cyan
        ctx.beginPath();
        ctx.arc(playerScreenPos.x, playerScreenPos.y, 5, 0, Math.PI * 2);
        ctx.fill();
        // Add a white ring to distinguish local player
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
