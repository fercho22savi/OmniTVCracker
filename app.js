/**
 * TV PIN CODENAME: ULTIMATE CODIFICADOR
 * Interactive Core Controller & Prototype Simulation Engine
 */

(function () {
  'use strict';

  // ==========================================
  // CONFIGURATION & STATE
  // ==========================================
  const STATE = {
    status: 'PAUSED', // 'RUNNING', 'PAUSED', 'STOPPED', 'FOUND'
    currentPin: 0, // Inicia desde 0000 por defecto
    targetPin: 4381, // PIN objetivo que desbloquea la TV
    totalPins: 10000,
    elapsedSeconds: 0, // Cronómetro inicia en 00:00:00
    
    // Speeds in ms: 1500ms (normal as shown on UI), 400ms (fast), 40ms (turbo)
    speedModes: [
      { id: 'normal', name: 'NORMAL (1.5s)', ms: 1500, label: '1 intento / 1.5s' },
      { id: 'fast', name: 'RÁPIDO (0.4s)', ms: 400, label: '2.5 intentos / 1s' },
      { id: 'turbo', name: 'TURBO (40ms)', ms: 40, label: '25 intentos / 1s' }
    ],
    currentSpeedIndex: 0,

    audioEnabled: true,
    connected: true,
    device: 'android',
    timerInterval: null,
    processTimeout: null
  };

  const DEVICE_INFO = {
    android: { label: 'ANDROID TV OS', port: '5555', protocol: 'ADB / Google TV Remote' },
    roku: { label: 'ROKU OS', port: '8060', protocol: 'Roku ECP Remote Protocol' },
    samsung: { label: 'SAMSUNG TIZEN', port: '8002', protocol: 'SmartView / Tizen WSS' },
    lg: { label: 'LG WEBOS', port: '3001', protocol: 'LG SSAP Pairing Service' }
  };

  // ==========================================
  // DOM ELEMENTS
  // ==========================================
  const elements = {
    // Digits
    digits: [
      document.querySelector('#digit-0 .digit-value'),
      document.querySelector('#digit-1 .digit-value'),
      document.querySelector('#digit-2 .digit-value'),
      document.querySelector('#digit-3 .digit-value')
    ],
    digitCards: [
      document.getElementById('digit-0'),
      document.getElementById('digit-1'),
      document.getElementById('digit-2'),
      document.getElementById('digit-3')
    ],

    // Progress
    progressFill: document.getElementById('progress-fill'),
    progressPct: document.getElementById('progress-pct'),
    progressCount: document.getElementById('progress-count'),

    // Timer
    timerDisplay: document.getElementById('timer-display'),

    // Terminal
    terminalLogs: document.getElementById('terminal-logs'),

    // Buttons
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnStop: document.getElementById('btn-stop'),

    // Utility & Modal
    btnAudio: document.getElementById('btn-audio'),
    btnSpeed: document.getElementById('btn-speed'),
    speedIndicator: document.getElementById('speed-indicator'),
    btnStartPin: document.getElementById('btn-start-pin'),
    startPinVal: document.getElementById('start-pin-val'),
    btnTargetPin: document.getElementById('btn-target-pin'),
    targetPinVal: document.getElementById('target-pin-val'),
    btnDemoTest: document.getElementById('btn-demo-test'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    combinationLabel: document.getElementById('combination-label'),

    // Device Config
    deviceSelect: document.getElementById('device-select'),
    ipAddress: document.getElementById('ip-address'),
    connBadge: document.getElementById('conn-badge'),

    // TV Preview
    tvDeviceLabel: document.getElementById('tv-device-label'),
    tvScreen: document.getElementById('tv-screen'),
    tvSpinner: document.getElementById('tv-spinner'),
    tvOverlay: document.getElementById('tv-overlay'),
    tvLed: document.getElementById('tv-led'),

    // Status bar
    netStatusVal: document.getElementById('net-status-val'),
    pairingStatusVal: document.getElementById('pairing-status-val'),
    speedStatusVal: document.getElementById('speed-status-val'),

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

  function playCyberTone(freq = 880, duration = 0.05, type = 'sine', gainVal = 0.1) {
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
    } catch (e) {
      // Audio might be blocked until user gesture
    }
  }

  function playSuccessTone() {
    if (!STATE.audioEnabled) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          playCyberTone(freq, 0.25, 'triangle', 0.2);
        }, idx * 120);
      });
    } catch (e) {}
  }

  // ==========================================
  // TIME & PIN FORMATTING
  // ==========================================
  function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');
  }

  function formatPin(number) {
    return Math.max(0, Math.min(9999, number)).toString().padStart(4, '0');
  }

  // ==========================================
  // UI UPDATE FUNCTIONS
  // ==========================================
  function updatePinDisplay(pinStr, animated = true) {
    for (let i = 0; i < 4; i++) {
      const char = pinStr[i] || '0';
      if (elements.digits[i].textContent !== char) {
        elements.digits[i].textContent = char;
        if (animated) {
          elements.digitCards[i].classList.add('digit-flip');
          setTimeout(() => {
            elements.digitCards[i].classList.remove('digit-flip');
          }, 150);
        }
      }
    }
  }

  function updateProgressBar(currentVal) {
    const pct = ((currentVal / STATE.totalPins) * 100).toFixed(1);
    elements.progressFill.style.width = `${pct}%`;
    elements.progressPct.textContent = `${pct}%`;
    elements.progressCount.textContent = currentVal;
  }

  function updateTimerDisplay() {
    elements.timerDisplay.textContent = formatTime(STATE.elapsedSeconds);
  }

  function appendLog(lineHtml) {
    // Remove temporary waiting line if present
    const waitingLine = elements.terminalLogs.querySelector('.log-waiting');
    if (waitingLine) {
      waitingLine.remove();
    }

    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = lineHtml;
    elements.terminalLogs.appendChild(div);

    // Keep terminal clean by pruning lines older than 60 lines
    const lines = elements.terminalLogs.querySelectorAll('.log-line:not(.log-waiting)');
    if (lines.length > 70) {
      for (let i = 0; i < lines.length - 55; i++) {
        lines[i].remove();
      }
    }

    // Re-append waiting cursor line if running
    if (STATE.status === 'RUNNING') {
      const waitDiv = document.createElement('div');
      waitDiv.className = 'log-line log-waiting';
      waitDiv.innerHTML = `Esperando respuesta<span class="cursor-blink">_</span>`;
      elements.terminalLogs.appendChild(waitDiv);
    }

    // Keep scroll at bottom
    elements.terminalLogs.scrollTop = elements.terminalLogs.scrollHeight;
  }

  // ==========================================
  // PROCESS FLOW & CONTROL
  // ==========================================
  function startProcess() {
    if (!STATE.connected) {
      appendLog(`<span class="log-fail">[ERROR] No se puede iniciar: Dispositivo desconectado.</span>`);
      playCyberTone(250, 0.2, 'sawtooth');
      return;
    }

    if (STATE.status === 'RUNNING') return;

    STATE.status = 'RUNNING';
    playCyberTone(1200, 0.1, 'sine');

    // UI Buttons highlight
    elements.btnStart.classList.add('active');
    elements.btnPause.classList.remove('active');
    elements.btnStop.classList.remove('active');

    // Start timer interval (ticks every second)
    if (!STATE.timerInterval) {
      STATE.timerInterval = setInterval(() => {
        STATE.elapsedSeconds++;
        updateTimerDisplay();
      }, 1000);
    }

    appendLog(`<span class="log-ok">[SISTEMA] Algoritmo reanudado en PIN ${formatPin(STATE.currentPin)}.</span>`);

    // TV Animation activate
    elements.tvSpinner.style.animationPlayState = 'running';
    elements.tvLed.style.background = '#00e5ff';
    elements.tvLed.style.boxShadow = '0 0 8px #00e5ff';

    scheduleNextAttempt();
  }

  function scheduleNextAttempt() {
    if (STATE.status !== 'RUNNING') return;

    const currentSpeed = STATE.speedModes[STATE.currentSpeedIndex].ms;
    STATE.processTimeout = setTimeout(() => {
      runSingleAttempt();
    }, currentSpeed);
  }

  function runSingleAttempt() {
    if (STATE.status !== 'RUNNING') return;

    const pinStr = formatPin(STATE.currentPin);
    updatePinDisplay(pinStr, true);
    updateProgressBar(STATE.currentPin);

    // Audio click for attempt
    playCyberTone(800 + (STATE.currentPin % 10) * 40, 0.03, 'sine', 0.05);

    // Victory condition check: Check if current PIN matches target
    if (STATE.currentPin === STATE.targetPin) {
      handleSuccess(pinStr);
      return; // DETIENE EL PROCESO Y QUEDA EXACTAMENTE EN EL NÚMERO INDICADO
    }

    // Standard attempt log
    appendLog(`<span class="log-attempt">[INTENTO ${pinStr}]</span> Enviando: ${pinStr}... <span class="log-fail">Fallido</span>`);

    // Advance to next PIN for subsequent attempt
    STATE.currentPin = (STATE.currentPin + 1) % 10000;
    scheduleNextAttempt();
  }

  function pauseProcess() {
    if (STATE.status === 'PAUSED') return;

    STATE.status = 'PAUSED';
    playCyberTone(600, 0.1, 'triangle');

    // UI state
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

    appendLog(`<span style="color:#ffd54f">[PAUSA] Proceso en espera. Combinación fijada en ${formatPin(STATE.currentPin)}.</span>`);
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

    // Limpiar estilos de victoria
    elements.digitCards.forEach(card => card.classList.remove('digit-found'));
    elements.progressFill.classList.remove('progress-found');
    if (elements.combinationLabel) {
      elements.combinationLabel.textContent = 'COMBINACIÓN ACTUAL';
      elements.combinationLabel.classList.remove('found-title');
    }

    // Resetear valores de estado a 0000
    STATE.currentPin = 0;
    STATE.elapsedSeconds = 0;
    
    updatePinDisplay("0000", true);
    updateProgressBar(0);
    updateTimerDisplay();

    // Resetear barra de estado inferior
    elements.pairingStatusVal.textContent = 'Autorizado';
    elements.pairingStatusVal.className = 'status-val val-warn';
    const mode = STATE.speedModes[STATE.currentSpeedIndex];
    elements.speedStatusVal.textContent = mode.label;
    elements.speedStatusVal.className = 'status-val val-cyan';

    // Reset TV
    elements.tvSpinner.style.display = 'block';
    elements.tvOverlay.innerHTML = `
      <span class="tv-device-brand" id="tv-device-label">${DEVICE_INFO[STATE.device].label}</span>
      <span class="tv-status-sub">Sincronizando puerto ${DEVICE_INFO[STATE.device].port}...</span>
    `;
    elements.tvLed.style.background = '#00e5ff';
    elements.tvLed.style.boxShadow = '0 0 8px #00e5ff';

    appendLog(`<span class="log-fail">[DETENIDO] Contador y cronómetro restablecidos a 0000.</span>`);
    appendLog(`<span class="log-ok">[LISTO] Presione 'INICIAR PRUEBA' para comenzar secuencia.</span>`);
  }

  function handleSuccess(pinStr) {
    STATE.status = 'FOUND';
    
    // Detener intervalos y temporizadores
    if (STATE.timerInterval) {
      clearInterval(STATE.timerInterval);
      STATE.timerInterval = null;
    }
    if (STATE.processTimeout) {
      clearTimeout(STATE.processTimeout);
      STATE.processTimeout = null;
    }

    // Desactivar botones de inicio y pausa
    elements.btnStart.classList.remove('active');
    elements.btnPause.classList.remove('active');

    // Bloquear contador exactamente en el número encontrado con resplandor verde
    updatePinDisplay(pinStr, false);
    updateProgressBar(STATE.currentPin);
    elements.digitCards.forEach(card => card.classList.add('digit-found'));
    elements.progressFill.classList.add('progress-found');

    if (elements.combinationLabel) {
      elements.combinationLabel.innerHTML = `¡PIN VÁLIDO ENCONTRADO!`;
      elements.combinationLabel.classList.add('found-title');
    }

    // Actualizar barra de estado
    elements.pairingStatusVal.textContent = '¡PIN Descifrado!';
    elements.pairingStatusVal.className = 'status-val val-success';
    elements.speedStatusVal.textContent = 'Completado con Éxito';
    elements.speedStatusVal.className = 'status-val val-success';

    playSuccessTone();

    appendLog(`<span class="log-success">====================================</span>`);
    appendLog(`<span class="log-success">[ÉXITO] ¡PIN CORRECTO LOCALIZADO: ${pinStr}!</span>`);
    appendLog(`<span class="log-success">[AUTORIZADO] TV Desbloqueada. Proceso finalizado en ${pinStr}.</span>`);
    appendLog(`<span class="log-success">====================================</span>`);

    // Estado de éxito en la pantalla de TV
    elements.tvSpinner.style.display = 'none';
    elements.tvOverlay.innerHTML = `
      <span style="color:#00ffaa; font-size:16px; font-weight:800; text-shadow:0 0 10px #00ffaa">✔ DESBLOQUEADO</span>
      <span style="color:#ffffff; font-size:12px; font-weight:bold; letter-spacing:2px">PIN: ${pinStr}</span>
    `;
    elements.tvLed.style.background = '#00ffaa';
    elements.tvLed.style.boxShadow = '0 0 14px #00ffaa';
  }

  // ==========================================
  // DEVICE & CONNECTIVITY TOGGLE
  // ==========================================
  function updateDeviceProfile() {
    const devKey = elements.deviceSelect.value;
    STATE.device = devKey;
    const info = DEVICE_INFO[devKey] || DEVICE_INFO.android;

    elements.tvDeviceLabel.textContent = info.label;
    const sub = elements.tvOverlay.querySelector('.tv-status-sub');
    if (sub) {
      sub.textContent = `Sincronizando puerto ${info.port}...`;
    }

    appendLog(`<span class="log-ok">[PERFIL] Objetivo cambiado a ${info.label} (${info.protocol})</span>`);
    playCyberTone(700, 0.08, 'sine');
  }

  function toggleConnection() {
    STATE.connected = !STATE.connected;

    if (STATE.connected) {
      elements.connBadge.className = 'status-badge badge-connected';
      elements.connBadge.innerHTML = `
        <span class="badge-icon">✔</span>
        <span class="badge-text">Conectado</span>
      `;
      elements.netStatusVal.textContent = 'Conectado';
      elements.netStatusVal.className = 'status-val val-success';
      elements.pairingStatusVal.textContent = 'Autorizado';
      elements.pairingStatusVal.className = 'status-val val-warn';

      appendLog(`<span class="log-ok">[OK] Conectado a ${elements.ipAddress.value}</span>`);
      playCyberTone(900, 0.08, 'triangle');
    } else {
      elements.connBadge.className = 'status-badge badge-disconnected';
      elements.connBadge.innerHTML = `
        <span class="badge-icon">✖</span>
        <span class="badge-text">Desconectado</span>
      `;
      elements.netStatusVal.textContent = 'Desconectado';
      elements.netStatusVal.className = 'status-val val-fail';
      elements.pairingStatusVal.textContent = 'No disponible';
      elements.pairingStatusVal.className = 'status-val';

      if (STATE.status === 'RUNNING') {
        pauseProcess();
      }

      appendLog(`<span class="log-fail">[DESCONECTADO] Enlace con ${elements.ipAddress.value} perdido.</span>`);
      playCyberTone(300, 0.12, 'sawtooth');
    }
  }

  // ==========================================
  // SPEED & SETTINGS
  // ==========================================
  function toggleSpeed() {
    STATE.currentSpeedIndex = (STATE.currentSpeedIndex + 1) % STATE.speedModes.length;
    const mode = STATE.speedModes[STATE.currentSpeedIndex];

    elements.speedIndicator.textContent = mode.name;
    elements.speedStatusVal.textContent = mode.label;

    playCyberTone(1000, 0.05, 'sine');
    appendLog(`<span style="color:#00e5ff">[VELOCIDAD] Modo de prueba ajustado a: ${mode.name}</span>`);
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
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // ==========================================
  // TARGET PIN MODAL
  // ==========================================
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
    appendLog(`<span style="color:#ffd54f">[OBJETIVO] Nuevo PIN de prueba establecido: ${formatPin(val)}</span>`);
    playCyberTone(1100, 0.08, 'sine');
  }

  function runQuickDemo() {
    stopAndResetProcess();
    STATE.currentPin = 4378;
    STATE.targetPin = 4381;
    STATE.elapsedSeconds = 4400; // ~01:13:20
    updatePinDisplay("4378", true);
    updateProgressBar(4378);
    updateTimerDisplay();
    if (elements.startPinVal) elements.startPinVal.textContent = "4378";
    if (elements.targetPinVal) elements.targetPinVal.textContent = "4381";

    appendLog(`<span style="color:#00e5ff">[DEMO] Prueba rápida iniciada: Evaluando desde 4378 hacia el PIN objetivo 4381...</span>`);
    startProcess();
  }

  function promptStartPin() {
    const current = formatPin(STATE.currentPin);
    const input = prompt("Ingresa el PIN desde donde deseas que comience la prueba (0000 - 9999):", current);
    if (input !== null) {
      let val = parseInt(input.replace(/\D/g, ''), 10);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 9999) val = 9999;
      
      stopAndResetProcess();
      STATE.currentPin = val;
      updatePinDisplay(formatPin(val), true);
      updateProgressBar(val);
      if (elements.startPinVal) elements.startPinVal.textContent = formatPin(val);
      appendLog(`<span style="color:#00e5ff">[CONFIG] PIN inicial establecido en: ${formatPin(val)}</span>`);
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function initListeners() {
    elements.btnStart.addEventListener('click', startProcess);
    elements.btnPause.addEventListener('click', pauseProcess);
    elements.btnStop.addEventListener('click', stopAndResetProcess);

    if (elements.btnStartPin) elements.btnStartPin.addEventListener('click', promptStartPin);
    if (elements.btnDemoTest) elements.btnDemoTest.addEventListener('click', runQuickDemo);

    elements.deviceSelect.addEventListener('change', updateDeviceProfile);
    elements.connBadge.addEventListener('click', toggleConnection);

    elements.ipAddress.addEventListener('change', (e) => {
      appendLog(`<span class="log-ok">[CONFIG] IP actualizada: ${e.target.value}</span>`);
    });

    elements.btnSpeed.addEventListener('click', toggleSpeed);
    elements.btnAudio.addEventListener('click', toggleAudio);
    elements.btnFullscreen.addEventListener('click', toggleFullscreen);

    elements.btnTargetPin.addEventListener('click', openTargetModal);
    elements.modalClose.addEventListener('click', closeTargetModal);
    elements.modalCancel.addEventListener('click', closeTargetModal);
    elements.modalSave.addEventListener('click', saveTargetModal);

    elements.modalPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveTargetModal();
      if (e.key === 'Escape') closeTargetModal();
    });

    // Keyboard shortcuts
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
  // CYBER CONSTELLATION BACKGROUND CANVAS
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
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Draw connecting lines
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

      // Draw and update particles
      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      requestAnimationFrame(animate);
    }

    animate();
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    initConstellationCanvas();
    initListeners();

    // Set initial display matching mockup image
    updatePinDisplay(formatPin(STATE.currentPin), false);
    updateProgressBar(STATE.currentPin);
    updateTimerDisplay();

    // Initial highlight on PAUSAR button as shown in mockup
    elements.btnPause.classList.add('active');
  }

  // Boot up
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
