// app.js - Minimalist Digital Lock App: Pure Display & Keypad Interface
class DigitalLockApp {
    constructor() {
        this.masterPin = '123456';
        this.guestPin = '888888';
        this.currentPinInput = '';
        this.isLocked = true;
        this.autoLockDelay = 5; // seconds
        this.autoLockTimer = null;
        this.failedAttempts = 0;
        this.maxFailedAttempts = 5;
        this.isLockout = false;
        this.battery = 92;

        // Change PIN via 3x '*' state machine
        this.starCount = 0;
        this.starTimer = null;
        this.pinMode = 'NORMAL'; // 'NORMAL' | 'OLD_PIN' | 'NEW_PIN' | 'CONFIRM_PIN'
        this.tempNewPin = '';

        this.registeredFingerprints = [
            { id: 1, name: 'Chủ nhà (Ngón cái phải)', valid: true },
            { id: 2, name: 'Thành viên gia đình', valid: true }
        ];

        this.registeredCards = [
            { id: 'RFID-KEY-01', name: 'Thẻ từ Master', valid: true },
            { id: 'RFID-KEY-02', name: 'Thẻ từ Khách', valid: true }
        ];

        this.init();
    }

    init() {
        // Initialize 3D Lock
        this.lock3d = new SmartLock3D('viewport-3d', {
            onKeypadPress: (key) => this.handleKeypadInput(key),
            onFingerprintTouch: () => this.handleFingerprintScan(true),
            onRfidTouch: () => this.handleRfidTap('RFID-KEY-01'),
            onOledUpdate: (title, sub, color) => this.handleOledUpdate(title, sub, color)
        });

        // Set initial camera directly to Keypad close-up
        this.lock3d.setCameraPreset('keypad');

        // Bind UI Elements
        this.bindEvents();

        // Update UI
        this.updateUI();
    }

