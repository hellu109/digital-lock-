/* ================================================
   VaultOS Digital Lock — app.js
   ================================================ */

/* ---- Config ---- */
const SECRET_CODE = [1, 9, 9, 1]; // The year of the internet's birth (WWW 1991)
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

/* ---- State ---- */
let dialValues = [0, 0, 0, 0];
let attempts = MAX_ATTEMPTS;
let locked = false;
let unlocked = false;
let lockoutTimer = null;

/* ---- DOM References ---- */
const drums      = [0,1,2,3].map(i => document.getElementById(`drum${i}`));
const displayDs  = [0,1,2,3].map(i => document.getElementById(`d${i}`));
const btnUnlock  = document.getElementById('btnUnlock');
const btnReset   = document.getElementById('btnReset');
const btnRelock  = document.getElementById('btnRelock');
const lockBody   = document.getElementById('lockBody');
const shackle    = document.getElementById('shackle');
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const accessGranted   = document.getElementById('accessGranted');
const lockoutScreen   = document.getElementById('lockoutScreen');
const attemptsDots    = document.getElementById('attemptsDots').querySelectorAll('.attempt-dot');
const hintText        = document.getElementById('hintText');
const countdownEl     = document.getElementById('countdown');
const clockEl         = document.getElementById('clock');

/* ================================================
   PARTICLE BACKGROUND
   ================================================ */
const canvas = document.getElementById('particles');
const ctx    = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x    = Math.random() * canvas.width;
    this.y    = Math.random() * canvas.height;
    this.vx   = (Math.random() - 0.5) * 0.4;
    this.vy   = (Math.random() - 0.5) * 0.4;
    this.r    = Math.random() * 1.5 + 0.5;
    this.life = Math.random();
    this.maxLife = 0.6 + Math.random() * 0.4;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life += 0.003;
    if (this.life > this.maxLife || this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      this.reset();
      this.life = 0;
    }
  }
  draw() {
    const alpha = Math.sin((this.life / this.maxLife) * Math.PI) * 0.6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 255, 231, ${alpha})`;
    ctx.fill();
  }
}

for (let i = 0; i < 120; i++) particles.push(new Particle());

// Draw connecting lines between nearby particles
function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 90) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 255, 231, ${(1 - dist/90) * 0.12})`;
        ctx.lineWidth = 0.5;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawConnections();
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateParticles);
}
animateParticles();

/* ================================================
   CLOCK
   ================================================ */
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  clockEl.textContent = `${hh}:${mm}:${ss}`;
}
updateClock();
setInterval(updateClock, 1000);

/* ================================================
   DIAL LOGIC
   ================================================ */
function rotateDrum(dialIdx, direction) {
  if (locked || unlocked) return;

  // Update value
  if (direction === 'up') {
    dialValues[dialIdx] = (dialValues[dialIdx] + 1) % 10;
  } else {
    dialValues[dialIdx] = (dialValues[dialIdx] + 9) % 10;
  }

  // Animate drum
  const drum = drums[dialIdx];
  const allDigits = drum.querySelectorAll('.drum-digit');

  // Clear active
  allDigits.forEach(d => d.classList.remove('active'));

  // Rebuild drum around current value
  const val = dialValues[dialIdx];
  const digits = [
    (val + 8) % 10,
    (val + 9) % 10,
    val,
    (val + 1) % 10,
    (val + 2) % 10,
  ];
  allDigits.forEach((el, i) => {
    el.textContent = digits[i];
    if (i === 2) el.classList.add('active');
  });

  // Slide animation
  const offset = direction === 'up' ? -58 : 58;
  drum.style.transition = 'none';
  drum.style.transform = `translateY(${offset}px)`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drum.style.transition = 'transform 0.18s cubic-bezier(0.23,1,0.32,1)';
      drum.style.transform = 'translateY(0)';
    });
  });

  // Update display
  displayDs[dialIdx].textContent = val;
  displayDs[dialIdx].classList.remove('correct','wrong');
  displayDs[dialIdx].classList.add('active');
  setTimeout(() => displayDs[dialIdx].classList.remove('active'), 300);

  playClick();
}

/* ================================================
   SOUND (Web Audio API - subtle clicks)
   ================================================ */
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playClick() {
  try {
    const ac = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.05);
  } catch(e) {}
}

function playSuccess() {
  try {
    const ac = getAudioCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ac.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.15, ac.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.25);
      osc.start(ac.currentTime + i * 0.12);
      osc.stop(ac.currentTime + i * 0.12 + 0.25);
    });
  } catch(e) {}
}

function playError() {
  try {
    const ac = getAudioCtx();
    [200, 150].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ac.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.12, ac.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.15 + 0.2);
      osc.start(ac.currentTime + i * 0.15);
      osc.stop(ac.currentTime + i * 0.15 + 0.2);
    });
  } catch(e) {}
}

/* ================================================
   UNLOCK LOGIC
   ================================================ */
