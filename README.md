# Grouploop — AI Agent Context Map

This README is the **entry point for AI agents** working in this repository.

Use it to quickly answer:
- What component am I changing?
- Which files are the source of truth?
- Which other components must be updated for compatibility?

---

## 1) System overview

Grouploop connects ESP32-based devices to browser applications via a Python WebSocket relay.

Main components:
- **Client Hub** (Flask): serves browser apps from `client-hub/app/static/apps/*`
- **Socket Server** (Python `websockets`): relays frames and routes commands
- **Firmware** (PlatformIO / Arduino): device-side processes for BLE, IMU, LEDs, vibration, Wi‑Fi, WebSocket
- **Documentation** (MkDocs): architecture, deployment, extension guides

Runtime orchestration is in [docker-compose.yml](docker-compose.yml).

---

## 2) Running services and ports

Defined in [docker-compose.yml](docker-compose.yml):

- `socket` → host `5003` (container `5000`)  
  Code: [socket-server/app/app.py](socket-server/app/app.py)
- `client_hub` → host `5004` (container `5000`)  
  Code: [client-hub/app/app.py](client-hub/app/app.py)
- `docs` → host `5006` (container `5000`)  
  Code/config: [documentation/mkdocs.yml](documentation/mkdocs.yml)

Important env vars:
- `WS_DEFAULT_URL`, `CDN_BASE_URL`, `DEFAULT_APP` (used by Client Hub)
- `WS_HOST`, `WS_PORT` (used by Socket Server)

---

## 3) Source of truth order (important)

When information conflicts, trust in this order:

1. **Runtime code + compose**
   - [docker-compose.yml](docker-compose.yml)
   - [client-hub/app/app.py](client-hub/app/app.py)
   - [socket-server/app/app.py](socket-server/app/app.py)
   - [grouploop-firmware/ble-scanner/src/main.cpp](grouploop-firmware/ble-scanner/src/main.cpp)
2. **Component docs/pages**
   - [documentation/docs/architecture/overview.md](documentation/docs/architecture/overview.md)
   - [documentation/docs/deployment/structure.md](documentation/docs/deployment/structure.md)
   - [documentation/docs/development/extending-system.md](documentation/docs/development/extending-system.md)
   - [documentation/docs/development/api-reference.md](documentation/docs/development/api-reference.md)
   - [documentation/docs/firmware/architecture.md](documentation/docs/firmware/architecture.md)
3. **Legacy/historical files** (may be stale; verify before editing)

---

## 4) Where to work by purpose

