/* ================================================
   VaultOS Digital Lock — app.js
   ================================================ */

/* ---- Config ---- */
let SECRET_CODE = [1, 9, 9, 1];
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

/* ---- State ---- */
let enteredDigits = [];
let attempts = MAX_ATTEMPTS;
let locked    = false;
let unlocked  = false;
let lockoutTimer = null;

/* ---- DOM ---- */
const displayDs    = [0,1,2,3].map(i => document.getElementById(`d${i}`));
const btnReset     = document.getElementById('btnReset');
const btnRelock    = document.getElementById('btnRelock');
const btnChange    = document.getElementById('btnChange');
const btnChangeUnlocked = document.getElementById('btnChangeUnlocked');
const lockBody     = document.getElementById('lockBody');
const shackle      = document.getElementById('shackle');
const statusDot    = document.getElementById('statusDot');
const statusText   = document.getElementById('statusText');
const accessGranted  = document.getElementById('accessGranted');
const lockoutScreen  = document.getElementById('lockoutScreen');
const attemptsDots   = document.getElementById('attemptsDots').querySelectorAll('.attempt-dot');
const hintText       = document.getElementById('hintText');
const countdownEl    = document.getElementById('countdown');
const clockEl        = document.getElementById('clock');

/* ---- Change Password Modal DOM ---- */
const chgOverlay = document.getElementById('chgOverlay');
const chgClose   = document.getElementById('chgClose');
const chgPrompt  = document.getElementById('chgPrompt');
const chgDots    = [0,1,2,3].map(i => document.getElementById(`cd${i}`));
const chgMsg     = document.getElementById('chgMsg');
const chgDel     = document.getElementById('chgDel');
const chgOk      = document.getElementById('chgOk');
const step1Dot   = document.getElementById('step1Dot');
const step2Dot   = document.getElementById('step2Dot');
const step3Dot   = document.getElementById('step3Dot');
const stepLine1  = document.getElementById('stepLine1');
const stepLine2  = document.getElementById('stepLine2');

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
    this.x += this.vx; this.y += this.vy; this.life += 0.003;
    if (this.life > this.maxLife || this.x < 0 || this.x > canvas.width ||
        this.y < 0 || this.y > canvas.height) { this.reset(); this.life = 0; }
  }
  draw() {
    const alpha = Math.sin((this.life / this.maxLife) * Math.PI) * 0.6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,255,231,${alpha})`;
    ctx.fill();
  }
}
for (let i = 0; i < 120; i++) particles.push(new Particle());
function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i+1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 90) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0,255,231,${(1-dist/90)*0.12})`;
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
  clockEl.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2,'0')).join(':');
}
updateClock();
setInterval(updateClock, 1000);

/* ================================================
   MAIN NUMPAD — NHẬP MẬT KHẨU
   ================================================ */
function updateDisplay() {
  for (let i = 0; i < 4; i++) {
    const slot = displayDs[i];
    if (i < enteredDigits.length) {
      slot.textContent = enteredDigits[i];
      slot.classList.remove('wrong','correct');
      slot.classList.add('active');
    } else {
      slot.textContent = '_';
      slot.className = 'digit-slot';
    }
  }
}

function numpadPress(num) {
  if (locked || unlocked) return;
  if (enteredDigits.length >= 4) return;
  enteredDigits.push(num);
  updateDisplay();
  playClick();
}

function numpadClear() {
  if (locked || unlocked) return;
  if (!enteredDigits.length) return;
  enteredDigits.pop();
  updateDisplay();
  playClick();
}

function numpadEnter() {
  if (locked || unlocked) return;
  if (enteredDigits.length < 4) {
    lockBody.classList.add('error-glow');
    setTimeout(() => lockBody.classList.remove('error-glow'), 400);
    return;
  }
  tryUnlock();
}

/* ================================================
   SOUND
   ================================================ */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playClick() {
  try {
    const ac = getAudioCtx(), osc = ac.createOscillator(), gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.05);
  } catch(e) {}
}
function playSuccess() {
  try {
    const ac = getAudioCtx();
    [523,659,784,1047].forEach((freq,i) => {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ac.currentTime + i*0.12);
      gain.gain.setValueAtTime(0.15, ac.currentTime + i*0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i*0.12 + 0.25);
      osc.start(ac.currentTime + i*0.12); osc.stop(ac.currentTime + i*0.12 + 0.25);
    });
  } catch(e) {}
}
function playError() {
  try {
    const ac = getAudioCtx();
    [200,150].forEach((freq,i) => {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ac.currentTime + i*0.15);
      gain.gain.setValueAtTime(0.12, ac.currentTime + i*0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i*0.15 + 0.2);
      osc.start(ac.currentTime + i*0.15); osc.stop(ac.currentTime + i*0.15 + 0.2);
    });
  } catch(e) {}
}

