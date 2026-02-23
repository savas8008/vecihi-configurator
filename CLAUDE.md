# CLAUDE.md - X-Flight Configurator

## Project Overview

X-Flight Configurator is a web-based configuration utility for ESP32-based fixed-wing flight controllers. It communicates with the flight controller over USB serial (Web Serial API at 115,200 baud) and provides a multi-page SPA for real-time tuning, calibration, and monitoring.

The companion firmware repository is **vecihi** (same GitHub account).

## Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript (ES6+)** — no build tools, no bundler, no package manager
- **Bootstrap 5.3.0** — layout and UI components (CDN)
- **Three.js r128** — 3D attitude visualization (CDN)
- **Leaflet.js 1.9.4** — GPS map (CDN)
- **Chart.js** — telemetry charts (CDN)
- **Web Serial API** — serial communication with ESP32

All dependencies are loaded from CDN. There is no `package.json`, no npm, and no build step.

## Repository Structure

```
xflightconfigurator/
├── configurator.html          # Single-page application (main entry)
├── style.css                  # All styling, CSS custom properties theming
└── js/
    ├── main.js                # App initialization, global event listeners
    ├── serial_communication.js # Serial port connect/disconnect/read/write
    ├── page_management.js     # Page navigation, stream lifecycle
    ├── sensors.js             # 3D model (Three.js), quaternion stream, GPS map
    ├── calibration.js         # Accel 6-pose calibration, gyro cal, level trim
    ├── outputs_page.js        # Motor/servo pin config, aircraft type, throttle
    ├── outputs.js             # Pin configuration and output mapping
    ├── flight_modes.js        # RC channel→mode mapping, switch config
    ├── pid.js                 # PID gains (P/I/D/FF) for roll/pitch/yaw, TPA
    ├── advanced_page.js       # Filters, Mahony tuning, nav PIDs, altitude
    ├── transmitter.js         # RC receiver protocol (SBUS/ELRS), channel bars
    ├── osd.js                 # OSD element drag-drop positioning
    └── logger.js              # Real-time log console, statistics, export
```

## How to Run

Open `configurator.html` directly in a Chromium-based browser (Chrome, Edge). The Web Serial API is required — Firefox and Safari do not support it.

No build step, no server needed. Just open the HTML file.

## Application Pages

The SPA has 9 pages, navigated via the sidebar:

| Page | Module | Purpose |
|------|--------|---------|
| Sensors | `sensors.js` | 3D attitude display, GPS map, telemetry charts |
| Calibration | `calibration.js` | Accelerometer/gyroscope calibration |
| Outputs | `outputs_page.js` | Motor/servo pin assignment, aircraft type |
| Transmitter | `transmitter.js` | RC receiver protocol, channel visualization |
| Modes | `flight_modes.js` | Flight mode assignment to RC switches |
| PID | `pid.js` | PID tuning sliders for rate/angle control |
| Advanced | `advanced_page.js` | Filters, Mahony estimator, nav PIDs |
| OSD | `osd.js` | On-screen display element positioning |
| Logs | `logger.js` | Real-time serial log console |

## Architecture & Patterns

### Module Pattern
All JS files use the IIFE (Immediately Invoked Function Expression) pattern:
```javascript
(function() {
    'use strict';
    // private scope
    function privateHelper() { ... }
    // expose to global
    window.publicFunction = function() { ... };
})();
```

### Serial Communication Protocol
Communication with the ESP32 uses line-delimited JSON over serial:
- **Commands sent:** `page_name_page_data`, `start_stream`, `stop_stream`, etc.
- **Responses received:** JSON objects parsed per line
- Stream lifecycle: each page starts/stops its own data stream on navigation

### Page Lifecycle
```
changePage(target) → stopAllStreams() → sendCommand(target + '_page_data')
                                      → startPageSpecificStream(target)
```

### Global State
Configuration and telemetry state is stored in global variables defined in the `<script>` block of `configurator.html`. Modules read/write these globals.

## Coding Conventions

- **Functions:** camelCase (`connectSerial`, `handlePIDPageData`)
- **Variables:** camelCase (`throttleValue`, `selectedAircraft`)
- **CSS classes/IDs:** kebab-case (`.nav-link`, `#logLevelFilter`)
- **Documentation:** JSDoc-style with `@brief`, `@param`, `@requires`, `@returns`
- **UI language:** Turkish (all user-facing text)
- **Comments:** Turkish and English mix

## Theming

CSS custom properties in `:root` define the design system. Key variables:
- `--bg-body`, `--bg-panel`, `--bg-terminal` — background layers
- `--color-brand-blue`, `--color-success`, `--color-warning`, `--color-danger` — status colors
- `--font-sans` (Inter), `--font-mono` (JetBrains Mono) — typography

The UI uses glassmorphism (semi-transparent panels with backdrop blur).

## Hardware Target

- **ESP32** flight controller
- **Baud rate:** 115,200 bps (hardcoded)
- **Pin ranges:** GPIO 12-17 for motors/servos, configurable UART/I2C pins
- **ADC-only pins:** 34-39; **Boot pins:** 0, 2 (flagged in UI)

## Testing

No automated tests. Testing is manual with a connected ESP32 device.

## Important Notes for AI Assistants

- There is no build system — do not introduce npm, webpack, or similar tooling unless explicitly requested
- All dependencies are from CDN — do not add local copies without being asked
- The Web Serial API only works in Chromium browsers
- UI text is in Turkish — maintain this language for any user-facing strings
- The serial protocol is tightly coupled with the companion firmware (vecihi) — changes to command/response format must be coordinated
- Global state in `configurator.html` is intentional — do not refactor to a state management library without being asked
- Pin configuration and hardware limits (ADC-only pins, boot pins) reflect real ESP32 constraints