    bindEvents() {
        // Camera presets
        document.querySelectorAll('.cam-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.lock3d.setCameraPreset(btn.dataset.preset);
            });
        });

        // Virtual Companion Keypad buttons
        document.querySelectorAll('.vk-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                this.lock3d.flashKeyMesh(key);
                this.handleKeypadInput(key);
            });
        });

        // Sound Toggle
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                window.lockAudio.enabled = e.target.checked;
            });
        }

        // Manual Lock Button
        const btnManualLock = document.getElementById('btn-manual-lock');
        if (btnManualLock) {
            btnManualLock.addEventListener('click', () => this.executeLock());
        }
    }

    handleKeypadInput(key) {
        if (this.isLockout) {
            window.lockAudio.playError();
            return;
        }

        // Wake 3D keypad backlight
        this.lock3d.wakeKeypad(true);
        window.lockAudio.playKeypad(key);

        // --- NORMAL MODE ---
        if (this.pinMode === 'NORMAL') {
            if (key === '*') {
                this.starCount++;
                if (this.starTimer) clearTimeout(this.starTimer);
                this.starTimer = setTimeout(() => {
                    this.starCount = 0;
                }, 1600);

                if (this.starCount >= 3) {
                    // Triggered 3x '*' to enter Change PIN mode!
                    this.starCount = 0;
                    clearTimeout(this.starTimer);
                    this.enterChangePinMode();
                    return;
                }

                // Normal cancel / clear
                this.currentPinInput = '';
                this.lock3d.updateOledScreen("READY", "CHẠM ĐỂ BẬT MÃ", "#00e5ff");
                this.updatePinDisplay();
                return;
            }

            // Any non-* key resets star sequence
            this.starCount = 0;

            if (key === '#') {
                this.verifyPasscode();
                return;
            }

            if (this.currentPinInput.length < 16) {
                this.currentPinInput += key;
            }

            this.updatePinDisplay();
            this.lock3d.updateOledScreen("NHẬP MÃ", "*".repeat(this.currentPinInput.length), "#00e5ff");
            return;
        }

        // --- CHANGE PIN MODE (VIA 3x '*') ---
        if (key === '*') {
            // Cancel change pin mode
            this.exitChangePinMode("ĐÃ HỦY ĐỔI MÃ");
            return;
        }

        if (key === '#') {
            this.processChangePinStep();
            return;
        }

        // Append digits for change pin
        if (this.currentPinInput.length < 12) {
            this.currentPinInput += key;
        }
        this.updatePinDisplay();
        this.updateChangePinOled();
    }

    enterChangePinMode() {
        this.pinMode = 'OLD_PIN';
        this.currentPinInput = '';
        this.tempNewPin = '';

        if (window.lockAudio && window.lockAudio.playWake) window.lockAudio.playWake();
        this.lock3d.updateOledScreen("ĐỔI MẬT KHẨU", "NHẬP MÃ CŨ + #", "#ffab00");
        this.updatePinDisplay();
    }

    processChangePinStep() {
        if (this.pinMode === 'OLD_PIN') {
            // Step 1: Verify current Master PIN
            if (this.currentPinInput === this.masterPin || this.currentPinInput.includes(this.masterPin)) {
                window.lockAudio.playSuccess();
                this.pinMode = 'NEW_PIN';
                this.currentPinInput = '';
                this.lock3d.updateOledScreen("MÃ CŨ ĐÚNG", "NHẬP MÃ MỚI + #", "#00e5ff");
                this.updatePinDisplay();
            } else {
                window.lockAudio.playError();
                this.lock3d.updateOledScreen("LỖI ĐỔI MÃ", "SAI MÃ HIỆN TẠI", "#ff1744");
                this.exitChangePinMode();
            }
            return;
        }

        if (this.pinMode === 'NEW_PIN') {
            // Step 2: Validate New PIN Length (at least 6 digits)
            if (this.currentPinInput.length < 6) {
                window.lockAudio.playError();
                this.lock3d.updateOledScreen("LỖI ĐỘ DÀI", "TỐI THIỂU 6 SỐ", "#ff1744");
                this.currentPinInput = '';
                this.updatePinDisplay();
                return;
            }

            this.tempNewPin = this.currentPinInput;
            this.pinMode = 'CONFIRM_PIN';
            this.currentPinInput = '';
            window.lockAudio.playTone(880, 'sine', 0.12, 0.15);
            this.lock3d.updateOledScreen("XÁC NHẬN MÃ", "NHẬP LẠI MÃ MỚI + #", "#00e5ff");
            this.updatePinDisplay();
            return;
        }

        if (this.pinMode === 'CONFIRM_PIN') {
            // Step 3: Validate Confirmation
            if (this.currentPinInput === this.tempNewPin) {
                // Success! Save new master PIN
                this.masterPin = this.tempNewPin;
                window.lockAudio.playSuccess();
                this.lock3d.updateOledScreen("THÀNH CÔNG", `MÃ MỚI: ${this.masterPin}`, "#00e676");
                this.exitChangePinMode(`ĐỔI MÃ THÀNH CÔNG (${this.masterPin})`, true);
            } else {
                window.lockAudio.playError();
                this.lock3d.updateOledScreen("LỖI XÁC NHẬN", "MÃ KHÔNG KHỚP", "#ff1744");
                this.exitChangePinMode();
            }
            return;
        }
    }

    updateChangePinOled() {
        const masked = "*".repeat(this.currentPinInput.length);
        if (this.pinMode === 'OLD_PIN') {
            this.lock3d.updateOledScreen("MÃ HIỆN TẠI", `${masked} (Bấm #)`, "#ffab00");
        } else if (this.pinMode === 'NEW_PIN') {
            this.lock3d.updateOledScreen("MÃ MỚI", `${masked} (Bấm #)`, "#00e5ff");
        } else if (this.pinMode === 'CONFIRM_PIN') {
            this.lock3d.updateOledScreen("XÁC NHẬN MÃ", `${masked} (Bấm #)`, "#00e5ff");
        }
    }

    exitChangePinMode(msg = "ĐÃ HỦY ĐỔI MÃ", isSuccess = false) {
        this.pinMode = 'NORMAL';
        this.currentPinInput = '';
        this.tempNewPin = '';
        this.starCount = 0;
        this.updatePinDisplay();

        setTimeout(() => {
            if (this.isLocked) {
                this.lock3d.updateOledScreen("READY", "CHẠM ĐỂ BẬT MÃ", "#00e5ff");
            }
        }, isSuccess ? 3000 : 2000);
    }

    verifyPasscode() {
        if (!this.currentPinInput) return;

        // Anti-peep verification: check if input contains master PIN or guest PIN
        const hasMaster = this.currentPinInput.includes(this.masterPin);
        const hasGuest = this.currentPinInput.includes(this.guestPin);

        if (hasMaster || hasGuest) {
            this.handleUnlockSuccess();
        } else {
            this.handleUnlockFail('Nhập sai mật mã PIN');
        }

        this.currentPinInput = '';
        this.updatePinDisplay();
    }

    handleFingerprintScan(isValid) {
        if (this.isLockout) return;

        window.lockAudio.playScan();
        this.lock3d.setFingerprintColor(0x00e5ff, 1.0);
        this.lock3d.updateOledScreen("QUÉT VÂN TAY", "ĐANG KIỂM TRA...", "#00e5ff");

        setTimeout(() => {
            if (isValid) {
                this.handleUnlockSuccess();
            } else {
                this.lock3d.setFingerprintColor(0xff1744, 1.0);
                this.handleUnlockFail('Vân tay không nhận diện được');
            }
        }, 500);
    }

    handleRfidTap(cardId) {
        if (this.isLockout) return;

        window.lockAudio.playCardTap();
        this.lock3d.updateOledScreen("QUÉT THẺ TỪ", "ĐANG ĐỌC RFID...", "#00e5ff");

        setTimeout(() => {
            const card = this.registeredCards.find(c => c.id === cardId);
            if (card && card.valid) {
                this.handleUnlockSuccess();
            } else {
                this.handleUnlockFail(`Thẻ từ không hợp lệ`);
            }
        }, 350);
    }

    handleOledUpdate(title, subtitle, color) {
        const appTitle = document.getElementById('app-oled-title');
        const appSub = document.getElementById('app-oled-sub');
        if (appTitle) {
            appTitle.textContent = title;
            appTitle.style.color = color;
        }
        if (appSub) {
            appSub.textContent = subtitle;
        }
    }

    handleUnlockSuccess() {
        this.failedAttempts = 0;
        this.isLocked = false;

        window.lockAudio.playSuccess();
        setTimeout(() => {
            window.lockAudio.playMotorUnlock();
        }, 200);

        this.lock3d.unlockAnimation();
        this.updateUI();

        // Trigger Auto-lock
        if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
        if (this.autoLockDelay > 0) {
            this.startAutoLockCountdown(this.autoLockDelay);
        }
    }

    handleUnlockFail(reason) {
        this.failedAttempts++;
        window.lockAudio.playError();
        this.lock3d.updateOledScreen("TỪ CHỐI", reason || "SAI MẬT MÃ", "#ff1744");

        if (this.failedAttempts >= this.maxFailedAttempts) {
            this.triggerLockout();
        } else {
            setTimeout(() => {
                if (this.isLocked && !this.isLockout) {
                    this.lock3d.sleepKeypad();
                }
            }, 2500);
        }

        this.updateUI();
    }

    startAutoLockCountdown(seconds) {
        let remaining = seconds;
        const countdownInterval = setInterval(() => {
            if (this.isLocked) {
                clearInterval(countdownInterval);
                return;
            }
            this.lock3d.updateOledScreen("CỬA MỞ", `Tự khóa sau ${remaining}s`, "#00e676");
            remaining--;
            if (remaining < 0) {
                clearInterval(countdownInterval);
                this.executeLock();
            }
        }, 1000);
    }

    executeLock() {
        if (this.isLocked) return;

        this.isLocked = true;
        window.lockAudio.playMotorUnlock();
        this.lock3d.lockAnimation();
        this.lock3d.sleepKeypad();
        this.updateUI();
    }

    triggerLockout() {
        this.isLockout = true;
        window.lockAudio.startAlarm();
        this.lock3d.updateOledScreen("LOCKOUT", "KHÓA BẢO MẬT 30S", "#ff1744");

        let left = 30;
        const interval = setInterval(() => {
            left--;
            this.lock3d.updateOledScreen("LOCKOUT", `Vui lòng đợi ${left}s`, "#ff1744");
            if (left <= 0) {
                clearInterval(interval);
                this.isLockout = false;
                this.failedAttempts = 0;
                window.lockAudio.stopAlarm();
                this.lock3d.updateOledScreen("READY", "CHẠM ĐỂ BẬT MÃ", "#00e5ff");
                this.lock3d.setFingerprintColor(0x40c4ff, 0.7);
                this.updateUI();
            }
        }, 1000);

        this.updateUI();
    }

    updatePinDisplay() {
        const pinScreen = document.getElementById('pin-display');
        if (pinScreen) {
            pinScreen.textContent = this.currentPinInput ? '• '.repeat(this.currentPinInput.length) : '_ _ _ _';
        }
    }

    updateUI() {
        const statusBadge = document.getElementById('lock-status-badge');
        const lockIcon = document.getElementById('lock-status-icon');
        const batteryText = document.getElementById('battery-level');

        if (statusBadge) {
            if (this.isLockout) {
                statusBadge.textContent = 'VÔ HIỆU HÓA';
                statusBadge.className = 'status-badge status-alarm';
            } else if (this.isLocked) {
                statusBadge.textContent = 'ĐÃ KHÓA';
                statusBadge.className = 'status-badge status-locked';
            } else {
                statusBadge.textContent = 'ĐÃ MỞ KHÓA';
                statusBadge.className = 'status-badge status-unlocked';
            }
        }

        if (lockIcon) {
            lockIcon.innerHTML = this.isLocked
                ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
                : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;
        }

        if (batteryText) {
            batteryText.textContent = `${this.battery}%`;
        }
    }
}

// Instantiate once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.app = new DigitalLockApp();
});
