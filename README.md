# ArduSimple GNSS RTK Desktop App

A cross-platform desktop GNSS/RTK surveying application built specifically for the ArduSimple ecosystem. Inspired by industry-standard surveying tools, this open-source application brings professional-grade RTK capabilities to your desktop (Windows, macOS, Linux).

## Overview

While excellent mobile solutions exist, desktop users using rugged field laptops or Windows tablets often lack a comprehensive, free, and open-source GNSS data collection tool tailored for ArduSimple receivers (such as the simpleRTK2B/ZED-F9P).

This application bridges that gap, offering direct serial/USB and Bluetooth connections, a built-in NTRIP client, an interactive mapping interface, and powerful surveying features like staking out points, data collection, and project management—all running natively on your desktop.

## ✨ Key Features

- **Device Connection & Management**: Connect directly to ArduSimple GNSS receivers via USB serial or Bluetooth. Displays live connection status, fix type (SINGLE/FLOAT/FIX), and satellite data.
- **Built-in NTRIP Client**: Connect to any NTRIP caster to relay RTCM corrections directly to the receiver without third-party tools.
- **NMEA Parser & Live Position**: Real-time parsing of NMEA sentences ($GPGGA, $GPRMC, etc.) to maintain a precise live position engine.
- **Project & Workspace Management**: Organize your surveys with full coordinate system support (EPSG database via `proj4js`) and local SQLite storage.
- **Interactive Map**: WebGL-powered mapping using MapLibre GL JS with offline tile support and GeoJSON layers.
- **Data Collection**: Record points, lines, and polygons with precision metrics, averaging, and customizable code libraries.
- **Stakeout Engine**: Navigate to design positions visually with proximity guidance and cut/fill measurements for DTM surfaces.
- **Import / Export**: Full support for industry formats including CSV, DXF, GeoJSON, KML, and Shapefile.

## 🛠 Tech Stack

Our application leverages a modern, highly-performant stack:

- **Core Framework**: [Tauri v2](https://v2.tauri.app/) (Rust + WebView) for lightweight, near-native performance.
- **Frontend**: [React 18](https://react.dev/) + TypeScript.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/).
- **Maps**: [MapLibre GL JS](https://maplibre.org/).
- **State Management**: [Zustand](https://github.com/pmndrs/zustand).
- **Database**: SQLite (via `tauri-plugin-sql`).
- **Hardware Communication**: Native Rust crates for Serial Port and Bluetooth I/O.

## 🚀 Installation & Setup

### Prerequisites

To build and run this application from source, you will need the following development tools installed:

1. **Node.js** (v18 or higher)
2. **Rust & Cargo** (Latest stable version)
   - Follow the [official Rust installation guide](https://www.rust-lang.org/tools/install).
3. **Tauri System Dependencies**
   - Depending on your OS (Windows, macOS, or Linux), Tauri requires specific build tools (e.g., MSVC C++ Build Tools on Windows, WebKit dependencies on Linux).
   - Please follow the official [Tauri Prerequisites Guide](https://v2.tauri.app/start/prerequisites/) for your operating system.

### Running Locally for Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ardusimple-soft.git
   cd ardusimple-soft
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   This command will compile the Rust backend and launch the frontend application in development mode with Hot-Module Replacement (HMR) enabled.
   ```bash
   npm run tauri dev
   ```

### Building for Production

To build the executable for your current platform (to use in the field without development tools):

```bash
npm run tauri build
```
The compiled binaries (e.g., `.exe` for Windows, `.dmg` for macOS, `.deb`/`AppImage` for Linux) will be located in the `src-tauri/target/release/bundle/` directory.

## ⚙️ Configuration

- **Map Layers**: The default map uses OpenStreetMap tiles. You can configure custom WMS/WMTS layers (like local cadastral or orthophoto services) in the settings menu.
- **Coordinate Systems**: The app bundles thousands of EPSG definitions. Custom `.gtx` Geoid files can be placed in the project directory for accurate orthometric height calculations.
- **NTRIP Profiles**: Configure and save your NTRIP casters safely within the app. Passwords are saved with local encryption.
- **Hardware Connection**: On the first launch, make sure to configure the correct Baud Rate (typically `115200` or `38400` for ArduSimple boards) when connecting via Serial/USB.

## 🗺 Project Roadmap

For detailed architectural decisions, implementation steps, and business goals, please review our core documentation files:
- `GNSS_RTK_Desktop_App_Plan.md` - Technical build plan for the application.
- `PLA_ACCIO_ARDUSIMPLE.md` - Action plan and market research strategy.

## 🤝 Contributing

Contributions are welcome! If you're a developer with experience in React, Rust, or GIS systems, feel free to submit pull requests.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

*(Insert License Information Here - e.g., MIT / GPLv3)*
