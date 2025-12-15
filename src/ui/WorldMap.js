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

        // Rotation Constants (45 degrees clockwise)
        const cos = 0.70710678;
        const sin = 0.70710678;

        // Center map on camera + offset
        // World (0,0) should be at screen (cx - cameraX * scale + offsetX, cy - cameraZ * scale + offsetY)
        // Now with rotation
        const worldToScreen = (wx, wz) => {
            const relX = wx - this.cameraX;
            const relZ = wz - this.cameraZ;
            
            // Rotate
            const rotX = relX * cos - relZ * sin;
            const rotZ = relX * sin + relZ * cos;

            return {
                x: cx + rotX * this.scale + this.mapOffsetX,
                y: cy + rotZ * this.scale + this.mapOffsetY
            };
        };

        // Helper to draw rotated rectangles (polygons)
        const drawRotatedRect = (minX, minZ, width, depth, fillStyle, strokeStyle, lineWidth = 1) => {
            const p1 = worldToScreen(minX, minZ);
            const p2 = worldToScreen(minX + width, minZ);
            const p3 = worldToScreen(minX + width, minZ + depth);
            const p4 = worldToScreen(minX, minZ + depth);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();

            if (fillStyle) {
                ctx.fillStyle = fillStyle;
                ctx.fill();
            }
            if (strokeStyle) {
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = lineWidth;
                ctx.stroke();
            }
        };

        // 1. Draw Visited Chunks (Background)
        ctx.fillStyle = '#222';
        this.visitedChunks.forEach(key => {
            const [chunkX, chunkZ] = key.split(',').map(Number);
            const wx = chunkX * this.chunkSize;
            const wz = chunkZ * this.chunkSize;
            
            drawRotatedRect(wx, wz, this.chunkSize, this.chunkSize, '#222', '#333', 1);
        });

        // 2. Draw Town (Rectangular Safe Zone)
        // Bounds: X: -100 to 100, Z: 100 to 300
        drawRotatedRect(-100, 100, 200, 200, 'rgba(100, 100, 255, 0.3)', '#44f', 2);
        
        // Town Label
        const townCenter = worldToScreen(0, 200);
        ctx.fillStyle = '#fff';
        ctx.font = `${36 * (this.scale / 2)}px Arial`; // Scale font slightly
        ctx.textAlign = 'center';
        ctx.fillText("TOWN", townCenter.x, townCenter.y);

        // 2.05 Draw Snow World Area
        // Snow World starts at Z = -600 and goes North (negative Z)
        const snowStartZ = -600;
        const snowWidth = 2000; 
        const snowDepth = 1600; 
        // Rect from (-1000, -2200) to (1000, -600)
        drawRotatedRect(-snowWidth/2, snowStartZ - snowDepth, snowWidth, snowDepth, 'rgba(200, 240, 255, 0.2)');
        
        // Snow World Label
        ctx.fillStyle = '#fff';
        ctx.font = `${48 * (this.scale / 2)}px Arial`;
        const snowLabelPos = worldToScreen(0, -1400);
        ctx.fillText("The Abyssal Well (Water Realm)", snowLabelPos.x, snowLabelPos.y);

        // Earth Realm Label (Main Area)
        ctx.font = `${48 * (this.scale / 2)}px Arial`;
        const earthLabelPos = worldToScreen(0, 200);
        ctx.fillText("The Iron Weald (Earth Realm)", earthLabelPos.x, earthLabelPos.y - 100 * this.scale);

        // Siren Zone (Lv 60-65) - Moved Deeper
        drawRotatedRect(-1000, -1800, 2000, 400, 'rgba(0, 100, 255, 0.15)', 'rgba(0, 200, 255, 0.5)', 1);

        // Siren Zone Label
        ctx.fillStyle = '#aaffff';
        ctx.font = `${36 * (this.scale / 2)}px Arial`;
        const sirenLabelPos = worldToScreen(0, -1600);
        ctx.fillText("Sirens (Lv 60-65)", sirenLabelPos.x, sirenLabelPos.y);

        // Frost Guardian Zone (Lv 65-70) - Moved Deeper
        drawRotatedRect(-1000, -2200, 2000, 400, 'rgba(0, 255, 255, 0.15)', 'rgba(0, 255, 255, 0.5)', 1);

        // Frost Guardian Label
        const fgLabelPos = worldToScreen(0, -2000); 
        ctx.fillStyle = '#aaffff';
        ctx.font = `${36 * (this.scale / 2)}px Arial`;
        ctx.fillText("Frost Guardians (Lv 65-70)", fgLabelPos.x, fgLabelPos.y);

        // Mountain Troll Zone (Lv 50-55)
        drawRotatedRect(-1000, -1000, 2000, 400, 'rgba(139, 69, 19, 0.15)', 'rgba(139, 69, 19, 0.5)', 1);

        // Mountain Troll Label
        ctx.fillStyle = '#aaffff';
        ctx.font = `${36 * (this.scale / 2)}px Arial`;
        const trollLabelPos = worldToScreen(0, -800);
        ctx.fillText("Mountain Trolls (Lv 50-55)", trollLabelPos.x, trollLabelPos.y);

        // Aqua Golem Zone (Lv 55-60)
        drawRotatedRect(-1000, -1400, 2000, 400, 'rgba(0, 136, 255, 0.15)', 'rgba(0, 136, 255, 0.5)', 1);

        // Aqua Golem Label
        const golemLabelPos = worldToScreen(0, -1200); 
        ctx.fillStyle = '#aaffff';
        ctx.font = `${36 * (this.scale / 2)}px Arial`;
        ctx.fillText("Aqua Golems (Lv 55-60)", golemLabelPos.x, golemLabelPos.y);


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
            const w = maxX - minX;
            const h = maxZ - minZ;
            
            drawRotatedRect(minX, minZ, w, h, color, color.replace('0.05', '0.2'), 1);

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
                yOffset = 100 * this.scale; // Push down below town
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
