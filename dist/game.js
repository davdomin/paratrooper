"use strict";
// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GROUND_HEIGHT = 40;
const BASE_WIDTH = 60;
const BASE_HEIGHT = 20;
const BARREL_LENGTH = 45;
const BARREL_WIDTH = 12;
const BULLET_SIZE = 6;
const BULLET_SPEED = 9;
const PARATROOPER_SIZE = 30;
const PARACHUTE_SIZE = 40;
const SOLDIER_WIDTH = 20;
const SOLDIER_HEIGHT = 15;
const SPAWN_INTERVAL = 1300; // ms
const MAX_BULLETS = 5;
const SHOOT_COOLDOWN = 220; // ms
// Colors
const SKY_COLOR = "#87CEEB";
const GROUND_COLOR = "#8B4513";
const GRASS_COLOR = "#228B22";
const CANNON_BASE_COLOR = "#5a3e1b";
const BARREL_COLOR = "#2c5e2a";
const BULLET_COLOR = "#FF4500";
const PARACHUTE_COLOR = "#f0f0f0";
const SOLDIER_COLOR = "#8B4513";
const EXPLOSION_COLOR = "#FF0000";
// DOM elements
let canvas;
let ctx;
let scoreSpan;
let landingsSpan;
let gameOverDiv;
let resetBtn;
// Game state
let cannon;
let bullets = [];
let paratroopers = [];
let score = 0;
let landedParatroopers = 0; // cuántos han aterrizado (máx 3)
let gameOver = false;
let lastSpawnTime = 0;
let lastShotTime = 0;
let explosionTimers = [];
// Mouse position for aiming (canvas coordinates)
let mouseX = CANVAS_WIDTH / 2;
let mouseY = CANVAS_HEIGHT - GROUND_HEIGHT - 20;
// ------------------------------------------------------------
// Cannon class (rotating barrel)
// ------------------------------------------------------------
class Cannon {
    constructor() {
        // Pivot at the center of the base, on the top edge
        this.pivotX = CANVAS_WIDTH / 2;
        this.pivotY = CANVAS_HEIGHT - GROUND_HEIGHT - BASE_HEIGHT / 2;
        this.angle = Math.PI / 2; // start pointing straight up
    }
    // Update angle based on mouse position relative to pivot
    updateAngle(mx, my) {
        let dx = mx - this.pivotX;
        let dy = my - this.pivotY;
        let rawAngle = Math.atan2(dy, dx);
        // Clamp between 0 and PI (0° to 180°). Negative angles become 0, angles > PI become PI.
        let clamped = Math.min(Math.max(rawAngle, 0), Math.PI);
        // Also avoid shooting directly sideways into ground? Keep 0..PI.
        this.angle = clamped;
    }
    draw() {
        // Draw base (static rectangle)
        ctx.fillStyle = CANNON_BASE_COLOR;
        ctx.fillRect(this.pivotX - BASE_WIDTH / 2, this.pivotY - BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT);
        // Draw a small circle at pivot
        ctx.fillStyle = "#3a2a1a";
        ctx.beginPath();
        ctx.arc(this.pivotX, this.pivotY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#aaa";
        ctx.beginPath();
        ctx.arc(this.pivotX, this.pivotY, 4, 0, Math.PI * 2);
        ctx.fill();
        // Draw rotating barrel
        ctx.save();
        ctx.translate(this.pivotX, this.pivotY);
        ctx.rotate(this.angle);
        ctx.fillStyle = BARREL_COLOR;
        ctx.fillRect(0, -BARREL_WIDTH / 2, BARREL_LENGTH, BARREL_WIDTH);
        ctx.restore();
    }
    // Get the tip position (where bullets spawn)
    getTip() {
        const tipX = this.pivotX + Math.cos(this.angle) * BARREL_LENGTH;
        const tipY = this.pivotY + Math.sin(this.angle) * BARREL_LENGTH;
        return { x: tipX, y: tipY };
    }
}
// ------------------------------------------------------------
// Bullet class with directional velocity
// ------------------------------------------------------------
class Bullet {
    constructor(x, y, angleRad) {
        this.radius = BULLET_SIZE / 2;
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angleRad) * BULLET_SPEED;
        this.vy = Math.sin(angleRad) * BULLET_SPEED;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
    draw() {
        ctx.fillStyle = BULLET_COLOR;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    isOffScreen() {
        return (this.x + this.radius < 0 ||
            this.x - this.radius > CANVAS_WIDTH ||
            this.y + this.radius < 0 ||
            this.y - this.radius > CANVAS_HEIGHT);
    }
    getRect() {
        return {
            x: this.x - this.radius,
            y: this.y - this.radius,
            w: this.radius * 2,
            h: this.radius * 2,
        };
    }
}
// ------------------------------------------------------------
// Paratrooper class (parachute + soldier)
// ------------------------------------------------------------
class Paratrooper {
    constructor() {
        this.width = PARACHUTE_SIZE;
        this.height = PARACHUTE_SIZE;
        this.soldierW = SOLDIER_WIDTH;
        this.soldierH = SOLDIER_HEIGHT;
        this.x = Math.random() * (CANVAS_WIDTH - this.width);
        this.y = -this.height; // start above canvas
        this.speedY = 1 + Math.random() * 2.2;
        this.driftX = (Math.random() - 0.5) * 0.5; // slow drift
    }
    update() {
        this.x += this.driftX;
        this.y += this.speedY;
        // Keep inside canvas horizontally
        this.x = Math.max(0, Math.min(CANVAS_WIDTH - this.width, this.x));
    }
    draw() {
        // Parachute
        ctx.fillStyle = PARACHUTE_COLOR;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Soldier below
        const soldierX = this.x + (this.width - this.soldierW) / 2;
        const soldierY = this.y + this.height;
        ctx.fillStyle = SOLDIER_COLOR;
        ctx.fillRect(soldierX, soldierY, this.soldierW, this.soldierH);
        // Draw lines for parachute strings
        ctx.beginPath();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const px = this.x + 5 + i * 15;
            ctx.moveTo(px, this.y + this.height);
            ctx.lineTo(px + 5, soldierY);
            ctx.stroke();
        }
    }
    // Collision rectangle for the soldier
    getSoldierRect() {
        return {
            x: this.x + (this.width - this.soldierW) / 2,
            y: this.y + this.height,
            w: this.soldierW,
            h: this.soldierH,
        };
    }
    hasLanded() {
        const soldierBottom = this.y + this.height + this.soldierH;
        const groundTop = CANVAS_HEIGHT - GROUND_HEIGHT;
        return soldierBottom >= groundTop;
    }
    isOffScreen() {
        return this.y + this.height + this.soldierH > CANVAS_HEIGHT;
    }
}
// ------------------------------------------------------------
// Game logic
// ------------------------------------------------------------
function init() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    scoreSpan = document.getElementById("score");
    landingsSpan = document.getElementById("lives"); // reusing lives span for landings
    gameOverDiv = document.getElementById("gameOver");
    resetBtn = document.getElementById("resetBtn");
    cannon = new Cannon();
    // Mouse move: update aiming and angle
    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let canvasX = (e.clientX - rect.left) * scaleX;
        let canvasY = (e.clientY - rect.top) * scaleY;
        canvasX = Math.min(Math.max(canvasX, 0), CANVAS_WIDTH);
        canvasY = Math.min(Math.max(canvasY, 0), CANVAS_HEIGHT);
        mouseX = canvasX;
        mouseY = canvasY;
        if (!gameOver)
            cannon.updateAngle(mouseX, mouseY);
    });
    // Click to shoot
    canvas.addEventListener("click", (e) => {
        if (gameOver)
            return;
        const now = Date.now();
        if (now - lastShotTime < SHOOT_COOLDOWN)
            return;
        if (bullets.length >= MAX_BULLETS)
            return;
        const tip = cannon.getTip();
        bullets.push(new Bullet(tip.x, tip.y, cannon.angle));
        lastShotTime = now;
    });
    resetBtn.addEventListener("click", resetGame);
    updateUI();
    requestAnimationFrame(gameLoop);
}
function resetGame() {
    gameOver = false;
    score = 0;
    landedParatroopers = 0;
    bullets = [];
    paratroopers = [];
    explosionTimers = [];
    lastSpawnTime = performance.now();
    lastShotTime = 0;
    updateUI();
    gameOverDiv.classList.add("hidden");
    // Reset cannon angle to up
    cannon.angle = Math.PI / 2;
}
function updateUI() {
    scoreSpan.textContent = score.toString();
    landingsSpan.textContent = `${landedParatroopers}/3`;
}
function gameLoop(now) {
    if (!gameOver) {
        // Spawn paratroopers
        if (now - lastSpawnTime > SPAWN_INTERVAL) {
            paratroopers.push(new Paratrooper());
            lastSpawnTime = now;
        }
        // Update bullets and collisions
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].update();
            if (bullets[i].isOffScreen()) {
                bullets.splice(i, 1);
                continue;
            }
            let hit = false;
            for (let j = paratroopers.length - 1; j >= 0; j--) {
                const soldier = paratroopers[j].getSoldierRect();
                const bulletRect = bullets[i].getRect();
                if (bulletRect.x < soldier.x + soldier.w &&
                    bulletRect.x + bulletRect.w > soldier.x &&
                    bulletRect.y < soldier.y + soldier.h &&
                    bulletRect.y + bulletRect.h > soldier.y) {
                    // Hit!
                    score += 10;
                    updateUI();
                    explosionTimers.push({
                        x: soldier.x + soldier.w / 2,
                        y: soldier.y + soldier.h / 2,
                        framesLeft: 3,
                    });
                    bullets.splice(i, 1);
                    paratroopers.splice(j, 1);
                    hit = true;
                    break;
                }
            }
            if (hit)
                continue;
        }
        // Update paratroopers and check landings
        for (let i = paratroopers.length - 1; i >= 0; i--) {
            paratroopers[i].update();
            if (paratroopers[i].hasLanded()) {
                landedParatroopers++;
                updateUI();
                // Add a small explosion effect on landing
                const rect = paratroopers[i].getSoldierRect();
                explosionTimers.push({
                    x: rect.x + rect.w / 2,
                    y: rect.y + rect.h / 2,
                    framesLeft: 3,
                });
                paratroopers.splice(i, 1);
                if (landedParatroopers >= 3) {
                    gameOver = true;
                    gameOverDiv.classList.remove("hidden");
                }
                continue;
            }
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
    requestAnimationFrame(gameLoop);
}
function render() {
    // Sky
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Ground
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    // Grass details
    ctx.strokeStyle = GRASS_COLOR;
    ctx.lineWidth = 2;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
        const bladeHeight = 4 + Math.random() * 6;
        ctx.beginPath();
        ctx.moveTo(i, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.lineTo(i + 10, CANVAS_HEIGHT - GROUND_HEIGHT - bladeHeight);
        ctx.lineTo(i + 20, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.stroke();
    }
    // Draw cannon (base + barrel)
    cannon.draw();
    // Draw bullets
    for (const b of bullets)
        b.draw();
    // Draw paratroopers
    for (const p of paratroopers)
        p.draw();
    // Draw explosions
    for (const exp of explosionTimers) {
        ctx.fillStyle = EXPLOSION_COLOR;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFA500";
        ctx.beginPath();
        ctx.arc(exp.x - 2, exp.y - 2, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    // Game over overlay
    if (gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = "#FF0000";
        ctx.font = "bold 48px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.font = "20px monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText("3 paratroopers landed on your cannon", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    }
}
// Start the game
document.addEventListener("DOMContentLoaded", init);
//# sourceMappingURL=game.js.map