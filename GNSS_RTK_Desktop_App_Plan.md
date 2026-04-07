# GNSS RTK Desktop App — Complete Build Plan for AI Dev Agent

> **Project:** Cross-platform desktop GNSS/RTK surveying application inspired by Emlid Flow
> **Target platforms:** Windows 10+, macOS 12+, Linux (Ubuntu 20.04+)
> **Author context:** ArduSimple RTK hardware user
> **Goal:** Recreate all core Emlid Flow features plus desktop-first enhancements in a free, open-source desktop application

---

## Table of Contents

1. [Background & Inspiration](#1-background--inspiration)
2. [Tech Stack Decisions](#2-tech-stack-decisions)
3. [Project Architecture](#3-project-architecture)
4. [Feature Breakdown & Implementation Plan](#4-feature-breakdown--implementation-plan)
   - 4.1 Device Connection & Management
   - 4.2 NTRIP Client
   - 4.3 NMEA Parser & Live Position Engine
   - 4.4 Project & Workspace Management
   - 4.5 Coordinate System Engine
   - 4.6 Interactive Map Component
   - 4.7 Data Collection (Points, Lines, Polygons)
   - 4.8 Stakeout Engine
   - 4.9 COGO Tools
   - 4.10 Code Libraries
   - 4.11 DTM / Surface Support
   - 4.12 Import / Export
   - 4.13 Cloud Sync & Collaboration
   - 4.14 PPK / RINEX Logging
   - 4.15 Settings & Configuration
5. [Database Schema](#5-database-schema)
6. [UI/UX Layout Specification](#6-uiux-layout-specification)
7. [ArduSimple Compatibility Layer](#7-ardusimple-compatibility-layer)
8. [Directory & File Structure](#8-directory--file-structure)
9. [Phase-by-Phase Build Roadmap](#9-phase-by-phase-build-roadmap)
10. [Testing Strategy](#10-testing-strategy)
11. [Key Libraries & Crates Reference](#11-key-libraries--crates-reference)

---

## 1. Background & Inspiration

### What is Emlid Flow?
Emlid Flow is a mobile (iOS/Android) GNSS survey application for the Emlid Reach family of RTK receivers. It is the benchmark for user-friendly, full-featured RTK field software. Its core capabilities are:

- Bluetooth/Wi-Fi receiver configuration and firmware update
- NTRIP corrections relay (phone internet → receiver)
- Point, line, and polygon collection with a code library
- Point and line stakeout with visual proximity guidance
- COGO tools (inverse, traverse, offset, intersection)
- Coordinate system library (1,000+ built-in + custom)
- WMS/WMTS map layers
- DTM surface upload for cut/fill stakeout
- CSV, DXF, KML, Shapefile import/export
- Cloud sync via Emlid Flow 360

### Why a Desktop Version?
- ArduSimple receivers are used in fieldwork from a rugged laptop or connected to a tablet running Windows
- Desktop offers: larger screen, keyboard/mouse precision, direct USB/serial port access, no Android/iOS restrictions
- No existing free cross-platform desktop app combines all these features in one tool
- The application will be free and open-source, unlike Emlid Flow's paid Survey tier ($240/year)

### ArduSimple Ecosystem Context
ArduSimple produces multiband RTK GNSS receivers (simpleRTK2B, simpleRTK3B, etc.) that output standard NMEA 0183 sentences and accept RTCM corrections. They are broadly compatible with:

**Survey & Mapping:** SW Maps, QField, MicroSurvey FieldGenius, Carlson SurvPC, Mergin Maps, Mapit GIS, Locus GIS, ArcGIS Field Maps, Aplitop TcpGPS, SurvX, Surpad, GeoSpot GNSS, Arcoda Next
**3D Mapping / Photogrammetry:** 3Dsurvey RTK, Arcoda 3D Photo Survey
**NTRIP Clients:** GNSS Master, Lefebure NTRIP Client
**Agriculture:** AgOpenGPS, Field Navigator

This desktop app targets the **Survey & Mapping** and **3D Mapping** categories specifically.

---

## 2. Tech Stack Decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| App framework | **Tauri 2** (Rust + WebView) | Lightweight, native hardware access, cross-platform, ~5MB binary |
| Frontend | **React 18 + TypeScript** | Mature ecosystem, great GIS tooling |
| Styling | **Tailwind CSS** | Utility-first, consistent design |
| Map rendering | **MapLibre GL JS** | WebGL vector maps, open-source, no API key needed |
| Projections | **proj4js** | 4,000+ coordinate systems, EPSG support |
| Serial/USB | **tauri-plugin-serialport** (Rust `serialport` crate) | Native serial I/O on all 3 platforms |
| Bluetooth | **tauri-plugin-bluetooth** (Rust `btleplug` / `bluer`) | BLE/Classic Bluetooth GNSS connection |
| State management | **Zustand** | Lightweight, React-native store |
| Local database | **SQLite** via `tauri-plugin-sql` | Project storage, offline-first |
| File I/O | Tauri `fs` plugin | Read/write to disk |
| NMEA parsing | Custom Rust parser + `nmea` crate | Full NMEA 0183 support (GGA, RMC, GSA, GSV, GNS, PQTM) |
| RTCM/NTRIP | Custom Rust NTRIP client module | Send corrections, parse RTCM 3.x |
| DXF read/write | `dxf` Rust crate | CAD file support |
| Shapefile | `shapefile` Rust crate | GIS interoperability |
| KML | `kml` Rust crate | Google Earth compatibility |
| LandXML (DTM) | Custom Rust XML parser | Surface/terrain import |
| Charts | **Recharts** | Cross-section and elevation profiles |
| Build | **Vite** | Fast dev server, Tauri-compatible |

---

## 3. Project Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/TS)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │  Map View│ │ Stakeout │ │  Collect │ │  Project Manager   │ │
│  │MapLibre  │ │  Engine  │ │  Panel   │ │  COGO / Settings   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬───────────┘ │
│       └────────────┴────────────┴─────────────────┘             │
│                        Zustand Store                              │
└─────────────────────────────┬───────────────────────────────────┘
                               │ Tauri IPC Commands & Events
┌─────────────────────────────▼───────────────────────────────────┐
│                     RUST BACKEND (Tauri)                         │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐ │
│  │ Serial/USB   │  │  NTRIP Client  │  │  File I/O Engine     │ │
│  │ BT Manager   │  │  RTCM Parser   │  │  DXF/SHP/KML/CSV     │ │
│  └──────┬───────┘  └───────┬────────┘  └──────────────────────┘ │
│  ┌──────▼───────────────────▼────────────────────────────────┐  │
│  │           NMEA Parser / Position Engine                    │  │
│  │   GGA, RMC, GSA, GSV, GNS, PQTM → LiveFix struct         │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                               │                                   │
│  ┌────────────────────────────▼────────────────────────────────┐ │
│  │              SQLite Database (tauri-plugin-sql)              │ │
│  │  projects | points | lines | polygons | codesystems | ...   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Physical Hardware   │
                    │  ArduSimple RTK via  │
                    │  USB Serial / BT     │
                    └─────────────────────┘
```

---

## 4. Feature Breakdown & Implementation Plan

---

### 4.1 Device Connection & Management

**What it does:** Discover, connect, and configure GNSS receivers over USB serial or Bluetooth. Display live connection status.

**Emlid Flow equivalent:** ReachView 3 device panel — connect to Reach over Wi-Fi or Bluetooth, update firmware, configure RTK/PPK.

**Implementation steps:**

1. **Serial port scanner** — Rust command `list_serial_ports()` → returns Vec of port name + description. Frontend polls on startup and on USB plug events.
2. **Auto-detection** — Check device description for known strings: `u-blox`, `CP210x`, `simpleRTK`, `ZED-F9P`. Mark as "GNSS device".
3. **Connection command** — `connect_serial(port, baud_rate)` — opens port, starts NMEA reader thread, emits `nmea_sentence` events to frontend.
4. **Bluetooth scanner** — `scan_bluetooth()` → returns nearby BT devices. Filter by name patterns (ArduSimple, Reach, etc.). `connect_bluetooth(addr)` → same NMEA stream.
5. **Device status panel** — Frontend component showing: device name, fix type (SINGLE/FLOAT/FIX), satellite count, HDOP, age of corrections.
6. **u-blox UBX configuration** — Optional: send UBX-CFG messages to configure output rate, enable NMEA sentences. Use `ublox` Rust crate.
7. **Connection persistence** — Store last used port/device in SQLite settings table.

**Key Tauri commands:**
```rust
#[tauri::command]
async fn list_serial_ports() -> Vec<PortInfo>

#[tauri::command]
async fn connect_serial(port: String, baud: u32) -> Result<()>

#[tauri::command]
async fn disconnect() -> Result<()>

#[tauri::command]
async fn scan_bluetooth() -> Vec<BTDevice>

#[tauri::command]
async fn connect_bluetooth(addr: String) -> Result<()>
```

**Tauri events emitted:**
```
nmea_sentence    { raw: String }
fix_update       { lat, lon, alt, fix_type, hdop, sats, age_of_corr }
connection_state { state: "connected" | "disconnected" | "error" }
```

---

### 4.2 NTRIP Client

**What it does:** Connect to an NTRIP caster (e.g., EUREF-IP, regional RTK network, Emlid Caster) and relay RTCM correction data to the connected GNSS receiver via serial/Bluetooth.

**Emlid Flow equivalent:** Built-in NTRIP client — enter host/port/mountpoint/user/pass, phone internet → Reach via Bluetooth.

**Implementation steps:**

1. **NTRIP Caster connection** — Rust HTTP/TCP client connecting to `ntrip://host:port`. Send `GET /mountpoint HTTP/1.1` with Basic Auth header.
2. **GGA string injection** — Periodically send current position as NMEA GGA string to caster (required by VRS networks).
3. **RTCM relay** — Pipe raw bytes from TCP socket directly to serial port or BT connection (no parsing needed on relay path).
4. **Sourcetable fetch** — `fetch_sourcetable(host, port)` → parse NTRIP sourcetable, return list of mountpoints with descriptions.
5. **Profile storage** — Store NTRIP profiles (name, host, port, mountpoint, user, password) in SQLite. Password stored encrypted.
6. **Status display** — Show: connected/disconnected, bytes received per second, correction age, RTK fix status (FLOAT/FIX).
7. **Auto-reconnect** — If connection drops, retry with exponential backoff.

**NTRIP Profile UI fields:**
- Profile name
- Caster host (URL or IP)
- Port (default 2101)
- Mountpoint (dropdown from sourcetable)
- Username / Password
- Send GGA position: Yes/No
- GGA interval: 5s / 10s / 30s

**Key Tauri commands:**
```rust
#[tauri::command]
async fn ntrip_connect(profile: NtripProfile) -> Result<()>

#[tauri::command]
async fn ntrip_disconnect() -> Result<()>

#[tauri::command]
async fn ntrip_fetch_sourcetable(host: String, port: u16) -> Result<Vec<Mountpoint>>
```

---

### 4.3 NMEA Parser & Live Position Engine

**What it does:** Parse all incoming NMEA 0183 sentences, maintain a live position fix state, and emit clean `LiveFix` structs to the frontend.

**NMEA sentences to parse:**

| Sentence | Content |
|----------|---------|
| $GPGGA / $GNGGA | Position, fix quality, altitude, HDOP, age of diff |
| $GPRMC / $GNRMC | Position, speed, course |
| $GPGSA / $GNGSA | Fix mode, PRNs used, PDOP/HDOP/VDOP |
| $GPGSV / $GNGSV | Satellites in view (SNR, elevation, azimuth) |
| $GPVTG | Track made good, speed over ground |
| $GPHDT | Heading (dual-antenna) |
| PQTM* | u-blox proprietary (RTK status) |

**LiveFix struct:**
```rust
pub struct LiveFix {
    pub timestamp: DateTime<Utc>,
    pub latitude: f64,          // decimal degrees WGS84
    pub longitude: f64,
    pub altitude_m: f64,        // ellipsoidal height
    pub fix_type: FixType,      // NoFix, Single, DGPS, Float, Fixed, PPK
    pub hdop: f32,
    pub pdop: f32,
    pub satellites_used: u8,
    pub satellites_in_view: Vec<SatInfo>,
    pub speed_kmh: f32,
    pub course_deg: f32,
    pub age_of_corrections_s: f32,
    pub baseline_length_m: Option<f32>,
}
```

**Position accuracy estimation:**
- Fixed RTK: ±1–2 cm → show green indicator
- Float RTK: ±10–30 cm → show yellow indicator
- DGPS: ±50 cm → show orange indicator
- Single: ±1–5 m → show red indicator

---

### 4.4 Project & Workspace Management

**What it does:** Create, open, save, delete projects. Each project has a coordinate system, code library, and contains all collected data.

**Emlid Flow equivalent:** Projects tab — create project, set coordinate system, link code library.

**Implementation steps:**

1. **New Project wizard** (3-step modal):
   - Step 1: Name, description, operator name
   - Step 2: Select coordinate system (search/browse from library)
   - Step 3: Select or create code library
2. **Project list view** — Card grid showing project name, date, point count, last modified. Sort/filter options.
3. **Recent projects** — Last 5 projects on home screen.
4. **Project folder** — Each project stored as a folder: `projects/{uuid}/project.db` (SQLite), `projects/{uuid}/layers/`, `projects/{uuid}/exports/`.
5. **Backup/Archive** — Export entire project as `.zip` archive.
6. **Import project** — Drag-and-drop `.zip` or open dialog.
7. **Multi-project** — Allow multiple projects open simultaneously in tabs (desktop advantage over mobile).

---

### 4.5 Coordinate System Engine

**What it does:** Transform between WGS84 (from GNSS) and the project's local coordinate system (e.g., national grids, UTM zones, custom projections).

**Emlid Flow equivalent:** Built-in library of 1,000+ coordinate systems, custom CS wizard.

**Implementation steps:**

1. **EPSG database** — Bundle `proj4js` + full EPSG dataset. Pre-load definitions for common systems. Support searching by: EPSG code, country, name.
2. **CS selection UI** — Search box + country filter. Grouped list: International (UTM), National (e.g., RGF93 / Lambert-93), Custom. Preview: projection type, datum, unit.
3. **Geoid model support** — Store geoid grid files (.gtx format from NGS/IGN). Apply geoid undulation to convert ellipsoidal height → orthometric height.
   - Built-in geoids: EGM96, EGM2008 global (coarse)
   - Importable regional geoids: e.g., GEOID18 (USA), RAF20 (France)
4. **Custom CS wizard:**
   - Step 1: Datum (WGS84, ETRS89, NAD83, etc.)
   - Step 2: Transformation (7-parameter Helmert or grid shift)
   - Step 3: Projection (Transverse Mercator, Lambert Conic, UTM, etc.) with parameters
   - Step 4: Vertical datum / Geoid
5. **Localization (site calibration)** — Compute local transformation from measured control points with known local coordinates. Uses least-squares adjustment.
6. **Transform pipeline:**
   ```
   GNSS WGS84 (lat/lon/h) → Datum transform → Projection → Easting/Northing/Elevation
   ```

**Key library calls:**
```typescript
import proj4 from 'proj4';
proj4.defs('EPSG:2154', '+proj=lcc +lat_1=49 +lat_2=44 ...');
const [E, N] = proj4('EPSG:4326', 'EPSG:2154', [lon, lat]);
```

---

### 4.6 Interactive Map Component

**What it does:** Full-screen map with real-time rover position, collected data overlay, layer management, and touch/mouse navigation.

**Emlid Flow equivalent:** Main map screen with satellite/standard layers, collected points/lines, rover position indicator.

**Implementation steps:**

1. **MapLibre GL JS setup** — Initialize with free basemaps:
   - OpenStreetMap tiles (raster)
   - ESRI World Imagery (satellite, free with attribution)
   - Custom tile URLs
2. **Rover position indicator** — Animated dot with heading arrow. Color-coded by fix type (green=FIX, yellow=FLOAT, orange=DGPS, red=SINGLE).
3. **Base station indicator** — If base set up locally, show fixed diamond marker.
4. **Collected data overlay** — GeoJSON layers for:
   - Points: circle markers colored by code
   - Lines: stroked polylines
   - Polygons: filled with outline
5. **WMS/WMTS layers** — Allow adding external WMS/WMTS sources (cadastral maps, topo maps, orthophotos). Layer manager panel.
6. **Map controls:**
   - Zoom to fit all data
   - Follow rover toggle (auto-pan to rover position)
   - North-up / heading-up toggle
   - Scale bar
   - Coordinate display (click to copy)
7. **Background map cache** — Cache tiles for offline use (important for field work).
8. **Import file overlay** — Display imported DXF/KML/SHP as reference layer.

---

### 4.7 Data Collection (Points, Lines, Polygons)

**What it does:** Record precise positions with attributes, codes, descriptions, and photos. Support auto-collection.

**Emlid Flow equivalent:** Survey tab — collect point, collect line/polygon, assign code, write description.

#### 4.7.1 Point Collection

**Fields per point:**
- ID (auto-increment)
- Name (editable)
- Code (from code library)
- Description (free text)
- Easting, Northing, Elevation (in project CS)
- Latitude, Longitude, Height (WGS84)
- Fix type at collection time
- HDOP, number of satellites
- Timestamp
- Photo(s) (file path)
- Note

**Collection modes:**
- **Single shot** — Collect current fix immediately
- **Average** — Average N readings over T seconds. Show running mean ± StdDev
- **Auto-collect** — Collect every N seconds or every N meters of movement
- **Tilt compensation** — If using a tilt-compensating receiver (e.g., RS3), apply tilt offset

**UI flow:**
1. Tap "Collect Point" button (or keyboard shortcut `C`)
2. Panel slides up: pre-filled with code from last point, name auto-incremented
3. Averaging progress bar (configurable 1–60 s)
4. Confirm → point added to map and list

#### 4.7.2 Line Collection

- Start line → collect vertices by tapping collect or automatic interval
- Lines can be open (polyline) or closed (polygon)
- Code applies to entire line
- Display line with vertex nodes on map
- Real-time length/area display
- Close polygon button

#### 4.7.3 Polygon Collection

- Same as line but auto-closes on "Close" button
- Show area in real-time (in project CS units)
- Fill preview on map

---

### 4.8 Stakeout Engine

**What it does:** Navigate a rover to a design position. Show visual proximity guides, distances, and directional indicators.

**Emlid Flow equivalent:** Stakeout tab with point stakeout, line stakeout, DTM stakeout.

#### 4.8.1 Point Stakeout

**UI components:**
1. **Point selector** — Search/filter collected or imported points
2. **Far-field view (>1m):** Large arrow pointing toward target + cardinal direction (N/S/E/W). Shows: horizontal distance, vertical difference.
3. **Near-field view (<1m):** Cross-hair with target center. Current position dot. Shows ΔE, ΔN, ΔZ in cm.
4. **Stake confirmation** — When within tolerance (configurable: 1cm / 2cm / 5cm), vibrate/sound + "STAKE" button. Records as-staked point.
5. **Stakeout report** — List of design vs. as-staked with delta values.

#### 4.8.2 Line Stakeout

- Select line from project
- Display: distance from line (perpendicular), distance along line (chainage/station)
- **Offset stakeout** — Stake at defined perpendicular offset (e.g., +2.0m right of center line)
- **Interval stakeout** — Auto-suggest staking points at fixed intervals (e.g., every 10m)
- Near-field: switch to alignment mode with left/right/forward guidance

#### 4.8.3 DTM / Surface Stakeout

- Load DTM (LandXML format)
- Show design elevation at current position
- Display: design elevation, measured elevation, **cut** (need to remove) / **fill** (need to add) in meters
- Color-coded cut/fill on map (red = cut, blue = fill)
- Cross-section profile view

---

### 4.9 COGO Tools

**What it does:** Coordinate geometry calculations used in surveying.

**Emlid Flow equivalent:** COGO tools — inverse, traverse, offset point, intersection.

#### Tools to implement:

**Inverse (Distance & Bearing)**
- Input: two points (pick from map or enter coordinates)
- Output: horizontal distance, slope distance, azimuth, zenith angle, ΔE, ΔN, ΔZ

**Radiation (Traverse / Polar)**
- Input: known point + bearing + horizontal distance + vertical angle
- Output: new point coordinates

**Offset Point**
- Input: point + bearing + perpendicular offset distance + forward offset distance
- Output: offset point coordinates. Option to store as new point.

**Intersection**
- Two-bearing intersection: two known points + two bearings → intersection point
- Bearing-distance intersection: point + bearing + distance from another point
- Two-distance intersection: two known points + two distances → two possible intersection points

**Area Calculation**
- Select polygon from project or digitize on map
- Output: area (m², ft², hectares, acres), perimeter

**Traverse Closure**
- Input: list of bearings + distances
- Output: closure error, precision ratio

---

### 4.10 Code Libraries

**What it does:** Predefined feature codes assigned to collected points/lines for automated symbology and classification.

**Emlid Flow equivalent:** Code library manager — 100+ built-in codes, custom library, import/export.

**Code structure:**
```typescript
interface Code {
  id: string;
  name: string;          // e.g., "TREE"
  description: string;   // e.g., "Tree - isolated"
  type: "point" | "line" | "polygon";
  color: string;         // hex
  icon?: string;         // SVG or emoji
  attributes: Attribute[]; // custom fields to collect per feature
}
```

**Built-in code categories (100+ codes):**
- Boundary: BNDRY, FENCE, HEDGE, WALL
- Buildings: BLDG, DOOR, WINDOW, CORNER
- Infrastructure: RD, RDEDGE, CURB, RAIL, PIPE, POLE, VALVE
- Vegetation: TREE, SHRUB, GRASS
- Water: STREAM, POND, DITCH, DRAIN
- Survey: CP (control point), BM (benchmark), STATION
- Topography: CONT (contour), SPOT (spot elevation), BREAK

**Code library management:**
- Create custom library
- Import from CSV (code, description, type, color)
- Export to CSV
- Assign library to project
- On-the-fly code creation during collection

---

### 4.11 DTM / Surface Support

**What it does:** Import digital terrain models, display as 3D surface, use for cut/fill stakeout.

**Input formats:**
- LandXML (.xml) — industry standard triangulation network (TIN)
- CSV with X, Y, Z
- ASCII grid (.asc)
- GeoTIFF DEM (via GDAL binding)

**Implementation steps:**
1. **LandXML parser** (Rust, custom) — Parse `<Surface>` → `<TIN>` → `<Faces>` triangles
2. **TIN renderer** — Render as WebGL mesh overlay on MapLibre map with color gradient by elevation
3. **Z-interpolation** — For any (E, N) point, find containing triangle and interpolate Z using barycentric coordinates. This is the core of cut/fill stakeout.
4. **Contour generation** — Generate contour lines from TIN at configurable interval (e.g., 0.5m, 1m)
5. **Volume calculation** — Prismatic volume between existing TIN and design TIN (cut/fill volumes)

---

### 4.12 Import / Export

**What it does:** Exchange data with CAD, GIS, and office software.

#### Import formats:
| Format | Content | Library |
|--------|---------|---------|
| CSV | Points (name, E, N, Z, code, desc) | Custom Rust CSV parser |
| DXF | Points, lines, polylines, polygons | `dxf` Rust crate |
| KML/KMZ | Points, lines, polygons | `kml` Rust crate |
| Shapefile (.shp) | GIS features | `shapefile` Rust crate |
| LandXML (.xml) | TIN surface, alignment, points | Custom Rust XML parser |
| GeoJSON | All feature types | `geojson` Rust crate |

#### Export formats:
| Format | Content |
|--------|---------|
| CSV | Points with all attributes + CS coordinates |
| DXF (AutoCAD) | Points as POINT entities, lines as POLYLINE, codes as LAYER names |
| KML | Points, lines, polygons for Google Earth |
| Shapefile | GIS output with attribute table |
| GeoJSON | Web GIS compatible |
| PDF Report | Stakeout report, point list with statistics |
| RINEX | Raw observation data for PPK (from receiver log) |

**CSV column template for import:**
```
Name, Easting, Northing, Elevation, Code, Description, [Lat, Lon optional]
```

**DXF export rules:**
- Each code = one DXF layer
- Layer color = code color
- Points → `POINT` entity + `TEXT` annotation
- Lines → `LWPOLYLINE` entity
- Polygons → closed `LWPOLYLINE`

---

### 4.13 Cloud Sync & Collaboration

**What it does:** Optional cloud sync to allow team collaboration and office-field workflow.

**Emlid Flow equivalent:** Emlid Flow 360 — web platform, team of 10 free, project sync.

**Architecture:**

Option A (self-hosted): Deploy a lightweight REST API (Rust/Actix or Node/Fastify) + PostgreSQL to a VPS or local server.
Option B (managed): Use Supabase (free tier) — PostgreSQL + realtime sync + auth + storage.

**Recommendation: Supabase** for simplest implementation.

**Sync entities:**
- Projects (metadata)
- Points, Lines, Polygons
- Code libraries
- NTRIP profiles (sans password)

**Conflict resolution:** Last-write-wins with timestamp. Show conflict alert in UI if same record modified on two devices.

**Team features:**
- Invite team members by email
- Role: Owner, Editor, Viewer
- Project sharing with permission level
- Activity log

---

### 4.14 PPK / RINEX Logging

**What it does:** Log raw GNSS observations for post-processed kinematic (PPK) solution.

**Emlid Flow equivalent:** Reach M2/RS2 raw data logging in RINEX format for post-processing with Emlid Studio or RTKLIB.

**Implementation:**
1. **RTCM/UBX raw logging** — When receiver outputs UBX-RXM-RAWX (u-blox), log binary to file.
2. **RINEX converter** — Convert UBX binary to RINEX 3.x observation file using `rtklib` binaries bundled with the app (CONVBIN).
3. **RTKLIB integration** — Bundle RTKLIB command-line tools (`rnx2rtkp`, `convbin`) and provide a GUI wrapper:
   - Select rover RINEX + base RINEX (or CORS download)
   - Set processing options (Kinematic/Static, elevation mask, filter settings)
   - Run processing → output NMEA or positional CSV
4. **CORS data downloader** — GUI to download base station RINEX from CORS networks (NOAA, IGN, etc.) by entering station ID + date.

---

### 4.15 Settings & Configuration

**Application settings:**
- Language (i18n support: EN, FR, ES, DE, PT)
- Units: metric / imperial
- Coordinate display format: decimal degrees / DMS / grid
- Elevation reference: ellipsoidal / orthometric
- Default tolerance for stakeout (cm)
- Auto-save interval
- Map default zoom level
- Tile cache size limit
- Connection auto-reconnect settings
- Keyboard shortcuts editor

**Receiver settings panel** (if u-blox ZED-F9P detected):
- NMEA output rate (1Hz / 5Hz / 10Hz)
- Enable/disable specific NMEA sentences
- RTK correction input source
- Base mode: average / fixed position
- Elevation mask angle
- SBAS enable/disable

---

## 5. Database Schema

```sql
-- Projects
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    operator TEXT,
    created_at DATETIME,
    modified_at DATETIME,
    cs_epsg INTEGER,
    cs_custom_def TEXT,  -- proj4 string for custom CS
    geoid_file TEXT,
    code_library_id TEXT
);

-- Collected Points
CREATE TABLE points (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    name TEXT,
    code TEXT,
    description TEXT,
    easting REAL, northing REAL, elevation REAL,
    latitude REAL, longitude REAL, height REAL,
    fix_type TEXT,
    hdop REAL, sats_used INTEGER,
    collected_at DATETIME,
    photos TEXT,  -- JSON array of file paths
    note TEXT,
    is_staked INTEGER DEFAULT 0,
    staked_e REAL, staked_n REAL, staked_z REAL,
    staked_at DATETIME
);

-- Lines
CREATE TABLE lines (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    name TEXT,
    code TEXT,
    description TEXT,
    vertices TEXT,  -- JSON array of {e,n,z,lat,lon,h,fix,ts}
    is_closed INTEGER DEFAULT 0,
    created_at DATETIME
);

-- Polygons
CREATE TABLE polygons (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    name TEXT,
    code TEXT,
    description TEXT,
    vertices TEXT,  -- JSON array
    area REAL,
    created_at DATETIME
);

-- Code Libraries
CREATE TABLE code_libraries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    codes TEXT NOT NULL  -- JSON array of Code objects
);

-- NTRIP Profiles
CREATE TABLE ntrip_profiles (
    id TEXT PRIMARY KEY,
    name TEXT,
    host TEXT,
    port INTEGER,
    mountpoint TEXT,
    username TEXT,
    password TEXT,  -- encrypted with AES-256
    send_gga INTEGER DEFAULT 1,
    gga_interval INTEGER DEFAULT 10
);

-- App Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Surfaces / DTMs
CREATE TABLE surfaces (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    name TEXT,
    format TEXT,
    file_path TEXT,
    bounds TEXT  -- JSON {minE, maxE, minN, maxN}
);
```

---

## 6. UI/UX Layout Specification

### Main Window Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ [≡] AppName     [Project: MyProject ▼]    [Fix: RTK FIX ●]  [⚙]  │  ← Top bar
├──────┬─────────────────────────────────────────────────────────────┤
│      │                                                             │
│ Nav  │                  MAP VIEW                                   │
│ Bar  │              (MapLibre GL JS)                               │
│      │                                                             │
│ [🗺] │         ·  collected points                                 │
│ Map  │         —  collected lines                                  │
│      │         ◉  rover position                                   │
│ [📍] │                                                             │
│Coll. │                                                             │
│      │                                                             │
│ [🎯] │                                                             │
│Stake │                                                             │
│      ├──────────────────────────────────────────────────────────── │
│ [📐] │ [Satellite ▼] [Layers] [Follow ⬤] [Fit] │ 51.123°N 2.456°E │  ← Map toolbar
│ COGO │                                                             │
│      │                                                             │
│ [📂] ├──────────────────────── BOTTOM PANEL ─────────────────────  │
│Proj. │ Lat: 51.1234567°  Lon: 2.4567890°  Alt: 12.34m             │
│      │ Fix: RTK FIX   Sats: 24   HDOP: 0.6   Age: 1.2s           │
│ [📡] └─────────────────────────────────────────────────────────────┘
│NTRIP
└──────┘
```

### Collection Panel (slides in from right)

```
┌─────────────────────────────────┐
│  Collect Point          [×]     │
├─────────────────────────────────┤
│  Name:   [TP-042         ]      │
│  Code:   [TREE         ▼]       │
│  Desc:   [Large oak tree ]      │
│                                  │
│  ┌──────────────────────────┐   │
│  │  Averaging: ████░░░░ 8s  │   │
│  │  Points: 8/20            │   │
│  │  σH: 0.8cm  σV: 1.2cm   │   │
│  └──────────────────────────┘   │
│                                  │
│  E: 654321.456  N: 123456.789   │
│  Z: 12.340m  [Ellips/Ortho ▼]  │
│                                  │
│  [📷 Add Photo]                  │
│                                  │
│  [    COLLECT POINT    ]         │
└─────────────────────────────────┘
```

### Stakeout Screen

```
┌─────────────────────────────────┐
│  Stakeout: TP-001       [×]     │
├─────────────────────────────────┤
│  Design: E 654320.00            │
│          N 123455.00            │
│          Z 11.500m              │
├─────────────────────────────────┤
│                                  │
│          ↑  3.45m               │
│        ←   ●   → 2.12m         │
│             ↑                   │
│                                  │
│  ΔE: +2.12m   ΔN: -3.45m       │
│  ΔZ: +0.84m   Dist: 4.06m      │
│                                  │
│  [  NEAR FIELD MODE  ]          │
└─────────────────────────────────┘
```

---

## 7. ArduSimple Compatibility Layer

The app must be fully compatible with the complete ArduSimple product catalog. Below is every product family, the underlying GNSS chipset, its communication interfaces, and any special handling required.

---

### 7.1 Complete ArduSimple Hardware Matrix

#### simpleRTK2B Family (u-blox ZED-F9P)

| Product | Chipset | Interfaces | Notes |
|---------|---------|-----------|-------|
| simpleRTK2B Budget | ZED-F9P | USB-C (FTDI), UART1, UART2, XBee socket | Entry-level, most common |
| simpleRTK2B Basic | ZED-F9P | USB-C (FTDI), XBee socket | IP67 version available |
| simpleRTK2B Pro | ZED-F9P | USB-C, UART1/2, XBee, SPI, I2C | Full GPIO exposure |
| simpleRTK2B Lite | ZED-F9P | USB-C only (CP210x) | Ultra-compact form factor |
| simpleRTK2B Fusion | ZED-F9R | USB-C, UART, XBee | IMU-integrated, dead reckoning |
| simpleRTK2B-SBC | ZED-F9P | USB-C + RPi/SBC header | Single-board computer integration |
| simpleRTK2B Heading | ZED-F9P × 2 | USB-C, UART | Dual-antenna heading (moving baseline) |

#### simpleRTK3B Family (Unicore / Septentrio)

| Product | Chipset | Interfaces | Notes |
|---------|---------|-----------|-------|
| simpleRTK3B Compass | Unicore UM982 | USB-C, UART | Dual-antenna heading + RTK position |
| simpleRTK3B Micro Unicore | UM980/UM981/UM982 | UART, compact PCB | Embedded/OEM form factor |
| simpleRTK3B Mosaic | Septentrio Mosaic-X5 | USB-C, Ethernet, UART | All-constellation, high-grade |
| simpleRTK3B Mosaic-H | Septentrio Mosaic-H | USB-C, UART | Dual-antenna heading variant |
| simpleRTK3B Mosaic-G5 P3 | Septentrio Mosaic-G5 P3 | USB-C, UART | Triple-band, PPP-RTK |

#### simpleRTK4 Family (u-blox ZED-X20P)

| Product | Chipset | Interfaces | Notes |
|---------|---------|-----------|-------|
| simpleRTK4 Basic Starter Kit | ZED-X20P | USB-C, UART, XBee | Latest u-blox, L1/L2/L5 |
| simpleRTK4 Pro | ZED-X20P | Full I/O header | Triple-band RTK |

#### simpleGNSS Family (standalone receivers)

| Product | Chipset | Interfaces | Notes |
|---------|---------|-----------|-------|
| simpleGNSS Pro | u-blox (L1/L5) | USB-C | Sub-meter, 10Hz |
| simpleGNSS Timing | u-blox (L1/L5) | USB-C | Nanosecond PPS, RAW data |
| simpleGNSS Standard | u-blox (L1) | USB | Entry GNSS |

#### RTK Kits (complete ready-to-use solutions)

| Product | Base chipset | Communication | Notes |
|---------|-------------|---------------|-------|
| RTK Portable Bluetooth Kit | ZED-F9P | Bluetooth SPP | Lightest kit, BT to phone/laptop |
| RTK Basic Starter Kit | ZED-F9P | USB-C | Wired connection |
| RTK Long Range Starter Kit | ZED-F9P | LoRa 868/915 MHz (XBee) | Up to 10km base-rover |
| RTK Handheld Surveyor Kit | ZED-F9P | Bluetooth + USB | Complete field survey kit |
| RTK Handheld 2 Mapping Kit | ZED-F9P | Bluetooth + USB | Updated handheld survey kit |
| RTK Calibrated Surveyor Kit | ZED-F9P | Bluetooth + USB | Pre-calibrated, survey-grade |

#### XBee Communication Plugins (add-ons for XBee socket)

| Plugin | Function | Protocol |
|--------|----------|---------|
| Bluetooth module | BT SPP wireless connection | Bluetooth Classic SPP, 115200 baud |
| LoRa radio module (868 MHz) | Long-range base-rover corrections | LoRa, proprietary or RTCM |
| LoRa radio module (915 MHz) | North America version | LoRa |
| Wi-Fi module | NTRIP over Wi-Fi | TCP/IP, 115200 baud |
| NTRIP module (LTE/4G) | NTRIP client built into XBee slot | Cellular, auto-NTRIP |
| SiK radio | Medium range (≤2km) | MAVLink / RTCM |

---

### 7.2 USB/Serial Auto-Detection

The app must identify ArduSimple hardware from USB descriptors:

```rust
// Known USB VID/PID combinations for ArduSimple boards
const ARDUSIMPLE_USB_IDS: &[(&str, &str, &str)] = &[
    // u-blox native USB (ZED-F9P, ZED-F9R, ZED-X20P)
    ("1546", "01A8", "u-blox ZED-F9P"),
    ("1546", "01A9", "u-blox ZED-F9R (Fusion)"),
    ("1546", "01B0", "u-blox ZED-X20P"),
    // Silicon Labs CP210x (simpleRTK2B Lite, some kits)
    ("10C4", "EA60", "ArduSimple (CP210x)"),
    // FTDI FT232 (simpleRTK2B Budget/Pro/Basic)
    ("0403", "6001", "ArduSimple (FTDI FT232R)"),
    ("0403", "6010", "ArduSimple (FTDI FT2232H)"),
    // Unicore UM982 (simpleRTK3B Compass)
    ("1A86", "7523", "ArduSimple simpleRTK3B (CH340)"),
    // Septentrio Mosaic
    ("152A", "8A20", "Septentrio Mosaic"),
];
```

**Detection logic:**
1. Scan all serial ports on app start and on USB plug event (via OS device events)
2. Match USB VID/PID → assign device name and chipset type
3. Unknown VID/PID → show as "Unknown GNSS device" with manual baud selection

---

### 7.3 Per-Chipset NMEA Configuration

Each chipset family outputs different sentence sets. The app must handle all of them:

| Chipset | Default sentences | Raw data format | Proprietary sentences |
|---------|------------------|-----------------|----------------------|
| u-blox ZED-F9P | GGA, RMC, GSA, GSV | UBX-RXM-RAWX | UBX-NAV-PVT, UBX-NAV-STATUS |
| u-blox ZED-F9R | Same + attitude | UBX-RXM-RAWX | UBX-ESF-* (IMU fusion) |
| u-blox ZED-X20P | GGA, RMC, GSA, GSV, GNS | UBX-RXM-RAWX | UBX-NAV-* |
| Unicore UM982 | GGA, RMC, GSA, PQTM | RTCM raw | PQTMINS (heading) |
| Septentrio Mosaic | GGA, RMC, GSA, PASHR | SBF binary | $PASHR (heading, roll, pitch) |
| simpleGNSS | GGA, RMC, VTG | UBX | Standard |

**Heading sentences to parse:**
- `$GPHDT` — Heading True (standard)
- `$PASHR` — Septentrio heading, roll, pitch, heave
- `$PQTMINS` — Unicore UM982 INS data including heading
- `$UBX-NAV-RELPOSNED` — u-blox dual-antenna relative position heading

---

### 7.4 Baud Rate Defaults by Device

```rust
fn default_baud_for_device(chipset: &ChipsetType) -> u32 {
    match chipset {
        ChipsetType::UbloxF9P => 115200,
        ChipsetType::UbloxF9R => 115200,
        ChipsetType::UbloxX20P => 115200,
        ChipsetType::UnicoreUM982 => 115200,
        ChipsetType::SeptentrioMosaic => 115200,
        ChipsetType::Unknown => 9600,  // safe fallback
    }
}

// User-selectable baud rates in UI:
const BAUD_OPTIONS: &[u32] = &[4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800];
```

---

### 7.5 Dual-Port Handling (UART1 + UART2)

Many ArduSimple boards expose two serial ports via USB or physical headers:

- **UART1**: NMEA output (position data to app) + RTCM input (corrections from NTRIP)
- **UART2**: Radio/LoRa corrections relay (if using XBee radio module)

**App behavior:**
- Allow selecting two ports simultaneously: "Primary (NMEA/RTCM)" + "Radio relay (UART2)"
- When LoRa kit detected: NTRIP relay goes to UART2 automatically, UART1 stays clean for NMEA
- Shared `Mutex<SerialPort>` for UART1 to safely interleave NMEA reads and RTCM writes

---

### 7.6 IMU / Dead Reckoning (ZED-F9R specific)

For simpleRTK2B Fusion (ZED-F9R):
- Parse `UBX-ESF-STATUS` → show IMU calibration status in UI
- Parse `UBX-NAV-ATT` → display roll, pitch, heading
- Show "Dead Reckoning active" badge when fix lost but position estimated from IMU
- Tilt compensation for pole-mounted surveys: parse tilt + azimuth, apply to collected point

---

### 7.7 Dual-Antenna Heading (simpleRTK3B Compass / Heading)

For dual-antenna setups:
- Parse `$PQTMINS` (Unicore) or `UBX-NAV-RELPOSNED` (u-blox) for heading angle
- Display heading arrow on rover marker on map
- Use heading for automatic tilt pole compensation when pole is not vertical
- Store heading at time of collection alongside each point

---

### 7.8 Septentrio Mosaic Support

For simpleRTK3B Mosaic variants (premium hardware):
- Parse SBF (Septentrio Binary Format) if enabled, or standard NMEA
- Parse `$PASHR` for roll/pitch/heading/heave
- Support Septentrio SBAS and PPP-RTK modes
- Show "PPP-RTK" fix type badge in UI (different from standard RTK FIX)

---

### 7.9 Quick Connect Profiles

The Device panel should have a "Quick Connect" section with one-click presets:

| Button label | Port | Baud | Expected device |
|-------------|------|------|----------------|
| ArduSimple USB | Auto-detect | 115200 | Any ArduSimple board |
| ArduSimple BT | Bluetooth scan | 115200 | RTK BT Kit / BT module |
| simpleRTK3B Compass | Auto-detect | 115200 | UM982 heading board |
| Mosaic | Auto-detect | 115200 | Septentrio boards |
| Custom... | User input | User input | Any GNSS device |

---

## 8. Directory & File Structure

```
gnss-rtk-desktop/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── device.rs        # Serial/BT connection commands
│       │   ├── ntrip.rs         # NTRIP client commands
│       │   ├── project.rs       # Project CRUD
│       │   ├── survey.rs        # Collect/stakeout commands
│       │   ├── export.rs        # File export commands
│       │   └── settings.rs
│       ├── parser/
│       │   ├── nmea.rs          # NMEA sentence parsers
│       │   ├── rtcm.rs          # RTCM frame detection
│       │   └── landxml.rs       # DTM parser
│       ├── engine/
│       │   ├── position.rs      # Live fix state machine
│       │   ├── stakeout.rs      # Stakeout calculations
│       │   ├── cogo.rs          # COGO computations
│       │   └── tin.rs           # TIN interpolation engine
│       ├── export/
│       │   ├── dxf.rs
│       │   ├── kml.rs
│       │   ├── shapefile.rs
│       │   └── csv.rs
│       └── db.rs                # SQLite queries
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── store/
│   │   ├── useProjectStore.ts
│   │   ├── useDeviceStore.ts
│   │   ├── useMapStore.ts
│   │   └── useSurveyStore.ts
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── RoverMarker.tsx
│   │   │   ├── DataLayers.tsx
│   │   │   └── LayerManager.tsx
│   │   ├── collect/
│   │   │   ├── CollectPanel.tsx
│   │   │   ├── AveragingProgress.tsx
│   │   │   └── CodePicker.tsx
│   │   ├── stakeout/
│   │   │   ├── StakeoutPanel.tsx
│   │   │   ├── FarField.tsx
│   │   │   ├── NearField.tsx
│   │   │   └── LineStakeout.tsx
│   │   ├── cogo/
│   │   │   ├── CogoPanel.tsx
│   │   │   ├── InverseTool.tsx
│   │   │   ├── RadiationTool.tsx
│   │   │   └── IntersectionTool.tsx
│   │   ├── device/
│   │   │   ├── DevicePanel.tsx
│   │   │   ├── PortScanner.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── ntrip/
│   │   │   ├── NtripPanel.tsx
│   │   │   └── ProfileManager.tsx
│   │   ├── project/
│   │   │   ├── ProjectList.tsx
│   │   │   ├── NewProjectWizard.tsx
│   │   │   ├── CsSelector.tsx
│   │   │   └── CodeLibraryManager.tsx
│   │   └── shared/
│   │       ├── Modal.tsx
│   │       ├── Tooltip.tsx
│   │       └── CoordDisplay.tsx
│   ├── lib/
│   │   ├── proj4setup.ts        # Coordinate system initialization
│   │   ├── nmea-listener.ts     # Tauri event listeners
│   │   ├── cogo.ts              # COGO math in TS (mirror of Rust)
│   │   └── formats.ts           # Number/coordinate formatting
│   └── styles/
│       └── globals.css
│
├── assets/
│   ├── icons/                   # App icons for Win/Mac/Linux
│   ├── codes/                   # Code icons (SVG)
│   └── geoids/                  # EGM96, EGM2008 geoid grids
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 9. Phase-by-Phase Build Roadmap

### Phase 1 — Foundation (Weeks 1–3)
**Goal:** App skeleton with live GNSS position on a map.

- [ ] Initialize Tauri 2 + React + TypeScript + Tailwind project
- [ ] Implement serial port scanner and connection (Rust)
- [ ] Implement basic NMEA parser: GGA, RMC (Rust)
- [ ] Set up SQLite database with schema migrations
- [ ] Integrate MapLibre GL JS with OSM basemap
- [ ] Display live rover position on map (color-coded by fix type)
- [ ] Status bar with fix type, HDOP, satellite count, coordinates
- [ ] Basic settings page (units, baud rate)

**Deliverable:** App connects to ArduSimple USB receiver and shows live position on map.

---

### Phase 2 — NTRIP & RTK (Weeks 4–5)
**Goal:** Full RTK workflow with NTRIP corrections.

- [ ] Implement NTRIP TCP client (Rust, async with Tokio)
- [ ] Sourcetable fetch and mountpoint dropdown
- [ ] NTRIP credentials storage (encrypted)
- [ ] RTCM relay from NTRIP → serial port
- [ ] GGA auto-send to caster
- [ ] NTRIP status panel (bytes/s, correction age, fix upgrade visualization)
- [ ] Bluetooth scanner and connection

**Deliverable:** RTK FIX achieved via NTRIP on ArduSimple receiver.

---

### Phase 3 — Projects & Coordinate Systems (Weeks 6–7)
**Goal:** Full project management with coordinate transformations.

- [ ] New Project wizard (name, CS, code library)
- [ ] EPSG database bundled with proj4js (top 500 most-used systems)
- [ ] CS search by country/name/EPSG code
- [ ] Coordinate transform pipeline (WGS84 → project CS)
- [ ] Custom CS creator (datum + projection + geoid)
- [ ] Project list view with CRUD operations
- [ ] Settings persistence in SQLite

**Deliverable:** Create project in RGF93/Lambert-93 (or any national grid), see coordinates transform correctly.

---

### Phase 4 — Data Collection (Weeks 8–10)
**Goal:** Full survey data collection.

- [ ] Point collection panel (single shot + averaging)
- [ ] Code library manager with 100+ built-in codes
- [ ] Custom code creation
- [ ] Points displayed on map with code color/icon
- [ ] Point list view with edit/delete
- [ ] Line collection (start/add vertex/close)
- [ ] Polygon collection with area display
- [ ] Photo attachment to points
- [ ] Auto-collection mode (time/distance interval)
- [ ] Data edit panel (click point on map → edit attributes)

**Deliverable:** Full field survey data collection workflow.

---

### Phase 5 — Import/Export (Week 11)
**Goal:** Data exchange with office software.

- [ ] CSV import (name/E/N/Z or lat/lon with header auto-detection)
- [ ] CSV export (all point attributes)
- [ ] DXF import (points, polylines as reference layer)
- [ ] DXF export (points + lines by code/layer)
- [ ] KML import/export
- [ ] Shapefile import/export
- [ ] GeoJSON import/export

**Deliverable:** Round-trip with AutoCAD / QGIS / Google Earth.

---

### Phase 6 — Stakeout (Weeks 12–13)
**Goal:** Full stakeout capability.

- [ ] Point stakeout (far-field arrow + near-field crosshair)
- [ ] Stakeout tolerance configuration
- [ ] As-staked point recording with delta report
- [ ] Line stakeout (distance from line + chainage)
- [ ] Line stakeout with offset
- [ ] Interval staking along line
- [ ] Stakeout report PDF export

**Deliverable:** Professional stakeout for construction/infrastructure work.

---

### Phase 7 — COGO Tools (Week 14)
**Goal:** Coordinate geometry calculations.

- [ ] Inverse (distance + bearing between two points)
- [ ] Radiation (polar coordinates → new point)
- [ ] Offset point
- [ ] Two-bearing intersection
- [ ] Area/perimeter calculation
- [ ] Traverse closure check

**Deliverable:** All standard COGO functions available.

---

### Phase 8 — DTM / Surface (Weeks 15–16)
**Goal:** Earthwork stakeout with cut/fill.

- [ ] LandXML parser (TIN surface)
- [ ] TIN renderer on map (color gradient)
- [ ] Z-interpolation engine (barycentric)
- [ ] Contour line generation and display
- [ ] DTM stakeout (cut/fill at current position)
- [ ] Volume calculation (two surfaces)
- [ ] Cross-section profile viewer

**Deliverable:** Civil engineering cut/fill stakeout.

---

### Phase 9 — Polish & Cloud (Weeks 17–20)
**Goal:** Production-ready app with optional cloud sync.

- [ ] Full keyboard shortcut system
- [ ] Offline tile caching for map
- [ ] WMS/WMTS layer support
- [ ] i18n (EN/FR/ES/DE)
- [ ] Supabase cloud sync (optional, user-configurable)
- [ ] Team sharing / collaboration
- [ ] App auto-updater (Tauri updater plugin)
- [ ] Windows/macOS/Linux installer packaging
- [ ] User documentation in-app help

---

## 10. Testing Strategy

### Unit Tests (Rust)
- NMEA parser: test all sentence types with real NMEA samples
- COGO: mathematical correctness (compare with known results)
- TIN interpolation: test edge cases (point outside surface, degenerate triangles)
- Coordinate transforms: compare proj4 output with official transformation tables
- RTCM relay: verify byte integrity

### Integration Tests
- Serial port mock: use virtual serial port pair (`socat` on Linux, `com0com` on Windows)
- Full RTK workflow: simulate NTRIP server + RTCM feed → verify FIX achieved
- Import/Export: round-trip test (import DXF → export DXF → compare)

### Frontend Tests
- Vitest unit tests for COGO TypeScript functions
- React Testing Library for UI component behavior
- Playwright end-to-end tests for key workflows (collect point, stakeout, export)

### Field Testing Checklist
- [ ] USB connection to simpleRTK2B
- [ ] Bluetooth connection
- [ ] NTRIP FIX achieved on real VRS network
- [ ] 50-point survey collection with codes
- [ ] DXF export opens correctly in AutoCAD
- [ ] Shapefile opens correctly in QGIS
- [ ] Stakeout to within 2cm tolerance
- [ ] Coordinate system: compare against known control point

---

## 11. Key Libraries & Crates Reference

### Rust (Cargo.toml)
```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-serialport = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
nmea = "0.7"
dxf = "0.5"
shapefile = "0.5"
kml = "0.8"
proj4rs = "0.1"
quick-xml = "0.36"
rusqlite = { version = "0.31", features = ["bundled"] }
aes-gcm = "0.10"
btleplug = "0.11"
reqwest = { version = "0.12", features = ["stream"] }
chrono = { version = "0.4", features = ["serde"] }
geo = "0.28"
nalgebra = "0.33"
```

### JavaScript / TypeScript (package.json)
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "maplibre-gl": "^4",
    "proj4": "^2.12",
    "zustand": "^5",
    "recharts": "^2",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-sql": "^2",
    "@tauri-apps/plugin-fs": "^2",
    "tailwindcss": "^3",
    "lucide-react": "^0.400"
  }
}
```

### External Tools (bundled)
- **RTKLIB** (GPL) — PPK post-processing: bundle `convbin` and `rnx2rtkp` executables for Windows/Mac/Linux
- **PROJ** data files — `proj-data` package for datum shifts and grid transforms
- **EGM2008 geoid** — `egm2008-1` geoid grid (1 arc-minute resolution) from NGA

---

## Final Notes for the AI Dev Agent

1. **Start with Phase 1** — get a working GNSS position on screen before touching any other feature. This is the core feedback loop.

2. **Rust is the source of truth** for all calculations (COGO, transforms, TIN) — the TypeScript side only handles UI. Never implement survey math in TypeScript only; it must be testable in Rust.

3. **NMEA stream is async and lossy** — always use a ring buffer in Rust and never block the read loop. The frontend should receive position updates at ≤5Hz via Tauri events.

4. **Coordinate system correctness is critical** — a 1mm error in projection math means a failed survey. Always validate transforms against published test points from official geodetic authorities.

5. **The serial port mutex** — reading NMEA and writing RTCM on the same port must be thread-safe. Use a `tokio::sync::Mutex<Box<dyn SerialPort>>` and never hold the lock longer than one write operation.

6. **ArduSimple-first UX** — default baud rate 115200, auto-detect ZED-F9P by USB descriptor, show ArduSimple logo in device panel if detected. The target user is an ArduSimple customer, not a generic GNSS user.

7. **DXF is the most important export** — most survey customers deliver DXF to engineers and architects. Test with AutoCAD 2018, 2022, and QGIS. Use DXF version AC1015 (AutoCAD 2000) for maximum compatibility.

8. **Map tiles offline** — always cache the last N tiles the user viewed. Field locations often have no internet. Set default cache size to 500MB.

9. **Localization matters** — coordinates should never show more than 3 decimal places in projected (cm resolution) and never more than 7 decimal places in decimal degrees (mm resolution). Respect user's unit preference everywhere.

10. **One screen, one job** — each panel (Collect, Stakeout, COGO) should be fullscreen-capable and work well on a 10" tablet in bright sunlight (high contrast, large touch targets ≥44px).
```

---

*This document was generated through deep analysis of the ArduSimple compatible software ecosystem and Emlid Flow feature set. It is intended as a complete specification for an AI development agent to build a production-quality GNSS RTK desktop application.*
