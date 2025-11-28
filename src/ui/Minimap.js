export class Minimap {
    constructor(size = 200) {
        // Adjust size for mobile
        const isMobile = window.innerWidth <= 800;
        this.size = isMobile ? 120 : size;
        this.scale = 4; // World units per pixel (approx)
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '20px';
        this.canvas.style.right = '20px';
        this.canvas.style.border = '2px solid #444';
        this.canvas.style.borderRadius = '50%'; // Circular minimap
        this.canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.canvas.style.zIndex = '100';
        
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    }

    update(player, entities) {
        if (!player) return;

        const ctx = this.ctx;
        const halfSize = this.size / 2;
        
        // Clear
        ctx.clearRect(0, 0, this.size, this.size);

        // Draw Background/Grid (Optional)
        ctx.beginPath();
        ctx.arc(halfSize, halfSize, halfSize, 0, Math.PI * 2);
        ctx.clip(); // Clip to circle

        // Draw Entities
        entities.forEach(entity => {
            if (entity === player) return;
            
            // Relative position
            const dx = entity.position.x - player.position.x;
            const dz = entity.position.z - player.position.z;
            
            // Rotate by 45 degrees to match isometric camera
            // x' = x cos(theta) - y sin(theta)
            // y' = x sin(theta) + y cos(theta)
            // theta = 45 degrees (PI/4)
            const cos = 0.707;
            const sin = 0.707;
            
            const rotX = dx * cos - dz * sin;
            const rotZ = dx * sin + dz * cos;

            // Convert to map coords
            const mapX = halfSize + rotX * this.scale;
            const mapY = halfSize + rotZ * this.scale;

            // Draw dot
            ctx.fillStyle = '#ff0000'; // Enemy color
            ctx.beginPath();
            ctx.arc(mapX, mapY, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Player (Center)
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(halfSize, halfSize, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw Direction Indicator
        // const angle = Math.atan2(player.velocity.x, player.velocity.z); 
    }
}
