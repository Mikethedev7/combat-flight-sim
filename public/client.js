const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const socket = io();

const menu = document.getElementById('menu');
const playerLabel = document.getElementById('playerLabel');
const scoreLabel = document.getElementById('scoreLabel');
const healthLabel = document.getElementById('healthLabel');
const weaponLabel = document.getElementById('weaponLabel');
const joinBtn = document.getElementById('joinBtn');
const pilotNameInput = document.getElementById('pilotName');

const selected = {
  plane: 'interceptor',
  weapon: 'gun',
};

const keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  boost: false,
};

let currentPlayerId = null;
let arena = { width: 1400, height: 900 };
let gameState = {
  players: [],
  bullets: [],
  arena,
};

const stars = Array.from({ length: 120 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 2 + 0.6,
  alpha: 0.4 + Math.random() * 0.6,
  speed: 0.15 + Math.random() * 0.8,
}));

function updateSelection() {
  document.querySelectorAll('.planeBtn').forEach((button) => {
    button.classList.toggle('selected', button.dataset.plane === selected.plane);
  });

  document.querySelectorAll('.weaponBtn').forEach((button) => {
    button.classList.toggle('selected', button.dataset.weapon === selected.weapon);
  });
}

document.querySelectorAll('.planeBtn').forEach((button) => {
  button.addEventListener('click', () => {
    selected.plane = button.dataset.plane;
    updateSelection();
  });
});

document.querySelectorAll('.weaponBtn').forEach((button) => {
  button.addEventListener('click', () => {
    selected.weapon = button.dataset.weapon;
    updateSelection();
  });
});

joinBtn.addEventListener('click', () => {
  const name = (pilotNameInput.value || 'Ace').trim().slice(0, 12) || 'Ace';
  socket.emit('joinGame', { name, plane: selected.plane, weapon: selected.weapon });
  menu.classList.add('hidden');
});

socket.on('joined', ({ id, arena: newArena }) => {
  currentPlayerId = id;
  arena = newArena;
  playerLabel.textContent = 'Pilot: ' + (pilotNameInput.value || 'Ace').slice(0, 12);
});

socket.on('state', (state) => {
  gameState = state;

  const self = state.players.find((p) => p.id === currentPlayerId);
  if (self) {
    playerLabel.textContent = self.name;
    scoreLabel.textContent = `Score: ${self.score}`;
    healthLabel.textContent = `Hull: ${Math.max(0, Math.ceil(self.health))}`;
    weaponLabel.textContent = self.weaponKey;
  }
});

function setKey(code, value) {
  if (code === 'ArrowLeft' || code === 'a' || code === 'A') keys.left = value;
  if (code === 'ArrowRight' || code === 'd' || code === 'D') keys.right = value;
  if (code === 'ArrowUp' || code === 'w' || code === 'W') keys.up = value;
  if (code === 'ArrowDown' || code === 's' || code === 'S') keys.down = value;
  if (code === ' ' || code === 'Spacebar') keys.fire = value;
  if (code === 'Shift') keys.boost = value;
}

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar', 'Shift', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S'].includes(event.key)) {
    event.preventDefault();
  }
  setKey(event.key, true);
});

window.addEventListener('keyup', (event) => {
  setKey(event.key, false);
});

setInterval(() => {
  socket.emit('input', keys);
}, 1000 / 60);

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#051924');
  grad.addColorStop(0.4, '#0b2133');
  grad.addColorStop(1, '#091e2b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of stars) {
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
    star.y += star.speed;
    if (star.y > canvas.height) {
      star.y = -10;
      star.x = Math.random() * canvas.width;
    }
  }
}

function drawPlayer(player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI / 2);

  ctx.fillStyle = player.color || '#7dd3fc';
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(13, 16);
  ctx.lineTo(0, 10);
  ctx.lineTo(-13, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#dff7ff';
  ctx.beginPath();
  ctx.arc(0, 2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (player.id === currentPlayerId) {
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets() {
  for (const bullet of gameState.bullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHUDForPlayers() {
  for (const player of gameState.players) {
    const isSelf = player.id === currentPlayerId;
    if (!isSelf && player.alive) {
      const dx = player.x - (currentPlayerId ? gameState.players.find((p) => p.id === currentPlayerId)?.x || canvas.width / 2 : canvas.width / 2);
      const dy = player.y - (currentPlayerId ? gameState.players.find((p) => p.id === currentPlayerId)?.y || canvas.height / 2 : canvas.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < 300) {
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(player.name, player.x - 18, player.y - 26);
      }
    }
  }
}

function renderScene() {
  drawBackground();
  drawBullets();

  for (const player of gameState.players) {
    if (player.alive) {
      drawPlayer(player);
    }
  }

  drawHUDForPlayers();
}

function animate() {
  renderScene();
  requestAnimationFrame(animate);
}

animate();
