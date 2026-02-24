const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const lvlEl = document.getElementById('lvl-display');
const knockFlash = document.getElementById('knock-flash');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = 0, lives = 0, bottles = [], bullets = [], gameActive = false;
let gunY = canvas.height / 2, gunDir = 1;
let mainLvl = '', subLvl = 1;
let config = { bSpeed: 2, gSpeed: 3, spawnRate: 0.01, color: '#00f2ff' };
let isCoolingDown = false; 

const levels = {
    EASY:   { 
        1: { chances: 15, speed: 2.5, goal: 50, color: '#00ff88' },  
        2: { chances: 10, speed: 3.5, goal: 120, color: '#00ffcc' }, 
        3: { chances: 7,  speed: 4.5, goal: 200, color: '#00f2ff' } 
    },
    MEDIUM: { 
        1: { chances: 10, speed: 4.0, goal: 80, color: '#ffff00' },  
        2: { chances: 7,  speed: 5.5, goal: 180, color: '#ffcc00' }, 
        3: { chances: 4,  speed: 7.0, goal: 300, color: '#ffaa00' } 
    },
    HARD:   { 
        1: { chances: 5,  speed: 6.5, goal: 100, color: '#ff5500' }, 
        2: { chances: 3,  speed: 8.5, goal: 250, color: '#ff2200' }, 
        3: { chances: 1,  speed: 11.0, goal: 500, color: '#ff0055' } 
    }
};

function showSubLevels(tier) {
    mainLvl = tier;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('sub-level-screen').style.display = 'block';
    document.getElementById('selected-main-title').innerText = tier + " MISSION";
    const container = document.getElementById('sub-btn-container');
    container.innerHTML = '';
    [1, 2, 3].forEach(num => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerHTML = `Sector ${num} <br> <small style="font-size:0.6rem; opacity:0.7">TARGET: ${levels[tier][num].goal} PTS</small>`;
        btn.onclick = () => startNestedGame(tier, num);
        container.appendChild(btn);
    });
}

function goBack() {
    document.getElementById('sub-level-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
}

function startNestedGame(tier, sub) {
    mainLvl = tier; subLvl = sub; score = 0;
    document.getElementById('sub-level-screen').style.display = 'none';
    applyLevelSettings();
    setupAudio();
    gameActive = true;
    animate();
}

function applyLevelSettings() {
    const settings = levels[mainLvl][subLvl];
    lives = settings.chances;
    config.bSpeed = settings.speed;
    config.gSpeed = settings.speed + 1.5;
    config.spawnRate = 0.01 + (subLvl * 0.006);
    config.color = settings.color;
    livesEl.innerText = lives;
    lvlEl.innerText = `${mainLvl} | SECTOR-${subLvl}`;
    lvlEl.style.color = config.color;
}

function setupAudio() {
    if (window.audioSetupDone) return;
    window.audioSetupDone = true;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        
        function detect() {
            if(!gameActive) return;
            analyser.getByteFrequencyData(data);
            let volume = data.slice(10).reduce((a, b) => a + b) / (data.length - 10);
            knockFlash.style.width = Math.min(volume * 2, 100) + "%";
            
            if (volume > 55 && !isCoolingDown) { 
                bullets.push({ x: 100, y: gunY, vx: 22 });
                isCoolingDown = true;
                setTimeout(() => { isCoolingDown = false; }, 400); 
            }
            requestAnimationFrame(detect);
        }
        detect();
    });
}

function animate() {
    if (!gameActive) return;
    ctx.fillStyle = 'rgba(5, 5, 16, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gun Movement
    gunY += config.gSpeed * gunDir;
    if (gunY > canvas.height - 50 || gunY < 50) gunDir *= -1;
    ctx.fillStyle = '#fff'; ctx.fillRect(20, gunY - 20, 50, 40);
    ctx.fillStyle = config.color; ctx.fillRect(70, gunY - 5, 25, 10);

    // Spawn Bottles
    if (Math.random() < config.spawnRate && bottles.length < 5) {
        bottles.push({ x: canvas.width - 150, y: canvas.height + 50, w: 40, h: 70 });
    }

    // Logic for Bottles
    bottles.forEach((b, bi) => {
        b.y -= config.bSpeed;
        ctx.strokeStyle = config.color; 
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        if (b.y + b.h < 0) {
            bottles.splice(bi, 1);
            lives--;
            livesEl.innerText = lives;
            if (lives <= 0) endGame();
        }
    });

    // Logic for Bullets
    bullets.forEach((bullet, bui) => {
        bullet.x += bullet.vx;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0055';
        ctx.fillStyle = '#fff';
        
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2); 
        ctx.fill();
        
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - 20, bullet.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        bottles.forEach((bottle, bi) => {
            if (bullet.x > bottle.x && bullet.y > bottle.y && bullet.y < bottle.y + bottle.h) {
                bottles.splice(bi, 1);
                bullets.splice(bui, 1);
                score += 10;
                scoreEl.innerText = score;
                if (score >= levels[mainLvl][subLvl].goal && subLvl < 3) {
                    subLvl++;
                    const msg = document.getElementById('level-up-msg');
                    msg.style.display = 'block';
                    setTimeout(() => msg.style.display = 'none', 1500);
                    applyLevelSettings();
                }
            }
        });
        if (bullet.x > canvas.width) bullets.splice(bui, 1);
    });
    requestAnimationFrame(animate);
}

function endGame() {
    gameActive = false;
    document.getElementById('end-screen').style.display = 'block';
    document.getElementById('final-score').innerText = score;
}