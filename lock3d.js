// lock3d.js - Complete Three.js 3D Digital Smart Lock Simulation
class SmartLock3D {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onKeypadPress = options.onKeypadPress || (() => {});
        this.onFingerprintTouch = options.onFingerprintTouch || (() => {});
        this.onRfidTouch = options.onRfidTouch || (() => {});
        this.onOledUpdate = options.onOledUpdate || (() => {});

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // 3D Interactive elements
        this.keypadButtons = [];
        this.fingerprintSensor = null;
        this.rfidZone = null;

        this.oledCanvas = null;
        this.oledTexture = null;
        this.oledMaterial = null;

        // Animated parts
        this.doorGroup = null;
        this.handleGroup = null;
        this.deadbolts = [];
        this.latchBolt = null;
        this.fpGlowRing = null;

        // Animation states
        this.isUnlocked = false;
        this.isDoorOpen = false;
        this.handleTargetRotation = 0;
        this.handleCurrentRotation = 0;
        this.deadboltTargetX = 0; // 0 = extended (locked), -0.06 = retracted (unlocked)
        this.deadboltCurrentX = 0;
        this.doorTargetAngle = 0;
        this.doorCurrentAngle = 0;

        // Keypad Wake/Sleep state (Sleep by default, wakes when typing or touched)
        this.isKeypadAwake = false;
        this.keypadSleepTimeout = null;

        // Exact Camera coordinates:
        // Door Hinge Pivot is at x = -0.48. Lock is at x = 0.72 inside doorGroup.
        // Therefore, Lock center in World X = -0.48 + 0.72 = 0.24.
        // Interaction center World Y = 0.05 + 0.10 = 0.15.
        // Camera positioned at (0.24, 0.14, 0.52) to ensure the OLED screen,
        // keypad, and handle are centered and 100% visible below the navigation bar.
        this.cameraTargetPos = new THREE.Vector3(0.24, 0.14, 0.52);
        this.cameraLookTarget = new THREE.Vector3(0.24, 0.14, 0.082);