| Purpose | Primary files | Notes |
|---|---|---|
| Change app discovery / landing page | [client-hub/app/app.py](client-hub/app/app.py), [client-hub/app/templates/landing.html](client-hub/app/templates/landing.html) | `_list_apps()` auto-discovers folders containing `index.html`. |
| Change shared runtime config injected into apps | [client-hub/app/app.py](client-hub/app/app.py) (`/config.js`) | Sets `window.APP_CONFIG.wsDefaultUrl`, `cdnBaseUrl`, `appsBaseUrl`. |
| Add a new browser app | [client-hub/app/static/apps/](client-hub/app/static/apps/) | Add `app-name/index.html`; optional `README.md` is rendered on landing page. |
| Update shared browser protocol/parser/commands | [client-hub/app/static/vendor/js/HitloopDevice.js](client-hub/app/static/vendor/js/HitloopDevice.js), [client-hub/app/static/vendor/js/HitloopDeviceManager.js](client-hub/app/static/vendor/js/HitloopDeviceManager.js) | Central client-side frame parsing + command formatting. |
| Change device control UI/command sending | [client-hub/app/static/apps/device-control/index.html](client-hub/app/static/apps/device-control/index.html), [client-hub/app/static/apps/device-control/client.js](client-hub/app/static/apps/device-control/client.js) | Uses `HitloopDeviceManager.sendCommandToDevice`. |
| Change dashboard visualization | [client-hub/app/static/apps/device-dashboard/index.html](client-hub/app/static/apps/device-dashboard/index.html), [client-hub/app/static/apps/device-dashboard/client.js](client-hub/app/static/apps/device-dashboard/client.js) | Visualizes parsed sensor values and tap state. |
| Change simulator swarm/physics/frame generation | [client-hub/app/static/apps/device-simulator/sketch.js](client-hub/app/static/apps/device-simulator/sketch.js), [client-hub/app/static/apps/device-simulator/device.js](client-hub/app/static/apps/device-simulator/device.js), [client-hub/app/static/apps/device-simulator/ui.js](client-hub/app/static/apps/device-simulator/ui.js), [client-hub/app/static/apps/device-simulator/cfg.js](client-hub/app/static/apps/device-simulator/cfg.js) | Includes flocking, tap simulation, send rate controls. |
| Change mobile device emulator behavior | [client-hub/app/static/apps/device-emulator/client.js](client-hub/app/static/apps/device-emulator/client.js) | Encodes 20-char frames and supports tap emulation. |
| Change MIDI mapper processing | [client-hub/app/static/apps/device-midi-mapper/mapping-engine.js](client-hub/app/static/apps/device-midi-mapper/mapping-engine.js) | Sensor→MIDI conversion and runtime mapping logic. |
| Change MIDI IO integration | [client-hub/app/static/apps/device-midi-mapper/midi.js](client-hub/app/static/apps/device-midi-mapper/midi.js) | WebMidi output selection + send methods. |
| Change MIDI mapper UI/state/persistence | [client-hub/app/static/apps/device-midi-mapper/client.js](client-hub/app/static/apps/device-midi-mapper/client.js), [client-hub/app/static/apps/device-midi-mapper/ui/](client-hub/app/static/apps/device-midi-mapper/ui/), [client-hub/app/static/apps/device-midi-mapper/core/app-state.js](client-hub/app/static/apps/device-midi-mapper/core/app-state.js), [client-hub/app/static/apps/device-midi-mapper/storage.js](client-hub/app/static/apps/device-midi-mapper/storage.js) | Modularized by concern. |
| Change hitloop-games scenes and flow | [client-hub/app/static/apps/hitloop-games/sketch.js](client-hub/app/static/apps/hitloop-games/sketch.js), [client-hub/app/static/apps/hitloop-games/SceneManager.js](client-hub/app/static/apps/hitloop-games/SceneManager.js), [client-hub/app/static/apps/hitloop-games/scenes/](client-hub/app/static/apps/hitloop-games/scenes/) | Active scenes are registered in `sketch.js`. |
| Change WebSocket relay protocol/routing | [socket-server/app/app.py](socket-server/app/app.py) | `handle_websocket_connection`, `handle_command`, `broadcast_to_subscribers`, `send_to_device`, `send_to_all_devices`. |
| Change server command definitions fallback | [socket-server/app/app.py](socket-server/app/app.py) (`load_commands`) | Primary registry is loaded from external `commands.json` URL (`CDN_BASE_URL`). |
| Change firmware boot lifecycle / process orchestration | [grouploop-firmware/ble-scanner/src/main.cpp](grouploop-firmware/ble-scanner/src/main.cpp), [grouploop-firmware/ble-scanner/include/ProcessManager.h](grouploop-firmware/ble-scanner/include/ProcessManager.h) | Main loop starts/stops processes based on Wi‑Fi/config mode. |
| Change firmware command execution | [grouploop-firmware/ble-scanner/include/CommandRegistry.h](grouploop-firmware/ble-scanner/include/CommandRegistry.h), [grouploop-firmware/ble-scanner/include/processes/LedProcess.h](grouploop-firmware/ble-scanner/include/processes/LedProcess.h), [grouploop-firmware/ble-scanner/include/processes/VibrationProcess.h](grouploop-firmware/ble-scanner/include/processes/VibrationProcess.h), [grouploop-firmware/ble-scanner/src/main.cpp](grouploop-firmware/ble-scanner/src/main.cpp) (`registerGlobalCommands`) | Most process implementations are header-based under `include/processes`. |
| Change firmware frame payload / telemetry mapping | [grouploop-firmware/ble-scanner/include/processes/PublishProcess.h](grouploop-firmware/ble-scanner/include/processes/PublishProcess.h), [grouploop-firmware/ble-scanner/include/processes/IMUProcess.h](grouploop-firmware/ble-scanner/include/processes/IMUProcess.h), [grouploop-firmware/ble-scanner/include/processes/BLEProcess.h](grouploop-firmware/ble-scanner/include/processes/BLEProcess.h) | Frame format and sensor scaling are here. |
| Change firmware network/reconnect behavior | [grouploop-firmware/ble-scanner/include/processes/WiFiProcess.h](grouploop-firmware/ble-scanner/include/processes/WiFiProcess.h), [grouploop-firmware/ble-scanner/include/WebSocketManager.h](grouploop-firmware/ble-scanner/include/WebSocketManager.h), [grouploop-firmware/ble-scanner/include/Configuration.h](grouploop-firmware/ble-scanner/include/Configuration.h) | Includes persisted Wi‑Fi + socket URL config. |
| Change docs navigation/content | [documentation/mkdocs.yml](documentation/mkdocs.yml), [documentation/docs/](documentation/docs/) | Add pages and update nav together. |

