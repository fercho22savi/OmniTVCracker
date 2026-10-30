/**
 * TV PIN CODENAME: ULTIMATE CODIFICADOR v4.0
 * Multi-Thread Simulation & Core Process Controller
 */

(function () {
  'use strict';

  // ==========================================
  // CONFIGURATION & 5-THREAD ARCHITECTURE
  // ==========================================
  const THREADS = [
    {
      id: 0,
      name: 'HILO 1',
      colorName: 'VERDE',
      colorClass: 'pfx-green',
      rangeStart: 0,
      rangeEnd: 1999,
      currentPin: 412,
      testedCount: 412,
      status: 'IDLE'
    },
    {
      id: 1,
      name: 'HILO 2',
      colorName: 'AZUL',
      colorClass: 'pfx-blue',
      rangeStart: 2000,
      rangeEnd: 3999,
      currentPin: 2980,
      testedCount: 980,
      status: 'IDLE'
    },
    {
      id: 2,
      name: 'HILO 3',
      colorName: 'AMARILLO',
      colorClass: 'pfx-yellow',
      rangeStart: 4000,
      rangeEnd: 5999,
      currentPin: 4381,
      testedCount: 381,
      status: 'IDLE'
    },
    {
      id: 3,
      name: 'HILO 4',
      colorName: 'MAGENTA',
      colorClass: 'pfx-magenta',
      rangeStart: 6000,
      rangeEnd: 7999,
      currentPin: 7105,
      testedCount: 1105,
      status: 'IDLE'
    },
    {
      id: 4,
      name: 'HILO 5',
      colorName: 'CIAN',
      colorClass: 'pfx-cyan',
      rangeStart: 8000,
      rangeEnd: 9999,
      currentPin: 9234,
      testedCount: 1234,
      status: 'IDLE'
    }
  ];

  const STATE = {
    status: 'PAUSED', // 'RUNNING', 'PAUSED', 'STOPPED', 'FOUND'
    targetPin: 4381,
    totalPins: 10000,
    startTime: 0,
    elapsedMs: 195200, // 00:03:15:20 = (3*60 + 15)*1000 + 200 = 195200 ms
    
    speedModes: [
      { id: 'normal', name: 'NORMAL (1.6s)', ms: 1600, label: '5 intentos / 1.6s (3.12 Hz)' },
      { id: 'fast', name: 'RÁPIDO (0.4s)', ms: 400, label: '5 intentos / 0.4s (12.5 Hz)' },
      { id: 'turbo', name: 'TURBO (40ms)', ms: 40, label: '~125 intentos / s (Turbo)' }
    ],
    currentSpeedIndex: 0,

    audioEnabled: true,
    connected: true,
    device: 'android',
    timerInterval: null,
    processTimeout: null
  };

  const DEVICE_INFO = {
    android: { label: 'ANDROID TV OS', port: '4500 / 3000', protocol: 'ADB Multi-Channel' },
    roku: { label: 'ROKU OS', port: '8060 / 8061', protocol: 'Roku ECP Remote Protocol' },
    samsung: { label: 'SAMSUNG TIZEN', port: '8001 / 8002', protocol: 'SmartView WSS Sockets' },
    lg: { label: 'LG WEBOS', port: '3000 / 3001', protocol: 'SSAP Multi-Socket Service' }
  };

  // ==========================================
  // DOM ELEMENTS CACHE
  // ==========================================
  const elements = {
    // Top Bar
    btnAudio: document.getElementById('btn-audio'),
    btnSpeed: document.getElementById('btn-speed'),
    speedIndicator: document.getElementById('speed-indicator'),
    btnTargetPin: document.getElementById('btn-target-pin'),
    targetPinVal: document.getElementById('target-pin-val'),
    btnDemoTest: document.getElementById('btn-demo-test'),
    btnFullscreen: document.getElementById('btn-fullscreen'),

    // Left Panel
    deviceSelect: document.getElementById('device-select'),
    ipAddress: document.getElementById('ip-address'),
    connBadge: document.getElementById('conn-badge'),
    portInput: document.getElementById('port-input'),
    subnetSelect: document.getElementById('subnet-select'),
    tvScreen: document.getElementById('tv-screen'),
    tvSpinner: document.getElementById('tv-spinner'),
    tvOverlay: document.getElementById('tv-overlay'),
    tvDeviceLabel: document.getElementById('tv-device-label'),
    tvLed: document.getElementById('tv-led'),

    // Center Panel (Multi-Thread)
    centerTitle: document.getElementById('center-panel-title'),
    globalProgressFill: document.getElementById('global-progress-fill'),
    globalProgressPct: document.getElementById('global-progress-pct'),
    globalProgressCount: document.getElementById('global-progress-count'),
    timerDisplay: document.getElementById('timer-display'),

    // Threads DOM Map
    threads: THREADS.map((t, idx) => ({
      row: document.getElementById(`thread-row-${idx}`),
      digits: Array.from(document.querySelectorAll(`#thread-digits-${idx} .t-digit-val`)),
      digitBoxes: Array.from(document.querySelectorAll(`#thread-digits-${idx} .t-digit`)),
      barFill: document.getElementById(`t-fill-${idx}`),
      label: document.getElementById(`t-label-${idx}`)
    })),

    // Right Panel
    terminalLogs: document.getElementById('terminal-logs'),
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnStop: document.getElementById('btn-stop'),

    // Status bar
    netStatusVal: document.getElementById('net-status-val'),
    pairingStatusVal: document.getElementById('pairing-status-val'),
    speedStatusVal: document.getElementById('speed-status-val'),
    threadsActiveVal: document.getElementById('threads-active-val'),

    // Modal
    modal: document.getElementById('target-modal'),
    modalClose: document.getElementById('modal-close'),
    modalSave: document.getElementById('modal-save'),
    modalCancel: document.getElementById('modal-cancel'),
    modalPinInput: document.getElementById('modal-pin-input')
  };

  // ==========================================
  // SYNTH AUDIO (Web Audio API)
  // ==========================================
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playCyberTone(freq = 880, duration = 0.05, type = 'sine', gainVal = 0.08) {
    if (!STATE.audioEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function playSuccessTone() {
    if (!STATE.audioEnabled) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          playCyberTone(freq, 0.28, 'triangle', 0.2);
        }, idx * 100);
      });
    } catch (e) {}
  }

  // ==========================================
  // FORMATTING UTILITIES
  // ==========================================
  function formatPin(number) {
    return Math.max(0, Math.min(9999, number)).toString().padStart(4, '0');
  }

  function formatTimer(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    const centis = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${hours}:${mins}:${secs}:${centis}`;
  }

  // ==========================================
  // THREAD UI SYNCHRONIZATION
  // ==========================================
  function updateThreadDisplay(threadIndex, pinStr) {
    const dom = elements.threads[threadIndex];
    if (!dom) return;

    for (let i = 0; i < 4; i++) {
      dom.digits[i].textContent = pinStr[i] || '0';
    }

    const t = THREADS[threadIndex];
    const pct = ((t.testedCount / 2000) * 100).toFixed(1);
    dom.barFill.style.width = `${pct}%`;
    dom.label.textContent = `${pct}% (${pinStr}/${t.rangeEnd + 1})`;
  }

  function updateGlobalProgress() {
    let totalTested = 0;
    THREADS.forEach(t => {
      totalTested += t.testedCount;
    });
    if (totalTested > 10000) totalTested = 10000;

    const globalPct = ((totalTested / STATE.totalPins) * 100).toFixed(1);
    elements.globalProgressFill.style.width = `${globalPct}%`;
    elements.globalProgressPct.textContent = `${globalPct}%`;
    elements.globalProgressCount.textContent = totalTested;
  }

  function appendLog(lineHtml) {
    const waitingLine = elements.terminalLogs.querySelector('.log-waiting');
    if (waitingLine) waitingLine.remove();

    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = lineHtml;
    elements.terminalLogs.appendChild(div);

    // Keep active lines bounded to 60 for 60fps responsiveness
    const lines = elements.terminalLogs.querySelectorAll('.log-line:not(.log-waiting)');
    if (lines.length > 70) {
      for (let i = 0; i < lines.length - 55; i++) {
        lines[i].remove();
      }
    }

    if (STATE.status === 'RUNNING') {
      const waitDiv = document.createElement('div');
      waitDiv.className = 'log-line log-waiting';
      waitDiv.innerHTML = `Sincronizando 5 hilos paralelos<span class="cursor-blink">_</span>`;
      elements.terminalLogs.appendChild(waitDiv);
    }

    elements.terminalLogs.scrollTop = elements.terminalLogs.scrollHeight;
  }

  // ==========================================
  // MULTI-THREAD SIMULATION ENGINE
  // ==========================================
  function startProcess() {
    if (!STATE.connected) {
      appendLog(`<span class="log-fail">[ERROR] 5 Sockets desconectados. Restablece la IP.</span>`);
      playCyberTone(250, 0.2, 'sawtooth');
      return;
    }

    if (STATE.status === 'RUNNING') return;
    STATE.status = 'RUNNING';
    playCyberTone(1200, 0.1, 'sine');

    elements.btnStart.classList.add('active');
    elements.btnPause.classList.remove('active');
    elements.btnStop.classList.remove('active');

    // Timer Interval (updates centiseconds smoothly)
    STATE.startTime = Date.now() - STATE.elapsedMs;
    if (!STATE.timerInterval) {
      STATE.timerInterval = setInterval(() => {
        STATE.elapsedMs = Date.now() - STATE.startTime;
        elements.timerDisplay.textContent = formatTimer(STATE.elapsedMs);
      }, 35);
    }

    elements.tvSpinner.style.animationPlayState = 'running';
    elements.tvLed.style.background = '#00e5ff';
    elements.tvLed.style.boxShadow = '0 0 10px #00e5ff';
    elements.threadsActiveVal.textContent = '5 / 5';

    appendLog(`<span class="log-ok">[SISTEMA] 5 Hilos paralelos lanzados en sockets 4500-4504.</span>`);
    scheduleNextBatch();
  }

  function scheduleNextBatch() {
    if (STATE.status !== 'RUNNING') return;

    const currentSpeed = STATE.speedModes[STATE.currentSpeedIndex].ms;
    STATE.processTimeout = setTimeout(() => {
      runMultiThreadStep();
    }, currentSpeed);
  }

  function runMultiThreadStep() {
    if (STATE.status !== 'RUNNING') return;

    let targetFound = false;
    let winningThread = null;

    // Simulate all 5 threads executing in their respective partition ranges
    for (let i = 0; i < THREADS.length; i++) {
      const t = THREADS[i];
      const pinStr = formatPin(t.currentPin);

      // Check if this thread has found the target PIN
      if (t.currentPin === STATE.targetPin) {
        targetFound = true;
        winningThread = t;
        break;
      }

      // Append log with thread color prefix
      appendLog(`<span class="${t.colorClass}">[${t.name}: ${t.colorName}]</span> INTENTO: ${pinStr}... <span class="log-fail">Fallido</span>`);

      // Increment pin for next iteration within its 2k partition
      t.testedCount = Math.min(2000, t.testedCount + 1);
      t.currentPin++;
      if (t.currentPin > t.rangeEnd) {
        t.currentPin = t.rangeStart;
      }

      updateThreadDisplay(i, formatPin(t.currentPin));
    }

    updateGlobalProgress();
    playCyberTone(900, 0.02, 'sine', 0.04);

    if (targetFound && winningThread) {
      handleSuccess(winningThread);
      return;
    }

    scheduleNextBatch();
  }

  function handleSuccess(winningThread) {
    STATE.status = 'FOUND';

    // Stop timers and worker queue
    if (STATE.timerInterval) {
      clearInterval(STATE.timerInterval);
      STATE.timerInterval = null;
    }
    if (STATE.processTimeout) {
      clearTimeout(STATE.processTimeout);
      STATE.processTimeout = null;
    }

    elements.btnStart.classList.remove('active');
    elements.btnPause.classList.remove('active');

    const pinStr = formatPin(winningThread.currentPin);
    updateThreadDisplay(winningThread.id, pinStr);

    // Lock winner thread row in pulsing green glow
    const domWinner = elements.threads[winningThread.id];
    domWinner.row.classList.add('thread-winner');

    // Update center title
    elements.centerTitle.innerHTML = `<span style="color:#00ffaa; text-shadow:0 0 12px #00ffaa">¡PIN DESCIFRADO POR ${winningThread.name}!</span>`;

    // Footer update
    elements.pairingStatusVal.textContent = '¡PIN Descifrado!';
    elements.pairingStatusVal.className = 'status-val val-success';
    elements.speedStatusVal.textContent = 'Proceso Completado';
    elements.speedStatusVal.className = 'status-val val-success';
    elements.threadsActiveVal.textContent = `1 Activo (${winningThread.name})`;

    playSuccessTone();

    appendLog(`<span class="pfx-winner">[${winningThread.name}: ${winningThread.colorName}] INTENTO: ${pinStr}... EXITOSO (¡PIN ENCONTRADO!)</span>`);
    appendLog(`<span style="color:#ffd54f">[SISTEMA] Deteniendo hilos restantes... Canales cerrados.</span>`);
    appendLog(`<span class="log-success">===================================================</span>`);
    appendLog(`<span class="log-success">[ÉXITO GLOBAL] Smart TV Autenticada con PIN ${pinStr}</span>`);
    appendLog(`<span class="log-success">===================================================</span>`);

    // TV Screen Success display
    elements.tvSpinner.style.display = 'none';
    elements.tvOverlay.innerHTML = `
      <span style="color:#00ffaa; font-size:15px; font-weight:800; text-shadow:0 0 10px #00ffaa">✔ DESBLOQUEADO</span>
      <span style="color:#ffffff; font-size:11px; font-weight:bold; letter-spacing:1px">PIN: ${pinStr} (${winningThread.name})</span>
    `;
    elements.tvLed.style.background = '#00ffaa';
    elements.tvLed.style.boxShadow = '0 0 14px #00ffaa';
  }

  function pauseProcess() {
    if (STATE.status === 'PAUSED') return;
    STATE.status = 'PAUSED';
    playCyberTone(600, 0.1, 'triangle');

    elements.btnStart.classList.remove('active');
    elements.btnPause.classList.add('active');

    if (STATE.timerInterval) {
      clearInterval(STATE.timerInterval);
      STATE.timerInterval = null;
    }
    if (STATE.processTimeout) {
      clearTimeout(STATE.processTimeout);
      STATE.processTimeout = null;
    }

    elements.threadsActiveVal.textContent = '0 / 5 (En Pausa)';
    appendLog(`<span style="color:#ffd54f">[PAUSA] 5 Hilos en espera sincronizada.</span>`);
  }

  function stopAndResetProcess() {
    playCyberTone(350, 0.15, 'sawtooth');
    STATE.status = 'STOPPED';

    elements.btnStart.classList.remove('active');
    elements.btnPause.classList.remove('active');
    elements.btnStop.classList.add('active');

    if (STATE.timerInterval) {
      clearInterval(STATE.timerInterval);
      STATE.timerInterval = null;
    }
    if (STATE.processTimeout) {
      clearTimeout(STATE.processTimeout);
      STATE.processTimeout = null;
    }

    // Reset winner styles
    elements.threads.forEach(t => t.row.classList.remove('thread-winner'));
    elements.centerTitle.textContent = 'ESTADO DEL PROCESO (MULTI-HILO)';

    // Reset thread state to 0 relative to their ranges
    THREADS[0].currentPin = 0; THREADS[0].testedCount = 0;
    THREADS[1].currentPin = 2000; THREADS[1].testedCount = 0;
    THREADS[2].currentPin = 4000; THREADS[2].testedCount = 0;
    THREADS[3].currentPin = 6000; THREADS[3].testedCount = 0;
    THREADS[4].currentPin = 8000; THREADS[4].testedCount = 0;

    THREADS.forEach((t, i) => updateThreadDisplay(i, formatPin(t.currentPin)));
    updateGlobalProgress();

    STATE.elapsedMs = 0;
    elements.timerDisplay.textContent = '00:00:00:00';

    // Reset TV
    elements.tvSpinner.style.display = 'block';
    elements.tvOverlay.innerHTML = `
      <span class="tv-device-brand" id="tv-device-label">${DEVICE_INFO[STATE.device].label}</span>
      <span class="tv-status-sub">Sincronizando 5 sockets...</span>
    `;
    elements.tvLed.style.background = '#00e5ff';
    elements.tvLed.style.boxShadow = '0 0 8px #00e5ff';

    elements.pairingStatusVal.textContent = 'Autorizado';
    elements.pairingStatusVal.className = 'status-val val-warn';
    const mode = STATE.speedModes[STATE.currentSpeedIndex];
    elements.speedStatusVal.textContent = mode.label;
    elements.speedStatusVal.className = 'status-val val-cyan';
    elements.threadsActiveVal.textContent = '5 / 5 (Listo)';

    appendLog(`<span class="log-fail">[DETENIDO] 5 Hilos y cronómetro restablecidos a cero.</span>`);
    appendLog(`<span class="log-ok">[LISTO] Presione 'INICIAR PRUEBA' para arrancar los 5 hilos.</span>`);
  }

  // ==========================================
  // QUICK DEMO & CONTROLS
  // ==========================================
  function runQuickDemo() {
    stopAndResetProcess();

    // Setup: Hilo #3 is 4000-5999, place it at 4378 to reach 4381 in 3 ticks
    THREADS[0].currentPin = 412; THREADS[0].testedCount = 412;
    THREADS[1].currentPin = 2980; THREADS[1].testedCount = 980;
    THREADS[2].currentPin = 4378; THREADS[2].testedCount = 378;
    THREADS[3].currentPin = 7105; THREADS[3].testedCount = 1105;
    THREADS[4].currentPin = 9234; THREADS[4].testedCount = 1234;

    STATE.targetPin = 4381;
    STATE.elapsedMs = 195200; // ~00:03:15:20
    elements.timerDisplay.textContent = formatTimer(STATE.elapsedMs);

    THREADS.forEach((t, i) => updateThreadDisplay(i, formatPin(t.currentPin)));
    updateGlobalProgress();

    appendLog(`<span style="color:#00e5ff">[DEMO MULTI-HILO] Hilo #3 preparado en 4378 -> Objetivo: 4381.</span>`);
    startProcess();
  }

  function toggleSpeed() {
    STATE.currentSpeedIndex = (STATE.currentSpeedIndex + 1) % STATE.speedModes.length;
    const mode = STATE.speedModes[STATE.currentSpeedIndex];

    elements.speedIndicator.textContent = mode.name;
    elements.speedStatusVal.textContent = mode.label;

    playCyberTone(1000, 0.05, 'sine');
    appendLog(`<span style="color:#00e5ff">[VELOCIDAD] Modo multi-hilo: ${mode.name}</span>`);
  }

  function toggleAudio() {
    STATE.audioEnabled = !STATE.audioEnabled;
    if (STATE.audioEnabled) {
      elements.btnAudio.classList.add('active');
      elements.btnAudio.innerHTML = `<span class="icon">🔊</span> AUDIO: ON`;
      playCyberTone(880, 0.06, 'sine');
    } else {
      elements.btnAudio.classList.remove('active');
      elements.btnAudio.innerHTML = `<span class="icon">🔇</span> AUDIO: OFF`;
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  function openTargetModal() {
    elements.modalPinInput.value = formatPin(STATE.targetPin);
    elements.modal.classList.remove('hidden');
    elements.modalPinInput.focus();
    elements.modalPinInput.select();
  }

  function closeTargetModal() {
    elements.modal.classList.add('hidden');
  }

  function saveTargetModal() {
    let val = elements.modalPinInput.value.replace(/\D/g, '');
    if (val.length === 0) val = '4381';
    val = parseInt(val, 10);
    if (isNaN(val) || val < 0) val = 4381;
    if (val > 9999) val = 9999;

    STATE.targetPin = val;
    elements.targetPinVal.textContent = formatPin(val);
    closeTargetModal();

    // Determine which thread handles this PIN
    const assignedThread = Math.floor(val / 2000);
    appendLog(`<span style="color:#ffd54f">[OBJETIVO] Nuevo PIN objetivo: ${formatPin(val)} (Asignado a Hilo #${assignedThread + 1})</span>`);
    playCyberTone(1100, 0.08, 'sine');
  }

  function toggleConnection() {
    STATE.connected = !STATE.connected;

    if (STATE.connected) {
      elements.connBadge.className = 'status-badge badge-connected';
      elements.connBadge.innerHTML = `<span class="badge-icon">✔</span><span class="badge-text">Conectado</span>`;
      elements.netStatusVal.textContent = 'Conectado (5 Threads)';
      elements.netStatusVal.className = 'status-val val-success';
      elements.pairingStatusVal.textContent = 'Autorizado';
      elements.pairingStatusVal.className = 'status-val val-warn';
      appendLog(`<span class="log-ok">[OK] Conectado a ${elements.ipAddress.value} (5 Sockets Activos)</span>`);
      playCyberTone(900, 0.08, 'triangle');
    } else {
      elements.connBadge.className = 'status-badge badge-disconnected';
      elements.connBadge.innerHTML = `<span class="badge-icon">✖</span><span class="badge-text">Desconectado</span>`;
      elements.netStatusVal.textContent = 'Desconectado';
      elements.netStatusVal.className = 'status-val val-fail';
      elements.pairingStatusVal.textContent = 'No disponible';
      elements.pairingStatusVal.className = 'status-val';

      if (STATE.status === 'RUNNING') pauseProcess();
      appendLog(`<span class="log-fail">[DESCONECTADO] 5 Sockets con ${elements.ipAddress.value} interrumpidos.</span>`);
      playCyberTone(300, 0.12, 'sawtooth');
    }
  }

  function updateDeviceProfile() {
    const devKey = elements.deviceSelect.value;
    STATE.device = devKey;
    const info = DEVICE_INFO[devKey] || DEVICE_INFO.android;

    elements.tvDeviceLabel.textContent = info.label;
    appendLog(`<span class="log-ok">[PERFIL] Smart TV cambiada a ${info.label} (${info.protocol})</span>`);
    playCyberTone(700, 0.08, 'sine');
  }

  // ==========================================
  // EVENT LISTENERS & KEYBOARD SHORTCUTS
  // ==========================================
  function initListeners() {
    elements.btnStart.addEventListener('click', startProcess);
    elements.btnPause.addEventListener('click', pauseProcess);
    elements.btnStop.addEventListener('click', stopAndResetProcess);

    elements.btnDemoTest.addEventListener('click', runQuickDemo);
    elements.btnSpeed.addEventListener('click', toggleSpeed);
    elements.btnAudio.addEventListener('click', toggleAudio);
    elements.btnFullscreen.addEventListener('click', toggleFullscreen);

    elements.deviceSelect.addEventListener('change', updateDeviceProfile);
    elements.connBadge.addEventListener('click', toggleConnection);

    elements.btnTargetPin.addEventListener('click', openTargetModal);
    elements.modalClose.addEventListener('click', closeTargetModal);
    elements.modalCancel.addEventListener('click', closeTargetModal);
    elements.modalSave.addEventListener('click', saveTargetModal);

    elements.modalPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveTargetModal();
      if (e.key === 'Escape') closeTargetModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (STATE.status === 'RUNNING') pauseProcess();
        else startProcess();
      } else if (e.key === 'r' || e.key === 'R') {
        stopAndResetProcess();
      }
    });
  }

  // ==========================================
  // CONSTELLATION NETWORK BACKGROUND CANVAS
  // ==========================================
  function initConstellationCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];
    const PARTICLE_COUNT = 55;
    const MAX_DISTANCE = 140;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.45;
        this.vy = (Math.random() - 0.5) * 0.45;
        this.radius = Math.random() * 1.8 + 0.8;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MAX_DISTANCE) {
            const alpha = (1 - dist / MAX_DISTANCE) * 0.18;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      particles.forEach(p => { p.update(); p.draw(); });
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ==========================================
  // BOOTSTRAP INITIALIZATION
  // ==========================================
  function init() {
    initConstellationCanvas();
    initListeners();

    // Initialize display with the 5 mock partition values matching the screenshot
    THREADS.forEach((t, i) => updateThreadDisplay(i, formatPin(t.currentPin)));
    updateGlobalProgress();
    elements.timerDisplay.textContent = formatTimer(STATE.elapsedMs);

    // Initial highlight on PAUSAR button
    elements.btnPause.classList.add('active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==========================================
  // REAL MODE — WebSocket Backend Integration
  // ==========================================
  const WS_URL = 'ws://localhost:8765';
  let REAL_MODE = false;
  let ws = null;
  let wsReconnectTimer = null;
  let realTotalTested = 0;

  // Cache extra elements for real mode
  const realEl = {
    backendStatus:  document.getElementById('backend-status'),
    btnRealMode:    document.getElementById('btn-real-mode'),
    realModeLabel:  document.getElementById('real-mode-label'),
    realOptions:    document.getElementById('real-mode-options'),
    btnRealConnect: document.getElementById('btn-real-connect'),
    adbMethod:      document.getElementById('adb-method-select'),
    pinStart:       document.getElementById('pin-start-input'),
    pinEnd:         document.getElementById('pin-end-input'),
    modeTag:        document.getElementById('mode-tag'),
  };

  /* ── WebSocket connection ── */
  function connectWS() {
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setBackendStatus(true);
        appendLog('<span class="log-ok">[BACKEND] Conectado al servidor Python ✔</span>');
      };

      ws.onclose = () => {
        setBackendStatus(false);
        ws = null;
        if (REAL_MODE) {
          // Reintentar cada 4s mientras modo real esté activo
          wsReconnectTimer = setTimeout(connectWS, 4000);
        }
      };

      ws.onerror = () => {
        setBackendStatus(false);
      };

      ws.onmessage = (e) => {
        try { handleWSMessage(JSON.parse(e.data)); } catch {}
      };
    } catch (err) {
      setBackendStatus(false);
    }
  }

  function sendWS(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    appendLog('<span class="log-fail">[ERROR] Backend desconectado. Inicia server.py primero.</span>');
    return false;
  }

  function setBackendStatus(online) {
    if (!realEl.backendStatus) return;
    if (online) {
      realEl.backendStatus.className = 'backend-badge backend-online';
      realEl.backendStatus.innerHTML = '<span class="icon">⬡</span> BACKEND: ONLINE';
    } else {
      realEl.backendStatus.className = 'backend-badge backend-offline';
      realEl.backendStatus.innerHTML = '<span class="icon">⬡</span> BACKEND: OFFLINE';
    }
  }

  /* ── Toggle Modo Real / Simulación ── */
  function toggleRealMode() {
    REAL_MODE = !REAL_MODE;

    if (REAL_MODE) {
      // Activar modo real
      realEl.btnRealMode.classList.add('real-active');
      realEl.realModeLabel.textContent = 'REAL';
      realEl.realOptions.style.display = 'block';
      if (realEl.modeTag) {
        realEl.modeTag.classList.add('real-mode-active');
        realEl.modeTag.innerHTML = '<span class="pulse-dot"></span> MODO REAL v4.0 // ADB ACTIVO';
      }
      appendLog('<span style="color:#ffaa00">[MODO REAL] Activado — conecta al TV y presiona INICIAR PRUEBA</span>');
      connectWS();
      playCyberTone(1300, 0.12, 'sine');
    } else {
      // Volver a simulación
      realEl.btnRealMode.classList.remove('real-active');
      realEl.realModeLabel.textContent = 'SIM';
      realEl.realOptions.style.display = 'none';
      if (realEl.modeTag) {
        realEl.modeTag.classList.remove('real-mode-active');
        realEl.modeTag.innerHTML = '<span class="pulse-dot"></span> PROTOTIPO V4.0 // MULTI-THREAD SIM';
      }
      if (ws) { ws.close(); ws = null; }
      if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
      setBackendStatus(false);
      appendLog('<span style="color:#80deea">[MODO SIM] Regresando a simulación local.</span>');
      playCyberTone(700, 0.1, 'triangle');
    }
  }

  /* ── Conectar al TV (real) ── */
  function connectRealTV() {
    if (!REAL_MODE) return;
    const ip     = elements.ipAddress.value.trim();
    const port   = elements.portInput.value.trim() || '5555';
    const device = elements.deviceSelect.value;

    if (!ip) {
      appendLog('<span class="log-fail">[ERROR] Introduce la IP del TV antes de conectar.</span>');
      return;
    }

    sendWS({ cmd: 'connect', ip, port: parseInt(port), device });
  }

  /* ── Override startProcess para modo real ── */
  const _origStart = startProcess;
  function startProcess() {
    if (!REAL_MODE) { _origStart(); return; }

    if (STATE.status === 'RUNNING') return;

    const ip       = elements.ipAddress.value.trim();
    const port     = elements.portInput.value.trim() || '5555';
    const device   = elements.deviceSelect.value;
    const method   = realEl.adbMethod ? realEl.adbMethod.value : 'text';
    const pinStart = parseInt((realEl.pinStart ? realEl.pinStart.value : '0') || '0', 10);
    const pinEnd   = parseInt((realEl.pinEnd   ? realEl.pinEnd.value   : '9999') || '9999', 10);

    if (!ip) {
      appendLog('<span class="log-fail">[ERROR] Introduce la IP del TV.</span>');
      return;
    }

    const sent = sendWS({
      cmd: 'start',
      ip,
      port: parseInt(port),
      device,
      entry_method: method,
      pin_start: pinStart,
      pin_end:   pinEnd
    });

    if (sent) {
      STATE.status = 'RUNNING';
      realTotalTested = 0;
      elements.btnStart.classList.add('active');
      elements.btnPause.classList.remove('active');
      elements.btnStop.classList.remove('active');

      // Iniciar cronómetro local (visual)
      STATE.startTime = Date.now() - STATE.elapsedMs;
      if (!STATE.timerInterval) {
        STATE.timerInterval = setInterval(() => {
          STATE.elapsedMs = Date.now() - STATE.startTime;
          elements.timerDisplay.textContent = formatTimer(STATE.elapsedMs);
        }, 35);
      }
      elements.tvSpinner.style.animationPlayState = 'running';
      elements.tvLed.style.background = '#ffaa00';
      elements.tvLed.style.boxShadow = '0 0 10px #ffaa00';
      elements.threadsActiveVal.textContent = 'REAL — ACTIVO';
      playCyberTone(1200, 0.1, 'sine');
    }
  }

  /* ── Override pauseProcess para modo real ── */
  const _origPause = pauseProcess;
  function pauseProcess() {
    if (!REAL_MODE) { _origPause(); return; }
    if (STATE.status === 'PAUSED') return;
    sendWS({ cmd: 'pause' });
  }

  /* ── Override stopAndResetProcess para modo real ── */
  const _origStop = stopAndResetProcess;
  function stopAndResetProcess() {
    if (!REAL_MODE) { _origStop(); return; }
    sendWS({ cmd: 'stop' });
    STATE.status = 'STOPPED';
    realTotalTested = 0;
    STATE.elapsedMs = 0;
    if (STATE.timerInterval) { clearInterval(STATE.timerInterval); STATE.timerInterval = null; }
    elements.timerDisplay.textContent = '00:00:00:00';
    elements.btnStart.classList.remove('active');
    elements.btnPause.classList.remove('active');
    elements.btnStop.classList.add('active');
    elements.threads.forEach(t => t.row.classList.remove('thread-winner'));
    elements.centerTitle.textContent = 'ESTADO DEL PROCESO (MULTI-HILO)';
    THREADS.forEach((t, i) => { t.currentPin = t.rangeStart; t.testedCount = 0; updateThreadDisplay(i, formatPin(t.rangeStart)); });
    updateGlobalProgress();
    elements.tvSpinner.style.display = 'block';
    elements.tvLed.style.background = '#00e5ff';
    elements.tvLed.style.boxShadow = '0 0 8px #00e5ff';
    elements.threadsActiveVal.textContent = '5 / 5 (Listo)';
    playCyberTone(350, 0.15, 'sawtooth');
  }

  /* ── Manejar mensajes del backend ── */
  function handleWSMessage(msg) {
    switch (msg.type) {

      case 'init':
        if (msg.adb_available) {
          appendLog(`<span class="log-ok">[BACKEND] ADB disponible: ${msg.adb_path}</span>`);
        } else {
          appendLog(`<span class="log-fail">[BACKEND] ADB no encontrado: ${msg.adb_path}</span>`);
          appendLog('<span class="log-warn">[BACKEND] Android TV requiere ADB. Descarga platform-tools.</span>');
        }
        break;

      case 'connect_result':
        if (msg.success) {
          STATE.connected = true;
          elements.connBadge.className = 'status-badge badge-connected';
          elements.connBadge.innerHTML = '<span class="badge-icon">✔</span><span class="badge-text">Conectado</span>';
          elements.netStatusVal.textContent = 'Conectado (Real)';
          elements.netStatusVal.className = 'status-val val-success';
          appendLog(`<span class="log-ok">[REAL] Conectado: ${msg.message}</span>`);
          playCyberTone(900, 0.08, 'triangle');
        } else {
          STATE.connected = false;
          elements.connBadge.className = 'status-badge badge-disconnected';
          elements.connBadge.innerHTML = '<span class="badge-icon">✖</span><span class="badge-text">Fallo</span>';
          elements.netStatusVal.textContent = 'Desconectado';
          elements.netStatusVal.className = 'status-val val-fail';
          appendLog(`<span class="log-fail">[REAL] Fallo de conexión: ${msg.message}</span>`);
          playCyberTone(300, 0.12, 'sawtooth');
        }
        break;

      case 'started':
        appendLog(`<span class="log-ok">[REAL] ${msg.message}</span>`);
        break;

      case 'attempt': {
        const tid = msg.thread;
        const pinStr = msg.pin;
        realTotalTested = msg.total;

        // Actualizar hilo visual
        const t = THREADS[tid];
        if (t) {
          t.currentPin = parseInt(pinStr, 10);
          t.testedCount = Math.min(2000, Math.max(0, t.currentPin - t.rangeStart));
          updateThreadDisplay(tid, pinStr);
        }

        // Progreso global con total real
        const globalPct = ((realTotalTested / 10000) * 100).toFixed(1);
        elements.globalProgressFill.style.width = `${globalPct}%`;
        elements.globalProgressPct.textContent = `${globalPct}%`;
        elements.globalProgressCount.textContent = realTotalTested;

        playCyberTone(900, 0.02, 'sine', 0.04);
        break;
      }

      case 'result':
        if (msg.result === 'lockout') {
          appendLog(`<span class="log-warn">[LOCKOUT] ${msg.message}</span>`);
          playCyberTone(220, 0.2, 'sawtooth');
        } else if (msg.result === 'error') {
          appendLog(`<span class="log-fail">[ERROR] ${msg.message}</span>`);
        } else if (msg.result === 'sent') {
          // Roku: PIN enviado
          appendLog(`<span class="log-sent">[ROKU] ${msg.message}</span>`);
        }
        break;

      case 'found': {
        const wTid = msg.thread;
        const wPin = msg.pin;
        const wTname = THREADS[wTid] ? THREADS[wTid].name : `HILO ${wTid + 1}`;

        STATE.status = 'FOUND';
        if (STATE.timerInterval) { clearInterval(STATE.timerInterval); STATE.timerInterval = null; }
        elements.btnStart.classList.remove('active');
        elements.btnPause.classList.remove('active');

        const domW = elements.threads[wTid];
        if (domW) domW.row.classList.add('thread-winner');

        updateThreadDisplay(wTid, wPin);
        elements.centerTitle.innerHTML =
          `<span style="color:#00ffaa; text-shadow:0 0 12px #00ffaa">¡PIN REAL ENCONTRADO POR ${wTname}!</span>`;

        elements.pairingStatusVal.textContent = '¡PIN Real Descifrado!';
        elements.pairingStatusVal.className = 'status-val val-success';
        elements.speedStatusVal.textContent = 'Proceso Real Completado';
        elements.speedStatusVal.className = 'status-val val-success';
        elements.threadsActiveVal.textContent = `REAL — ${wTname} GANADOR`;

        playSuccessTone();

        appendLog(`<span class="pfx-winner">[${wTname}] PIN REAL: ${wPin} → CORRECTO ✔</span>`);
        appendLog('<span class="log-success">══════════════════════════════════════════════</span>');
        appendLog(`<span class="log-success">[ÉXITO REAL] Smart TV desbloqueada con PIN: ${wPin}</span>`);
        appendLog('<span class="log-success">══════════════════════════════════════════════</span>');

        elements.tvSpinner.style.display = 'none';
        elements.tvOverlay.innerHTML = `
          <span style="color:#00ffaa; font-size:15px; font-weight:800; text-shadow:0 0 10px #00ffaa">✔ DESBLOQUEADO REAL</span>
          <span style="color:#ffffff; font-size:11px; font-weight:bold; letter-spacing:1px">PIN: ${wPin} (${wTname})</span>
        `;
        elements.tvLed.style.background = '#00ffaa';
        elements.tvLed.style.boxShadow = '0 0 14px #00ffaa';
        break;
      }

      case 'paused':
        STATE.status = 'PAUSED';
        if (STATE.timerInterval) { clearInterval(STATE.timerInterval); STATE.timerInterval = null; }
        elements.btnStart.classList.remove('active');
        elements.btnPause.classList.add('active');
        elements.threadsActiveVal.textContent = 'REAL — EN PAUSA';
        appendLog('<span class="log-warn">[PAUSA REAL] Worker en espera.</span>');
        break;

      case 'resumed':
        STATE.status = 'RUNNING';
        STATE.startTime = Date.now() - STATE.elapsedMs;
        if (!STATE.timerInterval) {
          STATE.timerInterval = setInterval(() => {
            STATE.elapsedMs = Date.now() - STATE.startTime;
            elements.timerDisplay.textContent = formatTimer(STATE.elapsedMs);
          }, 35);
        }
        elements.btnStart.classList.add('active');
        elements.btnPause.classList.remove('active');
        elements.threadsActiveVal.textContent = 'REAL — ACTIVO';
        appendLog('<span class="log-ok">[REANUDADO] Worker real activo.</span>');
        break;

      case 'stopped':
        STATE.status = 'STOPPED';
        if (STATE.timerInterval) { clearInterval(STATE.timerInterval); STATE.timerInterval = null; }
        elements.threadsActiveVal.textContent = 'REAL — DETENIDO';
        break;

      case 'exhausted':
        STATE.status = 'STOPPED';
        if (STATE.timerInterval) { clearInterval(STATE.timerInterval); STATE.timerInterval = null; }
        appendLog(`<span class="log-fail">[AGOTADO] ${msg.message}</span>`);
        appendLog(`<span class="log-warn">[INFO] Total de PINs probados: ${msg.total}</span>`);
        elements.pairingStatusVal.textContent = 'PIN no encontrado';
        elements.pairingStatusVal.className = 'status-val val-fail';
        break;

      case 'log': {
        const lvlClass = {
          ok: 'log-ok', warn: 'log-warn', error: 'log-fail', info: 'log-info'
        }[msg.level] || '';
        const styleAttr = lvlClass
          ? `class="${lvlClass}"`
          : 'style="color:#80deea"';
        appendLog(`<span ${styleAttr}>${msg.text}</span>`);
        break;
      }
    }
  }

  /* ── Event listener para los botones del modo real ── */
  function initRealModeListeners() {
    if (realEl.btnRealMode) {
      realEl.btnRealMode.addEventListener('click', toggleRealMode);
    }
    if (realEl.btnRealConnect) {
      realEl.btnRealConnect.addEventListener('click', connectRealTV);
    }
  }

  // Patch init para agregar listeners del modo real
  const _origInit = init;
  function init() {
    _origInit();
    initRealModeListeners();
  }

})();