function tryUnlock() {
  if (locked || unlocked) return;

  const isCorrect = dialValues.every((v, i) => v === SECRET_CODE[i]);

  if (isCorrect) {
    // SUCCESS
    unlocked = true;
    displayDs.forEach(d => { d.classList.remove('active','wrong'); d.classList.add('correct'); });
    lockBody.classList.add('unlocked-glow');
    shackle.classList.add('open');
    statusDot.classList.remove('locked'); statusDot.classList.add('unlocked');
    statusText.textContent = 'ACCESS GRANTED';
    playSuccess();

    setTimeout(() => {
      accessGranted.style.display = 'flex';
    }, 700);
  } else {
    // FAIL
    attempts--;
    const dotIdx = MAX_ATTEMPTS - attempts - 1;
    if (attemptsDots[dotIdx]) attemptsDots[dotIdx].classList.add('used');

    displayDs.forEach(d => { d.classList.add('wrong'); d.classList.remove('active'); });
    lockBody.classList.add('error-glow');
    lockBody.classList.remove('unlocked-glow');
    statusText.textContent = `DENIED — ${attempts} ATTEMPTS LEFT`;
    playError();

    setTimeout(() => {
      lockBody.classList.remove('error-glow');
      displayDs.forEach(d => d.classList.remove('wrong'));
    }, 600);

    if (attempts <= 0) {
      setTimeout(() => startLockout(), 700);
    }
  }
}

/* ================================================
   LOCKOUT
   ================================================ */
function startLockout() {
  locked = true;
  statusDot.classList.add('locked');
  statusText.textContent = 'SYSTEM LOCKED';
  lockoutScreen.style.display = 'flex';

  let remaining = LOCKOUT_SECONDS;
  countdownEl.textContent = remaining;

  lockoutTimer = setInterval(() => {
    remaining--;
    countdownEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(lockoutTimer);
      endLockout();
    }
  }, 1000);
}

function endLockout() {
  locked = false;
  lockoutScreen.style.display = 'none';
  resetAll();
  statusDot.classList.remove('locked');
  statusText.textContent = 'SYSTEM ARMED';
}

/* ================================================
   RESET
   ================================================ */
function resetAll() {
  dialValues = [0, 0, 0, 0];
  attempts   = MAX_ATTEMPTS;
  unlocked   = false;

  // Reset drums
  drums.forEach((drum, i) => {
    const allDigits = drum.querySelectorAll('.drum-digit');
    const digits = [8, 9, 0, 1, 2];
    allDigits.forEach((el, j) => {
      el.textContent = digits[j];
      el.classList.toggle('active', j === 2);
    });
    drum.style.transform = 'translateY(0)';
  });

  // Reset display
  displayDs.forEach(d => {
    d.textContent = '_';
    d.className = 'digit-slot';
  });

  // Reset attempts dots
  attemptsDots.forEach(dot => dot.classList.remove('used'));

  // Reset lock body
  lockBody.classList.remove('unlocked-glow','error-glow');
  shackle.classList.remove('open');
  accessGranted.style.display = 'none';
  lockoutScreen.style.display = 'none';

  statusDot.classList.remove('locked','unlocked');
  statusText.textContent = 'SYSTEM ARMED';
}

/* ================================================
   EVENT LISTENERS
   ================================================ */
document.querySelectorAll('.dial-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dialIdx = parseInt(btn.dataset.dial);
    const dir     = btn.dataset.dir;
    rotateDrum(dialIdx, dir);
  });
});

// Keyboard support
window.addEventListener('keydown', e => {
  if (locked || unlocked) return;

  const keyMap = {
    'ArrowUp':    () => rotateDrum(activeDial, 'up'),
    'ArrowDown':  () => rotateDrum(activeDial, 'down'),
    'ArrowRight': () => { activeDial = Math.min(3, activeDial + 1); highlightDial(); },
    'ArrowLeft':  () => { activeDial = Math.max(0, activeDial - 1); highlightDial(); },
    'Enter':      () => tryUnlock(),
    'r':          () => resetAll(),
    'R':          () => resetAll(),
  };

  if (keyMap[e.key]) {
    e.preventDefault();
    keyMap[e.key]();
  }
});

// Touch / swipe support on dials
let touchStartY = 0;
document.querySelectorAll('.dial-window').forEach((window_el, i) => {
  window_el.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  window_el.addEventListener('touchend', e => {
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 15) {
      rotateDrum(i, dy > 0 ? 'up' : 'down');
    }
  });
  // Mouse wheel support
  window_el.addEventListener('wheel', e => {
    e.preventDefault();
    rotateDrum(i, e.deltaY > 0 ? 'down' : 'up');
  }, { passive: false });
});

let activeDial = 0;
function highlightDial() {
  document.querySelectorAll('.dial-wrapper').forEach((w, i) => {
    w.style.boxShadow = i === activeDial ? '0 0 15px rgba(0,255,231,0.4)' : '';
    w.style.borderRadius = '10px';
  });
}
highlightDial();

btnUnlock.addEventListener('click', tryUnlock);
btnReset.addEventListener('click', resetAll);
btnRelock.addEventListener('click', resetAll);