---

## 5) Protocol touchpoints (cross-component checklist)

### 5.1 Sensor frame format changes

Current browser/device flow assumes a **20-char hex frame**:

`id(4) + ax(2) + ay(2) + az(2) + dNW(2) + dNE(2) + dSE(2) + dSW(2) + tap(2)`

If you change this format, update **all** of:
- Firmware producer: [grouploop-firmware/ble-scanner/include/processes/PublishProcess.h](grouploop-firmware/ble-scanner/include/processes/PublishProcess.h)
- Server relay assumptions: [socket-server/app/app.py](socket-server/app/app.py)
- Browser parser: [client-hub/app/static/vendor/js/HitloopDevice.js](client-hub/app/static/vendor/js/HitloopDevice.js)
- Browser manager validation: [client-hub/app/static/vendor/js/HitloopDeviceManager.js](client-hub/app/static/vendor/js/HitloopDeviceManager.js)
- Simulated producers: [client-hub/app/static/apps/device-simulator/device.js](client-hub/app/static/apps/device-simulator/device.js), [client-hub/app/static/apps/device-emulator/client.js](client-hub/app/static/apps/device-emulator/client.js)
- Relevant docs pages in [documentation/docs/](documentation/docs/)

### 5.2 Command changes

Commands originate in browser apps as:

`cmd:<target>:<command>:<parameters>`

Command changes usually require updates in:
- Browser command validation/sending: [client-hub/app/static/vendor/js/HitloopDevice.js](client-hub/app/static/vendor/js/HitloopDevice.js)
- Socket routing: [socket-server/app/app.py](socket-server/app/app.py)
- Firmware command handlers: [grouploop-firmware/ble-scanner/include/processes/](grouploop-firmware/ble-scanner/include/processes/), [grouploop-firmware/ble-scanner/src/main.cpp](grouploop-firmware/ble-scanner/src/main.cpp)
- External command registry (`commands.json` via `CDN_BASE_URL`) and/or fallback in [socket-server/app/app.py](socket-server/app/app.py)

---

## 6) Firmware notes for agents

- Canonical firmware project in this repo: [grouploop-firmware/ble-scanner/](grouploop-firmware/ble-scanner/)
- Build config: [grouploop-firmware/ble-scanner/platformio.ini](grouploop-firmware/ble-scanner/platformio.ini)
- Many firmware implementations are in headers under [grouploop-firmware/ble-scanner/include/processes/](grouploop-firmware/ble-scanner/include/processes/) (not separate `.cpp` files).

---

## 7) Documentation map

Start here for architecture and extension context:
- [documentation/docs/architecture/overview.md](documentation/docs/architecture/overview.md)
- [documentation/docs/deployment/structure.md](documentation/docs/deployment/structure.md)
- [documentation/docs/development/extending-system.md](documentation/docs/development/extending-system.md)
- [documentation/docs/development/api-reference.md](documentation/docs/development/api-reference.md)
- [documentation/docs/firmware/architecture.md](documentation/docs/firmware/architecture.md)

MkDocs nav/source: [documentation/mkdocs.yml](documentation/mkdocs.yml)

---

## 8) Known drift / legacy signals

These files exist but should be treated carefully:

- [socket-server/README.md](socket-server/README.md) describes Flask-SocketIO patterns, while runtime server code is currently in [socket-server/app/app.py](socket-server/app/app.py) using `websockets`.
- [documentation/docs/index.md](documentation/docs/index.md) contains mixed historical content and references not fully aligned with current `docker-compose.yml`.
- [.github/workflows/deploy-socket-demo.yml](.github/workflows/deploy-socket-demo.yml) references a `socket-demo` artifact path not represented in current compose services.
- Test files in [socket-server/app/test.py](socket-server/app/test.py) and parts of [grouploop-firmware/ble-scanner/test/](grouploop-firmware/ble-scanner/test/) appear legacy and are not strong indicators of current behavior.

---

## 9) Minimal agent workflow

1. Identify task type in **Section 4** and open those files first.
2. Cross-check assumptions with **Section 3 (source of truth order)**.
3. If changing protocol/commands, follow **Section 5 checklist** before finishing.
4. Update docs under [documentation/docs/](documentation/docs/) when behavior changes.
