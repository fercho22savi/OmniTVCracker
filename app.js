/**
 * OmniTVCracker v4.0 — REAL MODE
 * Cliente WebSocket para backend Python real (server.py)
 * Elimina toda simulación. Solo modo real.
 */
(function () {
  'use strict';

  // ════════════════════════════════════════════════
  //  THREAD DEFINITIONS (display structure)
  // ════════════════════════════════════════════════
  const THREADS = [
    { id: 0, name: 'HILO 1', colorClass: 'pfx-green',   rangeStart: 0,    rangeEnd: 1999, currentPin: 0,    testedCount: 0 },
    { id: 1, name: 'HILO 2', colorClass: 'pfx-blue',    rangeStart: 2000, rangeEnd: 3999, currentPin: 2000, testedCount: 0 },
    { id: 2, name: 'HILO 3', colorClass: 'pfx-yellow',  rangeStart: 4000, rangeEnd: 5999, currentPin: 4000, testedCount: 0 },
    { id: 3, name: 'HILO 4', colorClass: 'pfx-magenta', rangeStart: 6000, rangeEnd: 7999, currentPin: 6000, testedCount: 0 },
    { id: 4, name: 'HILO 5', colorClass: 'pfx-cyan',    rangeStart: 8000, rangeEnd: 9999, currentPin: 8000, testedCount: 0 },
  ];

  // ════════════════════════════════════════════════
  //  APP STATE
  // ════════════════════════════════════════════════
  const STATE = {
    status: 'IDLE',       // 'IDLE' | 'RUNNING' | 'PAUSED' | 'FOUND'
    connected: false,
    audioEnabled: true,
    elapsedMs: 0,
    startTime: 0,
    timerInterval: null,
  };

  // ════════════════════════════════════════════════
  //  DOM CACHE
  // ════════════════════════════════════════════════
  const E = {
    btnAudio:            document.getElementById('btn-audio'),
    btnFullscreen:       document.getElementById('btn-fullscreen'),
    btnRealConnect:      document.getElementById('btn-real-connect'),
    deviceSelect:        document.getElementById('device-select'),
    ipAddress:           document.getElementById('ip-address'),
    portInput:           document.getElementById('port-input'),
    connBadge:           document.getElementById('conn-badge'),
    adbMethod:           document.getElementById('adb-method-select'),
    pinStart:            document.getElementById('pin-start-input'),
    pinEnd:              document.getElementById('pin-end-input'),
    tvSpinner:           document.getElementById('tv-spinner'),
    tvOverlay:           document.getElementById('tv-overlay'),
    tvDeviceLabel:       document.getElementById('tv-device-label'),
    tvLed:               document.getElementById('tv-led'),
    centerTitle:         document.getElementById('center-panel-title'),
    globalProgressFill:  document.getElementById('global-progress-fill'),
    globalProgressPct:   document.getElementById('global-progress-pct'),
    globalProgressCount: document.getElementById('global-progress-count'),
    timerDisplay:        document.getElementById('timer-display'),
    terminalLogs:        document.getElementById('terminal-logs'),
    btnStart:            document.getElementById('btn-start'),
    btnPause:            document.getElementById('btn-pause'),
    btnStop:             document.getElementById('btn-stop'),
    netStatusVal:        document.getElementById('net-status-val'),
    pairingStatusVal:    document.getElementById('pairing-status-val'),
    speedStatusVal:      document.getElementById('speed-status-val'),
    threadsActiveVal:    document.getElementById('threads-active-val'),
    backendStatus:       document.getElementById('backend-status'),
    threads: THREADS.map((_, i) => ({
      row:    document.getElementById(`thread-row-${i}`),
      digits: Array.from(document.querySelectorAll(`#thread-digits-${i} .t-digit-val`)),
      barFill:document.getElementById(`t-fill-${i}`),
      label:  document.getElementById(`t-label-${i}`),
    })),
  };

  // ════════════════════════════════════════════════
  //  AUDIO (Web Audio API)
  // ════════════════════════════════════════════════
  let _audioCtx = null;
  function getAudioCtx() {
    if (!_audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) _audioCtx = new AC();
    }
    if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  }
  function playCyberTone(freq = 880, dur = 0.05, type = 'sine', gainVal = 0.08) {
    if (!STATE.audioEnabled) return;
    try {
      const ctx = getAudioCtx(); if (!ctx) return;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(gainVal, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  }
  function playSuccessTone() {
    [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) =>
      setTimeout(() => playCyberTone(f, 0.28, 'triangle', 0.2), i * 100));
  }

  // ════════════════════════════════════════════════
  //  FORMATTING
  // ════════════════════════════════════════════════
  function formatPin(n) {
    return Math.max(0, Math.min(9999, n)).toString().padStart(4, '0');
  }
  function formatTimer(ms) {
    const s  = Math.floor(ms / 1000);
    const h  = Math.floor(s / 3600).toString().padStart(2, '0');
    const m  = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sc = (s % 60).toString().padStart(2, '0');
    const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${h}:${m}:${sc}:${cs}`;
  }

  // ════════════════════════════════════════════════
  //  UI HELPERS
  // ════════════════════════════════════════════════
  function updateThreadDisplay(tid, pinStr) {
    const dom = E.threads[tid]; if (!dom) return;
    dom.digits.forEach((d, i) => { d.textContent = pinStr[i] || '0'; });
    const t   = THREADS[tid];
    const pct = ((t.testedCount / 2000) * 100).toFixed(1);
    dom.barFill.style.width = `${pct}%`;
    dom.label.textContent   = `${pct}% (${pinStr}/${t.rangeEnd + 1})`;
  }

  function updateGlobalProgress(total) {
    if (total === undefined) {
      total = 0;
      THREADS.forEach(t => { total += t.testedCount; });
    }
    total = Math.min(10000, total);
    const pct = ((total / 10000) * 100).toFixed(1);
    E.globalProgressFill.style.width   = `${pct}%`;
    E.globalProgressPct.textContent    = `${pct}%`;
    E.globalProgressCount.textContent  = total;
  }

  function appendLog(lineHtml) {
    const waiting = E.terminalLogs.querySelector('.log-waiting');
    if (waiting) waiting.remove();

    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = lineHtml;
    E.terminalLogs.appendChild(div);

    // Mantener máximo 70 líneas
    const lines = E.terminalLogs.querySelectorAll('.log-line:not(.log-waiting)');
    if (lines.length > 70) {
      for (let i = 0; i < lines.length - 55; i++) lines[i].remove();
    }

    if (STATE.status === 'RUNNING') {
      const w = document.createElement('div');
      w.className = 'log-line log-waiting';
      w.innerHTML = '5 hilos reales activos<span class="cursor-blink">_</span>';
      E.terminalLogs.appendChild(w);
    }
    E.terminalLogs.scrollTop = E.terminalLogs.scrollHeight;
  }

  function resetAllThreads() {
    THREADS.forEach((t, i) => {
      t.currentPin  = t.rangeStart;
      t.testedCount = 0;
      updateThreadDisplay(i, formatPin(t.rangeStart));
      E.threads[i].row.classList.remove('thread-winner');
    });
    updateGlobalProgress(0);
  }

  function setBackendStatus(online) {
    if (!E.backendStatus) return;
    if (online) {
      E.backendStatus.className = 'backend-badge backend-online';
      E.backendStatus.innerHTML = '<span class="icon">⬡</span> BACKEND: ONLINE';
    } else {
      E.backendStatus.className = 'backend-badge backend-offline';
      E.backendStatus.innerHTML = '<span class="icon">⬡</span> BACKEND: OFFLINE';
    }
  }

  // ════════════════════════════════════════════════
  //  WEBSOCKET CLIENT
  // ════════════════════════════════════════════════
  const WS_URL = 'ws://localhost:8765';
  let ws = null;
  let wsReconnectTimer = null;

  function connectWS() {
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
    if (ws && ws.readyState <= WebSocket.OPEN) return;
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen    = () => { setBackendStatus(true); appendLog('<span class="log-ok">[BACKEND] Servidor Python conectado ✔</span>'); };
      ws.onclose   = () => { setBackendStatus(false); ws = null; wsReconnectTimer = setTimeout(connectWS, 4000); };
      ws.onerror   = ()  => setBackendStatus(false);
      ws.onmessage = e   => { try { handleWSMessage(JSON.parse(e.data)); } catch {} };
    } catch { setBackendStatus(false); }
  }

  function sendWS(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    appendLog('<span class="log-fail">[ERROR] Backend offline — ejecuta launch.bat primero.</span>');
    return false;
  }

  // ════════════════════════════════════════════════
  //  ACTIONS
  // ════════════════════════════════════════════════
  function connectTV() {
    const ip     = E.ipAddress.value.trim();
    const port   = parseInt(E.portInput.value.trim() || '5555', 10);
    const device = E.deviceSelect.value;
    if (!ip) { appendLog('<span class="log-fail">[ERROR] Introduce la IP del TV.</span>'); return; }
    sendWS({ cmd: 'connect', ip, port, device });
    playCyberTone(700, 0.08, 'sine');
  }

  function startCracking() {
    if (STATE.status === 'RUNNING') return;

    // Si está pausado → reanudar
    if (STATE.status === 'PAUSED') {
      if (!sendWS({ cmd: 'resume' })) {
        appendLog('<span class="log-fail">[ERROR] Backend offline — ejecuta launch.bat primero.</span>');
      }
      return;
    }

    // Verificar backend online
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Feedback visual: parpadear el badge de backend
      if (E.backendStatus) {
        E.backendStatus.style.animation = 'none';
        E.backendStatus.style.border    = '1px solid #ff5252';
        E.backendStatus.style.boxShadow = '0 0 12px rgba(255,82,82,0.8)';
        setTimeout(() => {
          if (E.backendStatus) { E.backendStatus.style.boxShadow = ''; E.backendStatus.style.border = ''; }
        }, 1500);
      }
      appendLog('<span class="log-fail">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>');
      appendLog('<span class="log-fail">[BACKEND OFFLINE] No se puede iniciar sin el servidor Python.</span>');
      appendLog('<span class="log-warn">[SOLUCIÓN] Cierra esto y ejecuta: launch.bat</span>');
      appendLog('<span class="log-warn">           O desde PowerShell: .\\launch.ps1</span>');
      appendLog('<span class="log-fail">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>');
      playCyberTone(220, 0.3, 'sawtooth', 0.12);
      return;
    }

    const ip       = E.ipAddress.value.trim();
    const port     = parseInt(E.portInput.value.trim() || '5555', 10);
    const device   = E.deviceSelect.value;
    const method   = E.adbMethod  ? E.adbMethod.value  : 'text';
    const pinStart = parseInt(E.pinStart ? (E.pinStart.value || '0')    : '0',    10);
    const pinEnd   = parseInt(E.pinEnd   ? (E.pinEnd.value   || '9999') : '9999', 10);

    if (!ip) {
      appendLog('<span class="log-fail">[ERROR] Introduce la IP del TV antes de iniciar.</span>');
      return;
    }

    const sent = sendWS({ cmd: 'start', ip, port, device, entry_method: method, pin_start: pinStart, pin_end: pinEnd });
    if (!sent) return;

    STATE.status    = 'RUNNING';
    STATE.elapsedMs = 0;
    STATE.startTime = Date.now();

    clearInterval(STATE.timerInterval);
    STATE.timerInterval = setInterval(() => {
      STATE.elapsedMs = Date.now() - STATE.startTime;
      if (E.timerDisplay) E.timerDisplay.textContent = formatTimer(STATE.elapsedMs);
    }, 35);

    E.btnStart.classList.add('active');
    E.btnPause.classList.remove('active');
    E.btnStop.classList.remove('active');
    if (E.tvSpinner) E.tvSpinner.style.animationPlayState = 'running';
    if (E.tvLed)     { E.tvLed.style.background = '#ffaa00'; E.tvLed.style.boxShadow = '0 0 10px #ffaa00'; }
    if (E.threadsActiveVal) E.threadsActiveVal.textContent = '5 / 5 (REAL)';
    playCyberTone(1200, 0.1, 'sine');
  }

  function pauseCracking() {
    if (STATE.status !== 'RUNNING') return;
    if (!sendWS({ cmd: 'pause' })) {
      appendLog('<span class="log-fail">[ERROR] Backend offline.</span>');
    }
  }

  function stopCracking() {
    // El stop SIEMPRE resetea la UI localmente, con o sin backend
    sendWS({ cmd: 'stop' }); // intenta notificar al backend (puede fallar)

    clearInterval(STATE.timerInterval); STATE.timerInterval = null;
    STATE.status    = 'IDLE';
    STATE.elapsedMs = 0;

    if (E.timerDisplay)         E.timerDisplay.textContent    = '00:00:00:00';
    if (E.btnStart)             E.btnStart.classList.remove('active');
    if (E.btnPause)             E.btnPause.classList.remove('active');
    if (E.btnStop)              E.btnStop.classList.add('active');
    if (E.centerTitle)          E.centerTitle.textContent     = 'ESTADO DEL PROCESO (5 HILOS REALES)';
    if (E.tvSpinner)            E.tvSpinner.style.display     = 'block';
    if (E.tvLed)                { E.tvLed.style.background    = '#00e5ff'; E.tvLed.style.boxShadow = '0 0 8px #00e5ff'; }
    if (E.pairingStatusVal)     { E.pairingStatusVal.textContent = 'En espera'; E.pairingStatusVal.className = 'status-val val-cyan'; }
    if (E.speedStatusVal)       { E.speedStatusVal.textContent  = 'ADB Multi-Thread'; E.speedStatusVal.className = 'status-val val-cyan'; }
    if (E.threadsActiveVal)     E.threadsActiveVal.textContent = '5 / 5 (Listo)';

    resetAllThreads();
    playCyberTone(350, 0.15, 'sawtooth');
    appendLog('<span style="color:#80deea">[RESET] UI reiniciada. Listo para nueva prueba.</span>');
  }

  function updateDeviceProfile() {
    const devKey = E.deviceSelect.value;
    const ports  = { android: '5555', roku: '8060', samsung: '8002', lg: '3001' };
    const labels = { android: 'ANDROID TV OS', roku: 'ROKU OS', samsung: 'SAMSUNG TIZEN', lg: 'LG WEBOS' };
    if (E.portInput)     E.portInput.value         = ports[devKey]  || '5555';
    if (E.tvDeviceLabel) E.tvDeviceLabel.textContent= labels[devKey] || 'ANDROID TV OS';
    appendLog(`<span class="log-ok">[PERFIL] ${(labels[devKey] || devKey).toUpperCase()} — Puerto ${ports[devKey] || '5555'}</span>`);
    playCyberTone(700, 0.08, 'sine');
  }

  function toggleAudio() {
    STATE.audioEnabled = !STATE.audioEnabled;
    E.btnAudio.classList.toggle('active', STATE.audioEnabled);
    E.btnAudio.innerHTML = `<span class="icon">${STATE.audioEnabled ? '🔊' : '🔇'}</span> AUDIO: ${STATE.audioEnabled ? 'ON' : 'OFF'}`;
    if (STATE.audioEnabled) playCyberTone(880, 0.06, 'sine');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else if (document.exitFullscreen) document.exitFullscreen();
  }

  // ════════════════════════════════════════════════
  //  WEBSOCKET MESSAGE HANDLER
  // ════════════════════════════════════════════════
  function handleWSMessage(msg) {
    switch (msg.type) {

      case 'init':
        if (msg.adb_available) {
          appendLog(`<span class="log-ok">[BACKEND] ADB listo: ${msg.adb_path}</span>`);
        } else {
          appendLog(`<span class="log-fail">[BACKEND] ADB no encontrado.</span>`);
          appendLog(`<span class="log-warn">[INFO] ${msg.adb_path}</span>`);
        }
        break;

      case 'connect_result':
        if (msg.success) {
          STATE.connected = true;
          E.connBadge.className = 'status-badge badge-connected';
          E.connBadge.innerHTML = '<span class="badge-icon">✔</span><span class="badge-text">Conectado</span>';
          E.netStatusVal.textContent = 'Conectado (Real)';
          E.netStatusVal.className   = 'status-val val-success';
          appendLog(`<span class="log-ok">[REAL] ${msg.message}</span>`);
          playCyberTone(900, 0.08, 'triangle');
        } else {
          STATE.connected = false;
          E.connBadge.className = 'status-badge badge-disconnected';
          E.connBadge.innerHTML = '<span class="badge-icon">✖</span><span class="badge-text">Fallo</span>';
          E.netStatusVal.textContent = 'Desconectado';
          E.netStatusVal.className   = 'status-val val-fail';
          appendLog(`<span class="log-fail">[REAL] ${msg.message}</span>`);
          playCyberTone(300, 0.12, 'sawtooth');
        }
        break;

      case 'started':
        appendLog(`<span class="log-ok">[REAL] ${msg.message}</span>`);
        // Inicializar cada hilo en su rangeStart desde el backend
        if (msg.ranges) {
          msg.ranges.forEach(r => {
            const t = THREADS[r.thread];
            if (t) { t.currentPin = r.start; t.testedCount = 0; updateThreadDisplay(r.thread, formatPin(r.start)); }
          });
        }
        break;

      case 'attempt': {
        const tid    = msg.thread;
        const pinStr = msg.pin;
        const t      = THREADS[tid];
        if (t) {
          t.currentPin  = parseInt(pinStr, 10);
          t.testedCount = Math.min(2000, Math.max(0, t.currentPin - t.rangeStart));
          updateThreadDisplay(tid, pinStr);
        }
        updateGlobalProgress(msg.total);
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
          appendLog(`<span class="log-sent">[ROKU→TV] ${msg.message}</span>`);
        }
        break;

      case 'found': {
        const wTid   = msg.thread;
        const wPin   = msg.pin;
        const wTname = THREADS[wTid] ? THREADS[wTid].name : `HILO ${wTid + 1}`;

        STATE.status = 'FOUND';
        clearInterval(STATE.timerInterval); STATE.timerInterval = null;

        E.btnStart.classList.remove('active');
        E.btnPause.classList.remove('active');

        const domW = E.threads[wTid];
        if (domW) domW.row.classList.add('thread-winner');
        updateThreadDisplay(wTid, wPin);

        E.centerTitle.innerHTML =
          `<span style="color:#00ffaa;text-shadow:0 0 12px #00ffaa">¡PIN REAL ENCONTRADO POR ${wTname}!</span>`;
        E.pairingStatusVal.textContent = '¡PIN Real Descifrado!';
        E.pairingStatusVal.className   = 'status-val val-success';
        E.speedStatusVal.textContent   = 'Proceso Completado';
        E.speedStatusVal.className     = 'status-val val-success';
        E.threadsActiveVal.textContent = `REAL — ${wTname} GANADOR`;

        playSuccessTone();
        appendLog(`<span class="pfx-winner">[${wTname}] PIN REAL: ${wPin} → ✔ CORRECTO</span>`);
        appendLog('<span class="log-success">════════════════════════════════════════════</span>');
        appendLog(`<span class="log-success">[ÉXITO] Smart TV desbloqueada con PIN: ${wPin}</span>`);
        appendLog('<span class="log-success">════════════════════════════════════════════</span>');

        E.tvSpinner.style.display   = 'none';
        E.tvOverlay.innerHTML = `
          <span style="color:#00ffaa;font-size:15px;font-weight:800;text-shadow:0 0 10px #00ffaa">✔ DESBLOQUEADO</span>
          <span style="color:#fff;font-size:11px;font-weight:bold;letter-spacing:1px">PIN: ${wPin} (${wTname})</span>
        `;
        E.tvLed.style.background = '#00ffaa';
        E.tvLed.style.boxShadow  = '0 0 14px #00ffaa';
        break;
      }

      case 'paused':
        STATE.status = 'PAUSED';
        clearInterval(STATE.timerInterval); STATE.timerInterval = null;
        E.btnStart.classList.remove('active');
        E.btnPause.classList.add('active');
        E.threadsActiveVal.textContent = '5 / 5 (Pausado)';
        appendLog('<span class="log-warn">[PAUSA] 5 hilos en espera.</span>');
        break;

      case 'resumed':
        STATE.status    = 'RUNNING';
        STATE.startTime = Date.now() - STATE.elapsedMs;
        clearInterval(STATE.timerInterval);
        STATE.timerInterval = setInterval(() => {
          STATE.elapsedMs = Date.now() - STATE.startTime;
          E.timerDisplay.textContent = formatTimer(STATE.elapsedMs);
        }, 35);
        E.btnStart.classList.add('active');
        E.btnPause.classList.remove('active');
        E.threadsActiveVal.textContent = '5 / 5 (REAL)';
        appendLog('<span class="log-ok">[REANUDADO] Hilos reales activos.</span>');
        break;

      case 'stopped':
        STATE.status = 'IDLE';
        clearInterval(STATE.timerInterval); STATE.timerInterval = null;
        E.threadsActiveVal.textContent = '5 / 5 (Detenido)';
        break;

      case 'exhausted':
        STATE.status = 'IDLE';
        clearInterval(STATE.timerInterval); STATE.timerInterval = null;
        appendLog(`<span class="log-fail">[FIN] ${msg.message}</span>`);
        E.pairingStatusVal.textContent = 'PIN no encontrado';
        E.pairingStatusVal.className   = 'status-val val-fail';
        break;

      case 'log': {
        const cls  = { ok: 'log-ok', warn: 'log-warn', error: 'log-fail', info: 'log-info' }[msg.level] || '';
        const attr = cls ? `class="${cls}"` : 'style="color:#80deea"';
        appendLog(`<span ${attr}>${msg.text}</span>`);
        break;
      }
    }
  }

  // ════════════════════════════════════════════════
  //  KEYBOARD SHORTCUTS
  // ════════════════════════════════════════════════
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if      (STATE.status === 'RUNNING') pauseCracking();
      else if (STATE.status === 'PAUSED')  startCracking();
      else                                 startCracking();
    } else if (e.key === 'r' || e.key === 'R') {
      stopCracking();
    } else if (e.key === 'c' || e.key === 'C') {
      connectTV();
    }
  });

  // ════════════════════════════════════════════════
  //  CONSTELLATION BACKGROUND CANVAS
  // ════════════════════════════════════════════════
  function initCanvas() {
    const canvas = document.getElementById('bg-canvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h;
    const particles = [];
    const N = 55, MD = 140;

    function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
    window.addEventListener('resize', resize); resize();

    class Particle {
      constructor() { this.x=Math.random()*w; this.y=Math.random()*h; this.vx=(Math.random()-.5)*.45; this.vy=(Math.random()-.5)*.45; this.r=Math.random()*1.8+.8; }
      update() { this.x+=this.vx; this.y+=this.vy; if(this.x<0)this.x=w; if(this.x>w)this.x=0; if(this.y<0)this.y=h; if(this.y>h)this.y=0; }
      draw()   { ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fillStyle='rgba(0,229,255,.45)'; ctx.fill(); }
    }
    for (let i = 0; i < N; i++) particles.push(new Particle());

    (function loop() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < MD) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,200,255,${(1 - d/MD) * .18})`; ctx.lineWidth = 1; ctx.stroke();
          }
        }
      }
      particles.forEach(p => { p.update(); p.draw(); });
      requestAnimationFrame(loop);
    })();
  }

  // ════════════════════════════════════════════════
  //  INIT
  // ════════════════════════════════════════════════
  function init() {
    initCanvas();
    resetAllThreads();
    E.timerDisplay.textContent = '00:00:00:00';

    // Event listeners
    E.btnStart.addEventListener('click',      startCracking);
    E.btnPause.addEventListener('click',      pauseCracking);
    E.btnStop.addEventListener('click',       stopCracking);
    E.btnAudio.addEventListener('click',      toggleAudio);
    E.btnFullscreen.addEventListener('click', toggleFullscreen);
    E.deviceSelect.addEventListener('change', updateDeviceProfile);
    if (E.btnRealConnect) E.btnRealConnect.addEventListener('click', connectTV);

    // Auto-conectar al backend al iniciar
    connectWS();

    appendLog('<span class="log-ok">[SISTEMA] OmniTVCracker v4.0 — Modo Real iniciado.</span>');
    appendLog('<span style="color:#80deea">[INFO] Conecta al TV y presiona INICIAR PRUEBA.</span>');
    appendLog('<span style="color:#80deea">[INFO] Teclas: ESPACIO=Iniciar/Pausar | R=Detener | C=Conectar</span>');
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
