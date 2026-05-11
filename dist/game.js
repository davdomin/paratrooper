"use strict";
// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GROUND_HEIGHT = 40;
const CANNON_WIDTH = 50;
const CANNON_HEIGHT = 20;
const BULLET_WIDTH = 3;
const BULLET_HEIGHT = 10;
const BULLET_SPEED = 7;
const PARATROOPER_SIZE = 30;
const PARACHUTE_SIZE = 40;
const SOLDIER_WIDTH = 20;
const SOLDIER_HEIGHT = 15;
const SPAWN_INTERVAL = 1500; // ms
const MAX_BULLETS = 5;
const SHOOT_COOLDOWN = 200; // ms
// Colors
const SKY_COLOR = '#87CEEB';
const GROUND_COLOR = '#8B4513'; // SaddleBrown
const GRASS_COLOR = '#228B22'; // ForestGreen
const CANNON_COLOR = '#008000'; // Green
const BULLET_COLOR = '#FF0000'; // Red
const PARACHUTE_COLOR = '#FFFFFF'; // White
const SOLDIER_COLOR = '#8B4513'; // SaddleBrown
const EXPLOSION_COLOR = '#FF0000'; // Red
// Game state
let canvas;
let ctx;
let cannon;
let bullets = [];
let paratroopers = [];
let score = 0;
let lives = 3;
let gameOver = false;
let lastSpawnTime = 0;
let lastShotTime = 0;
let mouseX = 0;
let explosionTimers = [];
// Classes
class Cannon {
    constructor() {
        this.width = CANNON_WIDTH;
        this.height = CANNON_HEIGHT;
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
    }
    update(mouseX) {
        // Keep cannon within canvas bounds
        this.x = Math.max(0, Math.min(CANVAS_WIDTH - this.width, mouseX - this.width / 2));
    }
    draw() {
        ctx.fillStyle = CANNON_COLOR;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}
class Bullet {
    constructor(x, y) {
        this.width = BULLET_WIDTH;
        this.height = BULLET_HEIGHT;
        this.speed = BULLET_SPEED;
        this.x = x;
        this.y = y;
    }
    update() {
        this.y -= this.speed;
    }
    draw() {
        ctx.fillStyle = BULLET_COLOR;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    isOffScreen() {
        return this.y < 0;
    }
}
class Paratrooper {
    constructor() {
        this.width = PARACHUTE_SIZE;
        this.height = PARACHUTE_SIZE;
        this.soldierWidth = SOLDIER_WIDTH;
        this.soldierHeight = SOLDIER_HEIGHT;
        this.x = Math.random() * (CANVAS_WIDTH - this.width);
        this.y = -this.height; // Start above canvas
        this.speed = 1 + Math.random() * 2; // Speed between 1 and 3
    }
    update() {
        this.y += this.speed;
    }
    draw() {
        // Draw parachute (white rectangle)
        ctx.fillStyle = PARACHUTE_COLOR;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Draw soldier (brown rectangle) below parachute
        const soldierX = this.x + (this.width - this.soldierWidth) / 2;
        const soldierY = this.y + this.height;
        ctx.fillStyle = SOLDIER_COLOR;
        ctx.fillRect(soldierX, soldierY, this.soldierWidth, this.soldierHeight);
    }
    getSoldierRect() {
        return {
            x: this.x + (this.width - this.soldierWidth) / 2,
            y: this.y + this.height,
            width: this.soldierWidth,
            height: this.soldierHeight
        };
    }
    isOffScreen() {
        return this.y > CANVAS_HEIGHT;
    }
    hasHitGround() {
        return this.y >= CANVAS_HEIGHT - GROUND_HEIGHT - this.soldierHeight;
    }
}
// Game functions
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    cannon = new Cannon();
    // Event listeners
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
    });
    canvas.addEventListener('click', (e) => {
        if (gameOver)
            return;
        const now = Date.now();
        if (now - lastShotTime < SHOOT_COOLDOWN)
            return;
        if (bullets.length >= MAX_BULLETS)
            return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        // Shoot from cannon tip
        const bulletX = cannon.x + cannon.width / 2 - BULLET_WIDTH / 2;
        const bulletY = cannon.y;
        bullets.push(new Bullet(bulletX, bulletY));
        lastShotTime = now;
    });
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', resetGame);
    // Start game loop
    update(0);
}
function resetGame() {
    score = 0;
    lives = 3;
    gameOver = false;
    bullets = [];
    paratroopers = [];
    explosionTimers = [];
    lastSpawnTime = 0;
    lastShotTime = 0;
    document.getElementById('score').textContent = '0';
    document.getElementById('lives').textContent = '3';
    document.getElementById('gameOver').classList.add('hidden');
}
function update(timestamp) {
    if (!gameOver) {
        // Spawn enemies
        if (timestamp - lastSpawnTime > SPAWN_INTERVAL) {
            paratroopers.push(new Paratrooper());
            lastSpawnTime = timestamp;
        }
        // Update cannon
        cannon.update(mouseX);
        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].update();
            // Remove off-screen bullets
            if (bullets[i].isOffScreen()) {
                bullets.splice(i, 1);
                continue;
            }
            // Check collision with paratroopers
            for (let j = paratroopers.length - 1; j >= 0; j--) {
                const soldier = paratroopers[j].getSoldierRect();
                const bullet = bullets[i];
                if (bullet.x < soldier.x + soldier.width &&
                    bullet.x + bullet.width > soldier.x &&
                    bullet.y < soldier.y + soldier.height &&
                    bullet.y + bullet.height > soldier.y) {
                    // Hit!
                    score += 10;
                    document.getElementById('score').textContent = score.toString();
                    // Add explosion effect
                    explosionTimers.push({
                        x: soldier.x + soldier.width / 2,
                        y: soldier.y + soldier.height / 2,
                        framesLeft: 2
                    });
                    // Remove bullet and paratrooper
                    bullets.splice(i, 1);
                    paratroopers.splice(j, 1);
                    break; // Break inner loop since bullet is gone
                }
            }
        }
        // Update paratroopers
        for (let i = paratroopers.length - 1; i >= 0; i--) {
            paratroopers[i].update();
            // Check if hit ground
            if (paratroopers[i].hasHitGround()) {
                lives--;
                document.getElementById('lives').textContent = lives.toString();
                paratroopers.splice(i, 1);
                if (lives <= 0) {
                    gameOver = true;
                    document.getElementById('gameOver').classList.remove('hidden');
                }
                continue;
            }
            // Remove off-screen paratroopers (shouldn't happen often with ground check)
            if (paratroopers[i].isOffScreen()) {
                paratroopers.splice(i, 1);
            }
        }
        // Update explosion timers
        for (let i = explosionTimers.length - 1; i >= 0; i--) {
            explosionTimers[i].framesLeft--;
            if (explosionTimers[i].framesLeft <= 0) {
                explosionTimers.splice(i, 1);
            }
        }
    }
    render();
    requestAnimationFrame(update);
}
function render() {
    // Clear canvas
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Draw ground
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    // Draw grass (simple lines)
    ctx.strokeStyle = GRASS_COLOR;
    ctx.lineWidth = 2;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
        const height = 5 + Math.random() * 5;
        ctx.beginPath();
        ctx.moveTo(i, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.lineTo(i + 10, CANVAS_HEIGHT - GROUND_HEIGHT - height);
        ctx.lineTo(i + 20, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.stroke();
    }
    // Draw cannon
    cannon.draw();
    // Draw bullets
    for (const bullet of bullets) {
        bullet.draw();
    }
    // Draw paratroopers
    for (const paratrooper of paratroopers) {
        paratrooper.draw();
    }
    // Draw explosions
    for (const exp of explosionTimers) {
        ctx.fillStyle = EXPLOSION_COLOR;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, 10, 0, Math.PI * 2);
        ctx.fill();
    }
    // Draw game over if needed
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#FF0000';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}
// Start game when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
//# sourceMappingURL=game.js.map