        this.hoveredButton = null;
        this.clock = new THREE.Clock();

        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e17);
        this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.35);

        // Camera setup - zoomed into Lock face by default
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 50);
        this.camera.position.set(0.24, 0.14, 0.52);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.container.appendChild(this.renderer.domElement);

        // OrbitControls centered on Lock interaction zone
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.15;
        this.controls.minDistance = 0.20;
        this.controls.maxDistance = 3.5;
        this.controls.target.set(0.24, 0.14, 0.082);

        // Lighting
        this.setupLighting();

        // Procedural Textures & Materials
        this.setupTexturesAndMaterials();

        // Build Environment and Smart Lock
        this.buildScene();

        // Event listeners
        window.addEventListener('resize', this.onResize.bind(this));
        this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));

        // Start render loop
        this.animate();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambientLight);

        // Key light with soft shadow
        const mainLight = new THREE.DirectionalLight(0xfffaed, 2.4);
        mainLight.position.set(1.5, 2.5, 2.0);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 10;
        mainLight.shadow.bias = -0.0005;
        this.scene.add(mainLight);

        // Blue/Cyan Rim Light (Cyberpunk Accent)
        const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.8);
        rimLight.position.set(-2, 1, 0.5);
        this.scene.add(rimLight);

        // Warm interior room light behind the door
        const interiorLight = new THREE.PointLight(0xffb74d, 1.5, 5);
        interiorLight.position.set(0.2, 0.5, -0.8);
        this.scene.add(interiorLight);

        // Keypad dedicated spotlight directly in front of the lock
        this.keypadLight = new THREE.PointLight(0x40c4ff, 0.8, 1.2);
        this.keypadLight.position.set(0.24, 0.20, 0.35);
        this.scene.add(this.keypadLight);
    }

    createWoodTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Base luxury deep walnut wood
        ctx.fillStyle = '#221510';
        ctx.fillRect(0, 0, 1024, 1024);

        // Grain bands
        for (let i = 0; i < 1000; i++) {
            const y = Math.random() * 1024;
            const h = Math.random() * 4 + 1;
            const alpha = Math.random() * 0.15 + 0.05;
            ctx.fillStyle = (Math.random() > 0.5 ? 'rgba(50, 30, 20, ' : 'rgba(15, 8, 5, ') + alpha + ')';
            ctx.fillRect(0, y, 1024, h);
        }

        // Vertical fine fibers
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 1024; x += 4) {
            ctx.beginPath();
            ctx.moveTo(x + (Math.random() - 0.5) * 4, 0);
            ctx.bezierCurveTo(
                x + Math.sin(0.01 * x) * 10, 340,
                x + Math.cos(0.01 * x) * 8, 680,
                x + (Math.random() - 0.5) * 4, 1024
            );
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 2);
        return texture;
    }

    createBrushedMetalTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#22252c';
        ctx.fillRect(0, 0, 512, 512);

        // Brushed noise lines
        for (let i = 0; i < 6000; i++) {
            const y = Math.random() * 512;
            const len = Math.random() * 120 + 30;
            const x = Math.random() * 512;
            const shade = Math.floor(Math.random() * 40 + 35);
            ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 5}, 0.2)`;
            ctx.fillRect(x, y, len, 1);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    setupTexturesAndMaterials() {
        const woodTex = this.createWoodTexture();
        const metalTex = this.createBrushedMetalTexture();

        // Luxury Door Material
        this.matDoor = new THREE.MeshStandardMaterial({
            map: woodTex,
            roughness: 0.45,
            metalness: 0.1
        });

        // Smart Lock Body (Anodized Satin Black Zinc Alloy)
        this.matLockBody = new THREE.MeshStandardMaterial({
            color: 0x14171d,
            map: metalTex,
            roughness: 0.35,
            metalness: 0.85
        });

        // Polished Chrome Bezel / Trim
        this.matChrome = new THREE.MeshStandardMaterial({
            color: 0xd8e0e8,
            roughness: 0.15,
            metalness: 0.95
        });

        // Glossy Acrylic / Tempered Glass Screen Panel
        this.matGlassPanel = new THREE.MeshStandardMaterial({
            color: 0x07090e,
            roughness: 0.08,
            metalness: 0.92
        });

        // Stainless Steel Mortise Bolt
        this.matStainless = new THREE.MeshStandardMaterial({
            color: 0xd0d5dd,
            roughness: 0.2,
            metalness: 0.9
        });

        // Wall Material
        this.matWall = new THREE.MeshStandardMaterial({
            color: 0x161a22,
            roughness: 0.85,
            metalness: 0.05
        });
    }

    buildScene() {
        // --- 1. WALL & DOOR FRAME ---
        const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.2), this.matWall);
        wallLeft.position.set(-0.95, 0, 0);
        wallLeft.receiveShadow = true;
        this.scene.add(wallLeft);

        const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.2), this.matWall);
        wallRight.position.set(0.95, 0, 0);
        wallRight.receiveShadow = true;
        this.scene.add(wallRight);

        const wallTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.5, 0.2), this.matWall);
        wallTop.position.set(0, 1.4, 0);
        this.scene.add(wallTop);

        // Door Frame Strike Plate
        const strikePlate = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.3, 0.12),
            this.matStainless
        );
        strikePlate.position.set(0.48, 0, 0);
        this.scene.add(strikePlate);

        // Frame holes for deadbolts
        for (let i = 0; i < 3; i++) {
            const holeMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.013, 0.013, 0.05, 16),
                new THREE.MeshBasicMaterial({ color: 0x050505 })
            );
            holeMesh.rotation.z = Math.PI / 2;
            holeMesh.position.set(0.485, (i - 1) * 0.04, 0.01);
            this.scene.add(holeMesh);
        }

        // --- 2. DOOR (Rotatable on Hinges) ---
        this.doorHingePivot = new THREE.Group();
        this.doorHingePivot.position.set(-0.48, 0, 0);
        this.scene.add(this.doorHingePivot);

        this.doorGroup = new THREE.Group();
        this.doorHingePivot.add(this.doorGroup);

        const doorMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.95, 2.3, 0.08),
            this.matDoor
        );
        doorMesh.position.set(0.475, 0, 0);
        doorMesh.castShadow = true;
        doorMesh.receiveShadow = true;
        this.doorGroup.add(doorMesh);

        // Aesthetic groove line on door
        const groove = new THREE.Mesh(
            new THREE.BoxGeometry(0.01, 2.1, 0.005),
            this.matLockBody
        );
        groove.position.set(0.2, 0, 0.041);
        this.doorGroup.add(groove);

        // --- 3. DIGITAL SMART LOCK ASSEMBLY ---
        this.buildSmartLock(doorMesh);
    }

    buildSmartLock(doorParent) {
        this.lockGroup = new THREE.Group();
        // Position on the door: World X = -0.48 + 0.72 = 0.24, World Y = 0.05
        this.lockGroup.position.set(0.72, 0.05, 0.04);
        this.doorGroup.add(this.lockGroup);

        // --- Outer Escutcheon Plate (Base body) ---
        const lockWidth = 0.15;
        const lockHeight = 0.68;
        const lockDepth = 0.035;

        // Rounded box body
        const lockBaseGeom = this.createRoundedBoxGeom(lockWidth, lockHeight, lockDepth, 0.018);
        const lockBase = new THREE.Mesh(lockBaseGeom, this.matLockBody);
        lockBase.position.set(0, 0, lockDepth / 2);
        lockBase.castShadow = true;
        lockBase.receiveShadow = true;
        this.lockGroup.add(lockBase);

        // Polished Chrome Rim Accent Line
        const rimGeom = this.createRoundedBoxGeom(lockWidth + 0.006, lockHeight + 0.006, 0.006, 0.02);
        const rimMesh = new THREE.Mesh(rimGeom, this.matChrome);
        rimMesh.position.set(0, 0, 0.003);
        this.lockGroup.add(rimMesh);

        // --- Tempered Glass Touch Screen Panel (Upper half) ---
        const panelWidth = 0.13;
        const panelHeight = 0.36;
        const panelDepth = 0.004;
        const glassPanel = new THREE.Mesh(
            new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth),
            this.matGlassPanel
        );
        glassPanel.position.set(0, 0.125, lockDepth + panelDepth / 2);
        glassPanel.userData = { isGlassWake: true };
        this.lockGroup.add(glassPanel);
        this.glassPanel = glassPanel;

        // --- OLED Display Canvas Texture (Top prominent position) ---
        this.setupOledDisplay();

        // --- Capacitive Touch Keypad (3x4 grid) ---
        this.setupKeypad();

        // --- RFID / NFC Sensor Area ---
        this.setupRfidArea();

        // --- Smart Handle with Integrated Fingerprint Scanner ---
        this.setupHandleAndFingerprint();

        // --- Side Mortise Lock Body & Animated Deadbolts ---
        this.setupMortiseMechanism();

        // --- Emergency Keyhole & USB-C Port (Bottom) ---
        this.setupEmergencyPort();
    }

    createRoundedBoxGeom(width, height, depth, radius) {
        const shape = new THREE.Shape();
        const x = -width / 2;
        const y = -height / 2;
        const w = width;
        const h = height;
        const r = radius;

        shape.moveTo(x + r, y);
        shape.lineTo(x + w - r, y);
        shape.quadraticCurveTo(x + w, y, x + w, y + r);
        shape.lineTo(x + w, y + h - r);
        shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        shape.lineTo(x + r, y + h);
        shape.quadraticCurveTo(x, y + h, x, y + h - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);

        const extrudeSettings = {
            depth: depth,
            bevelEnabled: true,
            bevelSegments: 4,
            steps: 1,
            bevelSize: 0.005,
            bevelThickness: 0.005
        };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    setupOledDisplay() {
        // Physical Bezel frame around OLED display
        const oledBezel = new THREE.Mesh(
            new THREE.BoxGeometry(0.124, 0.052, 0.002),
            this.matChrome
        );
        oledBezel.position.set(0, 0.235, 0.040);
        this.lockGroup.add(oledBezel);

        const oledBacking = new THREE.Mesh(
            new THREE.BoxGeometry(0.120, 0.048, 0.002),
            new THREE.MeshBasicMaterial({ color: 0x030710 })
        );
        oledBacking.position.set(0, 0.235, 0.041);
        this.lockGroup.add(oledBacking);

        // Vibrant High-Res Canvas Display
        this.oledCanvas = document.createElement('canvas');
        this.oledCanvas.width = 512;
        this.oledCanvas.height = 200;
        this.oledCtx = this.oledCanvas.getContext('2d');

        this.oledTexture = new THREE.CanvasTexture(this.oledCanvas);
        this.oledTexture.anisotropy = 4;

        this.oledMaterial = new THREE.MeshBasicMaterial({
            map: this.oledTexture,
            transparent: true,
            depthWrite: false
        });

        const oledMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.116, 0.046),
            this.oledMaterial
        );
        oledMesh.position.set(0, 0.235, 0.0425);
        this.lockGroup.add(oledMesh);

        this.updateOledScreen("READY", "CHẠM ĐỂ BẬT MÃ", "#00e5ff");
    }

    updateOledScreen(title, subtitle, color = "#00e5ff") {
        if (!this.oledCtx) return;
        const ctx = this.oledCtx;

        // Background
        ctx.fillStyle = '#050c18';
        ctx.fillRect(0, 0, 512, 200);

        // High-tech Glowing Screen Frame
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.strokeRect(6, 6, 500, 188);

        // Top Status Bar: Battery, Time, BLE
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '22px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('🔋 92%', 20, 36);

        ctx.textAlign = 'center';
        ctx.fillText('20:25', 256, 36);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('📶 BLE', 492, 36);

        // Thin Divider Line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(16, 48);
        ctx.lineTo(496, 48);
        ctx.stroke();

        // Main Status Title (Large, Glowing)
        ctx.fillStyle = color;
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillText(title, 256, 114);
        ctx.shadowBlur = 0;

        // Subtitle / Prompt
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(subtitle, 256, 168);

        this.oledTexture.needsUpdate = true;

        // Sync with app
        if (this.onOledUpdate) {
            this.onOledUpdate(title, subtitle, color);
        }
    }

    setupKeypad() {
        const keys = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['*', '0', '#']
        ];

        // 3 columns: -0.036, 0, +0.036
        // 4 rows: 0.155, 0.115, 0.075, 0.035
        const startX = -0.036;
        const startY = 0.155;
        const stepX = 0.036;
        const stepY = 0.040;

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                const label = keys[row][col];
                const keyMesh = this.createKeyMesh(label);
                const posX = startX + col * stepX;
                const posY = startY - row * stepY;
                keyMesh.position.set(posX, posY, 0.043);
                keyMesh.userData = {
                    isKeypad: true,
                    key: label,
                    basePos: new THREE.Vector3(posX, posY, 0.043),
                    baseScale: new THREE.Vector3(1, 1, 1)
                };
                this.lockGroup.add(keyMesh);
                this.keypadButtons.push(keyMesh);
            }
        }
    }

    createKeyMesh(label) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 256, 256);

        // Outer soft glow ring
        const grad = ctx.createRadialGradient(128, 128, 70, 128, 128, 124);
        grad.addColorStop(0, 'rgba(10, 25, 45, 0.7)');
        grad.addColorStop(0.85, 'rgba(20, 45, 75, 0.85)');
        grad.addColorStop(1, 'rgba(64, 196, 255, 0.4)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(128, 128, 115, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(64, 196, 255, 0.7)';
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 115px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 12;
        ctx.fillText(label, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;

        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.04, // Initial sleep mode
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const geom = new THREE.PlaneGeometry(0.030, 0.030);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.userData.canvas = canvas;
        mesh.userData.ctx = ctx;
        mesh.userData.texture = tex;
        return mesh;
    }

    wakeKeypad(resetTimer = true) {
        this.isKeypadAwake = true;
        if (this.keypadLight) this.keypadLight.intensity = 1.0;

        for (const btn of this.keypadButtons) {
            btn.material.opacity = 0.95;
            btn.material.color.setHex(0xffffff);
        }

        if (resetTimer) {
            if (this.keypadSleepTimeout) clearTimeout(this.keypadSleepTimeout);
            this.keypadSleepTimeout = setTimeout(() => {
                if (!this.isUnlocked) {
                    this.sleepKeypad();
                }
            }, 8000);
        }
    }

    sleepKeypad() {
        if (this.isUnlocked) return;
        this.isKeypadAwake = false;
        if (this.keypadLight) this.keypadLight.intensity = 0.2;

        for (const btn of this.keypadButtons) {
            btn.material.opacity = 0.04;
            btn.material.color.setHex(0xffffff);
        }

        this.updateOledScreen("READY", "CHẠM ĐỂ BẬT MÃ", "#00e5ff");
    }

    flashKeyMesh(keyStr) {
        this.wakeKeypad(true);
        const btn = this.keypadButtons.find(b => b.userData.key === keyStr);
        if (btn) {
            btn.scale.set(0.88, 0.88, 1);
            btn.position.z = 0.040;
            btn.material.opacity = 1.0;
            btn.material.color.setHex(0x00ffff);

            setTimeout(() => {
                btn.scale.set(1, 1, 1);
                btn.position.z = 0.043;
                btn.material.color.setHex(0xffffff);
            }, 140);
        }
    }

    setupRfidArea() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 128, 128);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(64, 64, 40, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(64, 64, 25, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();

        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(64, 64, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CARD', 64, 116);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        });

        this.rfidZone = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.038), mat);
        this.rfidZone.position.set(0, -0.015, 0.042);
        this.rfidZone.userData = { isRfid: true };
        this.lockGroup.add(this.rfidZone);
    }

    setupHandleAndFingerprint() {
        this.handleGroup = new THREE.Group();
        this.handleGroup.position.set(0, -0.11, 0.04);
        this.lockGroup.add(this.handleGroup);

        const handleBoss = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.034, 0.02, 32),
            this.matChrome
        );
        handleBoss.rotation.x = Math.PI / 2;
        handleBoss.position.set(0, 0, 0.01);
        this.handleGroup.add(handleBoss);

        const leverGeom = new THREE.BoxGeometry(0.18, 0.032, 0.024);
        leverGeom.translate(0.09, 0, 0);
        const lever = new THREE.Mesh(leverGeom, this.matLockBody);
        lever.position.set(0, 0, 0.022);
        lever.castShadow = true;
        this.handleGroup.add(lever);

        const handleCap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.016, 0.024, 16),
            this.matChrome
        );
        handleCap.position.set(0.18, 0, 0.022);
        this.handleGroup.add(handleCap);

        // FINGERPRINT SCANNER
        const fpBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, 0.005, 32),
            new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.15, metalness: 0.9 })
        );
        fpBase.rotation.x = Math.PI / 2;
        fpBase.position.set(0, 0, 0.022);
        fpBase.userData = { isFingerprint: true };
        this.handleGroup.add(fpBase);
        this.fingerprintSensor = fpBase;

        const ringGeom = new THREE.RingGeometry(0.017, 0.021, 32);
        this.fpRingMat = new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        this.fpGlowRing = new THREE.Mesh(ringGeom, this.fpRingMat);
        this.fpGlowRing.position.set(0, 0, 0.025);
        this.handleGroup.add(this.fpGlowRing);
    }

    setupMortiseMechanism() {
        const mortiseGroup = new THREE.Group();
        mortiseGroup.position.set(0.95, 0.05, 0);
        this.doorGroup.add(mortiseGroup);

        const faceplate = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, 0.45, 0.055),
            this.matStainless
        );
        faceplate.position.set(0, 0, 0);
        mortiseGroup.add(faceplate);

        const latchGeom = new THREE.BoxGeometry(0.04, 0.028, 0.035);
        this.latchBolt = new THREE.Mesh(latchGeom, this.matStainless);
        this.latchBolt.position.set(0.02, 0.09, 0);
        mortiseGroup.add(this.latchBolt);

        this.deadbolts = [];
        for (let i = 0; i < 3; i++) {
            const boltGeom = new THREE.CylinderGeometry(0.011, 0.011, 0.055, 24);
            boltGeom.rotateZ(Math.PI / 2);
            const bolt = new THREE.Mesh(boltGeom, this.matStainless);
            bolt.position.set(0.025, (i - 1) * 0.04 - 0.04, 0);
            mortiseGroup.add(bolt);
            this.deadbolts.push(bolt);
        }
    }

    setupEmergencyPort() {
        const slot = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.008, 0.005),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        slot.position.set(0, -0.32, 0.02);
        this.lockGroup.add(slot);
    }

    setFingerprintColor(hexColor, intensity = 1.0) {
        if (this.fpRingMat) {
            this.fpRingMat.color.setHex(hexColor);
            this.fpRingMat.opacity = intensity;
        }
    }

    unlockAnimation() {
        this.isUnlocked = true;
        this.deadboltTargetX = -0.045; // retract deadbolts
        this.handleTargetRotation = -Math.PI / 5.5; // push handle down ~32 deg
        this.doorTargetAngle = 0.55; // swing door open ~31 deg

        this.setFingerprintColor(0x00e676, 1.0); // vibrant green
        this.updateOledScreen("UNLOCKED", "CỬA ĐÃ MỞ", "#00e676");
    }

    lockAnimation() {
        this.isUnlocked = false;
        this.deadboltTargetX = 0; // extend deadbolts
        this.handleTargetRotation = 0; // return handle upright
        this.doorTargetAngle = 0; // close door

        this.setFingerprintColor(0x40c4ff, 0.7); // cyan standby
        this.updateOledScreen("LOCKED", "KHÓA ĐÃ ĐÓNG", "#00e5ff");
    }

    setCameraPreset(name) {
        if (name === 'keypad') {
            // Lock face: centered and fully visible
            this.cameraTargetPos.set(0.24, 0.14, 0.52);
            this.cameraLookTarget.set(0.24, 0.14, 0.082);
        } else if (name === 'full') {
            // Full door view
            this.cameraTargetPos.set(0.1, 0.05, 2.2);
            this.cameraLookTarget.set(0, 0, 0);
        }
    }

    onPointerMove(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const interactables = [...this.keypadButtons, this.glassPanel, this.fingerprintSensor, this.rfidZone].filter(Boolean);
        const intersects = this.raycaster.intersectObjects(interactables, true);

        if (intersects.length > 0) {
            let hit = intersects[0].object;
            while (hit && !hit.userData.isKeypad && !hit.userData.isGlassWake && !hit.userData.isFingerprint && !hit.userData.isRfid && hit.parent) {
                hit = hit.parent;
            }

            this.renderer.domElement.style.cursor = 'pointer';

            // Keypad hover glow effect (when awake)
            if (hit && hit.userData.isKeypad && this.isKeypadAwake) {
                if (this.hoveredButton !== hit) {
                    if (this.hoveredButton) {
                        this.hoveredButton.scale.set(1, 1, 1);
                        this.hoveredButton.material.opacity = 0.95;
                    }
                    this.hoveredButton = hit;
                    hit.scale.set(1.08, 1.08, 1);
                    hit.material.opacity = 1.0;
                }
            } else if (this.hoveredButton) {
                this.hoveredButton.scale.set(1, 1, 1);
                this.hoveredButton.material.opacity = this.isKeypadAwake ? 0.95 : 0.04;
                this.hoveredButton = null;
            }
        } else {
            this.renderer.domElement.style.cursor = 'default';
            if (this.hoveredButton) {
                this.hoveredButton.scale.set(1, 1, 1);
                this.hoveredButton.material.opacity = this.isKeypadAwake ? 0.95 : 0.04;
                this.hoveredButton = null;
            }
        }
    }

    onPointerDown(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const interactables = [...this.keypadButtons, this.glassPanel, this.fingerprintSensor, this.rfidZone].filter(Boolean);
        const intersects = this.raycaster.intersectObjects(interactables, true);

        if (intersects.length > 0) {
            let hit = intersects[0].object;
            while (hit && !hit.userData.isKeypad && !hit.userData.isGlassWake && !hit.userData.isFingerprint && !hit.userData.isRfid && hit.parent) {
                hit = hit.parent;
            }

            if (hit && hit.userData.isKeypad) {
                this.wakeKeypad(true);
                this.flashKeyMesh(hit.userData.key);
                this.onKeypadPress(hit.userData.key);
            } else if (hit && hit.userData.isGlassWake) {
                // Touched 3D glass panel -> Wake up keypad!
                if (!this.isKeypadAwake) {
                    this.wakeKeypad(true);
                    if (window.lockAudio && window.lockAudio.playWake) {
                        window.lockAudio.playWake();
                    }
                    this.updateOledScreen("NHẬP MÃ PIN", "XIN MỜI NHẬP", "#00e5ff");
                }
            } else if (hit && hit.userData.isFingerprint) {
                this.onFingerprintTouch();
            } else if (hit && hit.userData.isRfid) {
                this.onRfidTouch();
            }
        }
    }

    onResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Smooth camera tweening
        this.camera.position.lerp(this.cameraTargetPos, 0.08);
        this.controls.target.lerp(this.cameraLookTarget, 0.08);
        this.controls.update();

        // Fingerprint pulsing animation on standby
        if (!this.isUnlocked && this.fpRingMat) {
            const pulse = 0.5 + 0.3 * Math.sin(time * 3);
            this.fpRingMat.opacity = pulse;
        }

        // Animate deadbolts sliding in/out
        this.deadboltCurrentX = THREE.MathUtils.lerp(this.deadboltCurrentX, this.deadboltTargetX, 0.12);
        for (const bolt of this.deadbolts) {
            bolt.position.x = 0.025 + this.deadboltCurrentX;
        }
        if (this.latchBolt) {
            this.latchBolt.position.x = 0.02 + this.deadboltCurrentX * 0.8;
        }

        // Animate door handle rotation
        this.handleCurrentRotation = THREE.MathUtils.lerp(this.handleCurrentRotation, this.handleTargetRotation, 0.1);
        if (this.handleGroup) {
            this.handleGroup.rotation.z = this.handleCurrentRotation;
        }

        // Animate door swing angle
        this.doorCurrentAngle = THREE.MathUtils.lerp(this.doorCurrentAngle, this.doorTargetAngle, 0.05);
        if (this.doorHingePivot) {
            this.doorHingePivot.rotation.y = -this.doorCurrentAngle;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.SmartLock3D = SmartLock3D;
