# TV PIN CODENAME: ULTIMATE CODIFICADOR (Prototipo UI)

Interfaz de usuario moderna y estilizada en modo oscuro para el prototipo de prueba y auditoría de códigos PIN de 4 dígitos en Smart TVs multimarca (Android TV, Roku, Samsung Tizen, LG webOS).

Diseñado con estética de panel de ciberseguridad futurista: azul pizarra profundo, acentos en verde azulado/teal oscuro, pantallas digitales con brillo cian y paneles con efecto *glassmorphism*.

---

## 📸 Características del Diseño

- **Cabecera Principal:**
  - Título central: `TV PIN CODENAME: ULTIMATE CODIFICADOR` con tipografía digital futurista y resplandor cian/blanco.
  - Barra de utilidades: control de audio sintetizado, selector de velocidad, configuración de PIN objetivo y pantalla completa.

- **Panel Izquierdo ("CONFIGURACIÓN DEL OBJETIVO"):**
  - Selector desplegable multimarca: `Android TV`, `Roku`, `Samsung Tizen` y `LG webOS`.
  - Campo de entrada de dirección IP con indicador de estado `✔ Conectado` interactivo.
  - Maqueta de monitor de TV con bisel metálico, peana y pantalla con animación radial de carga (spinner de 12 aspas).

- **Panel Central ("ESTADO DEL PROCESO"):**
  - Gran contador digital de 4 dígitos (`4381`) en tarjetas divididas con brillo cian y animación de transición.
  - Barra de progreso interactiva con degradado neón (`43.8% (4381 / 10000)`).
  - Cronómetro digital de contraseñas (`01:13:22`) con contador en tiempo real.

- **Panel Derecho ("REGISTRO DE INTENTOS"):**
  - Terminal de consola en modo oscuro con líneas de registro coloreadas con scroll automático:
    - `[OK] Conectado a 192.168.1.50`
    - `[INTENTO 4381] Enviando: 4381... Fallido`
    - Cursor parpadeante `_`
  - Tres botones de acción ergonómicos:
    - **INICIAR PRUEBA** (Verde esmeralda)
    - **PAUSAR** (Amarillo / Dorado)
    - **DETENER / REINICIAR** (Rojo carmesí)

- **Barra de Estado Inferior:**
  - `✔ Estado de Red: Conectado`
  - `⚠ Emparejamiento: Autorizado`
  - `🚀 Velocidad: 1 intento / 1.5s`

---

## 🚀 Cómo Ejecutar

### Opción 1: Modo Aplicación de Escritorio (Recomendado)
Haz doble clic en:
- `launch.bat` (o ejecuta `.\launch.ps1` en PowerShell)

Esto iniciará la interfaz en una ventana de escritorio independiente y limpia (sin barras de URL del navegador) usando Google Chrome o Microsoft Edge.

### Opción 2: En cualquier Navegador Web
Haz doble clic directamente en `index.html`.

---

## 🎮 Controles e Interactividad

| Control | Acción |
|---|---|
| **Espacio** | Alternar Iniciar / Pausar |
| **R** | Detener y reiniciar contador a 0000 |
| **Click en Conectado** | Alternar estado de conexión (Simula pérdida de enlace) |
| **Selector Dispositivo** | Cambia perfiles (puertos 5555, 8060, 8002, 3001) |
| **Botón VELOCIDAD** | Alternar entre Normal (1.5s), Rápido (0.4s) y Turbo (40ms) |
| **Botón OBJETIVO** | Configurar el PIN exacto para simular el desbloqueo exitoso |
| **Botón AUDIO** | Activar/desactivar retroalimentación sonora sintetizada |

---

*Aviso: Este software es un prototipo y simulador de interfaz gráfica de usuario con fines educativos, de diseño conceptual y pruebas de usabilidad.*