/* ================================================
   UNLOCK LOGIC
   ================================================ */
function tryUnlock() {
  if (locked || unlocked) return;
  const isCorrect = enteredDigits.every((v,i) => v === SECRET_CODE[i]);
  if (isCorrect) {
    unlocked = true;
    displayDs.forEach(d => { d.classList.remove('active','wrong'); d.classList.add('correct'); });
    lockBody.classList.add('unlocked-glow');
    shackle.classList.add('open');
    statusDot.classList.remove('locked'); statusDot.classList.add('unlocked');
    statusText.textContent = 'ACCESS GRANTED';
    playSuccess();
    setTimeout(() => { accessGranted.style.display = 'flex'; }, 700);
  } else {
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
      enteredDigits = [];
      updateDisplay();
    }, 600);
    if (attempts <= 0) setTimeout(() => startLockout(), 700);
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
    if (remaining <= 0) { clearInterval(lockoutTimer); endLockout(); }
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
  enteredDigits = [];
  attempts  = MAX_ATTEMPTS;
  unlocked  = false;
  displayDs.forEach(d => { d.textContent = '_'; d.className = 'digit-slot'; });
  attemptsDots.forEach(dot => dot.classList.remove('used'));
  lockBody.classList.remove('unlocked-glow','error-glow');
  shackle.classList.remove('open');
  accessGranted.style.display = 'none';
  lockoutScreen.style.display = 'none';
  statusDot.classList.remove('locked','unlocked');
  statusText.textContent = 'SYSTEM ARMED';
}

/* ================================================
   MAIN NUMPAD EVENT LISTENERS
   ================================================ */
document.querySelectorAll('.numpad-key[data-num]').forEach(btn => {
  btn.addEventListener('click', () => numpadPress(parseInt(btn.dataset.num)));
});
document.getElementById('keyClear').addEventListener('click', numpadClear);
document.getElementById('keyEnter').addEventListener('click', numpadEnter);

window.addEventListener('keydown', e => {
  // Nếu modal đổi mật khẩu đang mở → dùng bàn phím cho modal
  if (chgOverlay.style.display === 'flex') {
    if (e.key >= '0' && e.key <= '9') { e.preventDefault(); chgNumpadPress(parseInt(e.key)); }
    else if (e.key === 'Backspace') { e.preventDefault(); chgNumpadDel(); }
    else if (e.key === 'Enter')     { e.preventDefault(); chgNumpadOk(); }
    else if (e.key === 'Escape')    { closeChgModal(); }
    return;
  }
  if (locked || unlocked) return;
  if (e.key >= '0' && e.key <= '9') { e.preventDefault(); numpadPress(parseInt(e.key)); }
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); numpadClear(); }
  else if (e.key === 'Enter') { e.preventDefault(); numpadEnter(); }
  else if (e.key === 'r' || e.key === 'R') resetAll();
});

btnReset.addEventListener('click', resetAll);
btnRelock.addEventListener('click', resetAll);

/* ================================================
   ĐỔI MẬT KHẨU — NUMPAD 3 BƯỚC
   ================================================ */

// State đổi mật khẩu
let chgStep = 1;           // 1 = nhập mã cũ, 2 = nhập mã mới, 3 = xác nhận mã mới
let chgBuffer = [];        // số đang nhập trong modal
let chgOldCode  = [];      // lưu mã cũ đã xác nhận
let chgNewCode  = [];      // lưu mã mới đã nhập

const STEP_PROMPTS = [
  'Nhập mật khẩu hiện tại',
  'Nhập mật khẩu mới (4 số)',
  'Nhập lại mật khẩu mới để xác nhận',
];

function openChgModal() {
  if (locked) return;
  chgStep   = 1;
  chgBuffer = [];
  chgOldCode  = [];
  chgNewCode  = [];
  updateChgDisplay();
  updateChgSteps();
  chgMsg.textContent = '';
  chgMsg.className = 'chg-msg';
  chgOverlay.style.display = 'flex';
}

function closeChgModal() {
  chgOverlay.style.display = 'none';
}

/** Cập nhật 4 chấm trong modal */
function updateChgDisplay() {
  chgDots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < chgBuffer.length);
    dot.classList.remove('error', 'success');
  });
}

