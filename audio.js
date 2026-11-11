// audio.js - Web Audio API Sound Synthesizer for Smart Lock
class LockAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
        if (!this.enabled) return;
        this.init();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn('Audio error', e);
        }
    }

    playKeypad(num) {
        if (!this.enabled) return;
        this.init();
        // Modern crisp touch tone
        const freqs = {
            '1': 697, '2': 770, '3': 852,
            '4': 697, '5': 770, '6': 852,
            '7': 697, '8': 770, '9': 852,
            '*': 941, '0': 770, '#': 941
        };
        const f = freqs[num] || 800;
        this.playTone(f * 1.5, 'sine', 0.08, 0.12);
        this.playTone(f * 2.2, 'triangle', 0.05, 0.05);
    }

    playSuccess() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0.12, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.25);
        });
    }

    playError() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        [0, 0.15].forEach(delay => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, now + delay);

            gain.gain.setValueAtTime(0.15, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + delay);
            osc.stop(now + delay + 0.12);
        });
    }

    playScan() {
        if (!this.enabled) return;
        this.init();
        // High-tech laser sweep
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(2400, now + 0.15);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    playCardTap() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        this.playTone(1800, 'sine', 0.08, 0.12);
        setTimeout(() => this.playTone(2400, 'sine', 0.1, 0.1), 90);
    }

    playWake() {
        if (!this.enabled) return;
        this.init();
        this.playTone(880, 'sine', 0.07, 0.1);
        setTimeout(() => this.playTone(1320, 'sine', 0.12, 0.12), 60);
    }

    playDingDong() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;

        // High "Ding" (G5 - 784 Hz)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(783.99, now);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.6);

        // Resonant "Dong" (E5 - 659 Hz)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.28);
        gain2.gain.setValueAtTime(0.22, now + 0.28);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now + 0.28);
        osc2.stop(now + 1.1);
    }

    playMotorUnlock() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;

        // Mechanical whirr (FM synthesis)
        const carrier = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const mainGain = this.ctx.createGain();

        carrier.type = 'sawtooth';
        carrier.frequency.setValueAtTime(140, now);
        carrier.frequency.linearRampToValueAtTime(220, now + 0.25);
        carrier.frequency.linearRampToValueAtTime(110, now + 0.45);

        mod.type = 'square';
        mod.frequency.setValueAtTime(45, now);
        modGain.gain.setValueAtTime(50, now);

        mod.connect(carrier.frequency);

        mainGain.gain.setValueAtTime(0.08, now);
        mainGain.gain.linearRampToValueAtTime(0.12, now + 0.2);
        mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        carrier.connect(mainGain);
        mainGain.connect(this.ctx.destination);

        carrier.start(now);
        mod.start(now);
        carrier.stop(now + 0.5);
        mod.stop(now + 0.5);

        // Snap sound at the end
        setTimeout(() => {
            this.playMechanicalClick();
        }, 320);
    }

    playMechanicalClick() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    startAlarm() {
        if (!this.enabled) return;
        this.init();
        if (this.alarmInterval) return;

        let high = true;
        this.alarmInterval = setInterval(() => {
            this.playTone(high ? 1100 : 800, 'square', 0.18, 0.2);
            high = !high;
        }, 200);
    }

    stopAlarm() {
        if (this.alarmInterval) {
            clearInterval(this.alarmInterval);
            this.alarmInterval = null;
        }
    }
}

window.lockAudio = new LockAudio();