/** Cập nhật step indicators */
function updateChgSteps() {
  [step1Dot, step2Dot, step3Dot].forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < chgStep)      el.classList.add('done');
    else if (i + 1 === chgStep) el.classList.add('active');
  });
  stepLine1.classList.toggle('done', chgStep > 1);
  stepLine2.classList.toggle('done', chgStep > 2);
  chgPrompt.textContent = STEP_PROMPTS[chgStep - 1];
}

/** Flash lỗi — rung đỏ */
function chgFlashError(msg) {
  chgDots.forEach(d => { d.classList.add('error'); d.classList.remove('filled'); });
  chgMsg.textContent = msg;
  chgMsg.className = 'chg-msg error';
  setTimeout(() => {
    chgBuffer = [];
    updateChgDisplay();
  }, 700);
}

/** Flash thành công — xanh lá */
function chgFlashSuccess(msg, cb) {
  chgDots.forEach(d => d.classList.add('success'));
  chgMsg.textContent = msg;
  chgMsg.className = 'chg-msg success';
  setTimeout(cb, 900);
}

/** Nhập 1 số vào modal */
function chgNumpadPress(num) {
  if (chgBuffer.length >= 4) return;
  chgBuffer.push(num);
  updateChgDisplay();
  playClick();
}

/** Xóa 1 số trong modal */
function chgNumpadDel() {
  if (!chgBuffer.length) return;
  chgBuffer.pop();
  updateChgDisplay();
  playClick();
}

/** Nhấn ✓ trong modal — xử lý từng bước */
function chgNumpadOk() {
  if (chgBuffer.length < 4) {
    // Chưa đủ 4 số
    chgMsg.textContent = '⚠ Cần nhập đủ 4 chữ số!';
    chgMsg.className = 'chg-msg error';
    return;
  }

  if (chgStep === 1) {
    // Bước 1: kiểm tra mật khẩu hiện tại
    if (chgBuffer.every((v, i) => v === SECRET_CODE[i])) {
      chgOldCode = [...chgBuffer];
      chgFlashSuccess('✔ Mật khẩu đúng!', () => {
        chgStep = 2;
        chgBuffer = [];
        updateChgDisplay();
        updateChgSteps();
        chgMsg.textContent = '';
        chgMsg.className = 'chg-msg';
      });
    } else {
      chgFlashError('✕ Mật khẩu hiện tại không đúng!');
    }

  } else if (chgStep === 2) {
    // Bước 2: nhập mật khẩu mới
    if (chgBuffer.every((v, i) => v === SECRET_CODE[i])) {
      chgFlashError('⚠ Mật khẩu mới phải khác mật khẩu cũ!');
      return;
    }
    chgNewCode = [...chgBuffer];
    chgFlashSuccess('✔ Mật khẩu mới đã lưu tạm!', () => {
      chgStep = 3;
      chgBuffer = [];
      updateChgDisplay();
      updateChgSteps();
      chgMsg.textContent = '';
      chgMsg.className = 'chg-msg';
    });

  } else if (chgStep === 3) {
    // Bước 3: xác nhận mật khẩu mới
    if (chgBuffer.every((v, i) => v === chgNewCode[i])) {
      // Thành công — lưu mã mới
      SECRET_CODE.splice(0, 4, ...chgNewCode);
      hintText.textContent = `Mật khẩu mới: ${chgNewCode.join(' - ')}`;
      chgFlashSuccess('✔ Đổi mật khẩu thành công!', () => {
        closeChgModal();
        playSuccess();
        // Nếu đang ở màn hình mở khóa thì giữ nguyên dashboard
        if (!unlocked) resetAll();
      });
    } else {
      chgFlashError('✕ Xác nhận không khớp! Thử lại.');
      setTimeout(() => {
        // Quay lại bước 2
        chgStep = 2;
        chgBuffer = [];
        chgNewCode = [];
        updateChgDisplay();
        updateChgSteps();
        chgMsg.textContent = '';
        chgMsg.className = 'chg-msg';
      }, 1100);
    }
  }
}

/* ---- Gán events cho modal ---- */
document.querySelectorAll('.chg-key[data-num]').forEach(btn => {
  btn.addEventListener('click', () => chgNumpadPress(parseInt(btn.dataset.num)));
});
chgDel.addEventListener('click', chgNumpadDel);
chgOk.addEventListener('click', chgNumpadOk);
chgClose.addEventListener('click', closeChgModal);
chgOverlay.addEventListener('click', e => { if (e.target === chgOverlay) closeChgModal(); });

/* ---- Nút ĐỔI MẬT KHẨU (cả 2 vị trí) ---- */
btnChange.addEventListener('click', openChgModal);
btnChangeUnlocked.addEventListener('click', openChgModal);
