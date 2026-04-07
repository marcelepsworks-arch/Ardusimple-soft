# ArduSimple Software Ecosystem — Pla d'Acció Professional

**Versió:** 1.0 | **Data:** 2026-03-30 | **Pressupost:** EUR 110-120K | **Durada:** 9 mesos

---

## PART I: RESULTATS DE LA INVESTIGACIÓ

### 1. Anàlisi Tècnica — RTKLIB i Ecosistema RTK

#### RTKLIB — Estat Actual
- **Versió:** RTKLIB 2.4.3 (última estable), forks actius: `rtklibexplorer/RTKLIB` (Tim Everett, molt mantingut, suport F9P millorat)
- **Python bindings:** No existeix un binding madur oficial. Opcions:
  - `pyrtklib` — wrapper bàsic, poc mantingut
  - **Recomanació: cridar RTKLIB via subprocess** (`rnx2rtkp`, `rtkrcv`, `convbin`) — és l'enfocament que Emlid i altres utilitzen. Robust i provat.
  - Alternativa: `georinex` (Python pur per parsing RINEX), `csrs-ppp` per PPP online
- **Capacitats clau:** PPK (Post-Processing Kinematic), PPP (Precise Point Positioning), conversió RINEX, posicionament relatiu, anàlisi de qualitat
- **Risc:** RTKLIB té una UI arcaica però el motor de càlcul és gold-standard. El wrapper Python ha de ser robust amb gestió d'errors.

#### Receptors ArduSimple — Comunicació
| Receptor | Protocol | Connexió | Configuració |
|----------|----------|----------|-------------|
| u-blox ZED-F9P | UBX binari + NMEA + RTCM3 | USB (CDC-ACM), UART, Bluetooth (via HC-05/BLE add-on) | u-center / UBX commands via serial |
| Septentrio Mosaic-X5 | SBF + NMEA + RTCM3 | USB, Ethernet, UART | Web interface + serial commands |
| Unicore UM980/UM982 | NMEA + RTCM3 + UBX-compatible | USB, UART, Bluetooth | AT commands via serial |

**Nota crítica:** El ZED-F9P representa >90% dels clients ArduSimple. Prioritzar ZED-F9P absolut.

#### NTRIP — Implementació
- **Protocol:** HTTP/1.1 amb chunked transfer (NTRIP v2) o ICY protocol (v1)
- **Biblioteques existents:**
  - Node.js: `ntrip-client` (npm), o implementació pròpia (és HTTP bàsic, ~200 línies)
  - Python: `pygnssutils` (inclou NTRIPClient), `rtcm3` per parsing
  - React Native: No existeix lib directa → el backend ha de fer de proxy NTRIP
- **Arquitectura recomanada:** Mobile → Backend (WebSocket) → NTRIP Caster. El backend actua de proxy, gestiona credencials, i fa logging.

#### RINEX — Parsing i Post-Processing
- **Format:** Text pla, estandarditzat (v2.11, v3.x, v4.0). Fàcil de parsejar.
- **Python libs:** `georinex`, `hatanaka` (descompressió RINEX compacta), `gnssanalysis`
- **Workflow PPK:** RINEX base + RINEX rover → `rnx2rtkp` (RTKLIB) → solució amb coordenades corregides

### 2. Anàlisi Competitiva

#### Emlid Flow (Competidor Principal)
- **Model:** Freemium. Gratuït: funcionalitat bàsica. De pagament: projectes il·limitats, exportació avançada
- **Limitació clau:** NOMÉS funciona amb hardware Emlid (Reach RS2/RS3). No suporta u-blox genèric ni ArduSimple
- **Punts forts:** UX excel·lent, configuració automàtica, stakeout intuïtiu
- **Oportunitat:** Qualsevol usuari ArduSimple NO pot usar Emlid Flow → mercat captiu

#### SW Maps (Android)
- **Preu:** Gratuït, amb compres in-app
- **Compatible:** Sí, amb ArduSimple via Bluetooth/USB
- **Limitacions:** Només Android, sense post-processing, sense gestió de projectes avançada, UI limitada
- **Rols:** Actualment és el que ArduSimple recomana als seus clients → és el benchmark a superar

#### QField / QFieldCloud
- **Preu:** Open source (QField), QFieldCloud freemium
- **Punts forts:** Basat en QGIS, molt potent per GIS
- **Limitacions:** Corba d'aprenentatge alta, no dissenyat per surveying pur, configuració RTK manual
- **Oportunitat:** Massa complex per l'usuari target (instal·lador de camp)

#### AgOpenGPS
- **Preu:** Open source
- **Funció:** Autoguiatge agrícola amb GPS
- **Limitació:** Només Windows, molt DIY, comunitat petita però activa
- **Oportunitat:** Mòdul agricultura pot captar usuaris que volen solució mobile

### 3. Anàlisi Tècnica — Mobile Stack

#### React Native: Veredicte
| Capacitat | Viabilitat | Notes |
|-----------|-----------|-------|
| Bluetooth BLE | ✅ Alta | `react-native-ble-plx` — madur, ben mantingut |
| Bluetooth SPP (clàssic) | ⚠️ Mitjana | `react-native-bluetooth-classic` — menys madur, Android only |
| USB Serial (OTG) | ⚠️ Mitjana | `react-native-usb-serialport` — funciona Android, requereix dev kit |
| Mapes offline | ✅ Alta | MapLibre GL Native — tiles offline, rendiment excel·lent |
| NMEA parsing | ✅ Alta | `nmea-simple` (npm) — parsing robust |
| UBX parsing | ⚠️ Baixa | No hi ha lib JS madura → cal implementar parser binari custom |
| Alta freqüència (10Hz) | ✅ Alta | React Native pot gestionar-ho via native modules |
| Export DXF | ⚠️ Mitjana | `dxf-writer` (npm) — bàsic però funcional |
| Expo compatibilitat | ❌ No | Cal ejectar (Bare workflow) per Bluetooth/USB serial |

#### Decisió Crítica: Tauri 2 (Unified) vs React Native
| Criteri | Tauri 2 (Triat) | React Native |
|---------|-------------|---------|
| Multi-plataforma | Android, iOS, Win, Mac, Linux ✅ | Només Mòbil (Android/iOS) ❌ |
| Codi base | Un sol codi per a TOTS els dispositius ✅ | Codi separat per a l'escriptori ❌ |
| Rendiment Serial/BT | Natiu en Rust (ultra-ràpid) ✅ | Dependència de bridges JS ❌ |
| Mapes | MapLibre GL ✅ | MapLibre GL ✅ |

**ESTRATÈGIA DEFINITIVA:** Utilitzar **Tauri 2** com a core. Això ens permet mantenir una única aplicació en React que es compila per a mòbil (camp) i escriptori (oficina).

---

## PART II: PLA D'ACCIÓ DETALLAT

### Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                    UNIFIED APP (Tauri 2)             │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Mobile App   │  │ Desktop App  │                 │
│  │ (Android/iOS)│  │ (Windows/Mac)│                 │
│  └──────┬───────┘  └──────┬───────┘                 │
│         │                  │                         │
│         └────────┬─────────┘                         │
│                  ▼                                   │
│  ┌─────────────────────────────────┐                │
│  │         CORE BACKEND (Rust)     │                │
│  │    Tauri Runtime / Serial / BT  │                │
│  │  ┌───────┐ ┌────────┐ ┌─────┐  │                │
│  │  │ NMEA  │ │ NTRIP  │ │ SQL │  │                │
│  │  │ Parser│ │ Client │ │ DB  │  │                │
│  │  └───────┘ └────────┘ └─────┘  │                │
│  └─────────────────────────────────┘                │
└─────────────────────────────────────────────────────┘
```

### FASE 1: MVP MOBILE + BACKEND (Mesos 1-3) — EUR 45K

#### Sprint 1 (Setmanes 1-2): Fonaments
**Backend:**
- [ ] Projecte Node.js + Express + TypeScript
- [ ] PostgreSQL schema: `users`, `projects`, `points`, `sessions`
- [ ] Auth: JWT + refresh tokens, registre/login
- [ ] CI/CD: GitHub Actions, deploy a Railway/Render (staging)
- [ ] API REST: CRUD projectes, CRUD punts

**Mobile:**
- [ ] React Native Bare workflow (NO Expo)
- [ ] Navegació: React Navigation (tabs: Mapa, Projectes, Configuració)
- [ ] Mapa base: MapLibre GL amb tiles OpenStreetMap offline
- [ ] Estructura offline-first: WatermelonDB (SQLite sota)

**Lliurables S1:** App que mostra mapa, backend amb auth funcionant

#### Sprint 2 (Setmanes 3-4): Connexió Hardware
**Mobile — Bluetooth/Serial:**
- [ ] Mòdul connexió BLE (`react-native-ble-plx`)
- [ ] Mòdul connexió Bluetooth clàssic SPP (Android)
- [ ] Mòdul connexió USB OTG (`react-native-usb-serialport`, Android)
- [ ] Parser NMEA ($GPGGA, $GPRMC, $GPGSA) — usar `nmea-simple`
- [ ] Parser UBX bàsic (NAV-PVT, NAV-HPPOSLLH) — implementar custom
- [ ] Pantalla configuració: seleccionar dispositiu, baud rate, protocol
- [ ] Indicador de qualitat RTK: None/Float/Fix amb color (vermell/groc/verd)

**Lliurables S2:** App que es connecta a ZED-F9P i mostra posició en temps real al mapa

#### Sprint 3 (Setmanes 5-6): Recollida de Punts
**Mobile — Surveying Core:**
- [ ] Recollida de punt: tocar per guardar coordenada actual
- [ ] Formulari punt: nom, codi, descripció, foto opcional
- [ ] Mitjana de posicions: configurar N èpoques (5, 10, 30, 60s) amb barra progrés
- [ ] Visualització punts al mapa: icones per tipus (punt, vèrtex, estaca)
- [ ] Llista de punts: taula amb lat, lon, alt, qualitat, timestamp
- [ ] Mode stakeout bàsic: navegar cap a coordenada objectiu (distància + azimut)

**Backend — Sync:**
- [ ] Endpoint sync: POST /api/sync (enviar punts pendents)
- [ ] Gestió conflictes: last-write-wins amb timestamp
- [ ] Projectes: crear, llistar, compartir (via link)

**Lliurables S3:** App que recull punts amb mitjana, els mostra al mapa, i els sincronitza

#### Sprint 4 (Setmanes 7-8): NTRIP + Exportació
**Backend — NTRIP Proxy:**
- [ ] Client NTRIP v2: connectar a casters (Emlid, PointOne, IBGE, etc.)
- [ ] WebSocket bridge: Mobile ↔ Backend ↔ NTRIP Caster
- [ ] Gestió de múltiples mountpoints
- [ ] Caching de credencials NTRIP per usuari
- [ ] Taula de casters: mantenir llista de casters populars

**Mobile — NTRIP:**
- [ ] Pantalla configuració NTRIP: caster URL, port, mountpoint, user/pass
- [ ] Indicador connexió NTRIP activa
- [ ] Enviament GGA al caster (posició rover per correccions VRS)

**Exportació:**
- [ ] CSV (lat, lon, alt, code, quality, datetime)
- [ ] GeoJSON (FeatureCollection)
- [ ] Compartir via email/app del sistema

**Lliurables S4:** App completa MVP — connexió hardware, NTRIP, recollida, exportació

#### Sprint 5 (Setmanes 9-10): QA + Documentació + Beta
- [ ] Testing camp: 3 sessions amb hardware real (ZED-F9P simpleRTK2B)
- [ ] Fix bugs crítics
- [ ] Onboarding flow: tutorial primer ús (3 pantalles)
- [ ] 5 vídeo tutorials: Setup, Connexió, Recollida, NTRIP, Exportació
- [ ] Landing page + formulari beta
- [ ] Publicar a Google Play (beta oberta), TestFlight (iOS)
- [ ] Documentació API (Swagger/OpenAPI)

**KPIs Fase 1:**
- App publicada a stores (beta)
- 100-200 beta testers reclutats (via ArduSimple newsletter/comunitat)
- Precisió RTK Fix consistent: <2cm amb NTRIP
- Temps connexió hardware: <30 segons

---

### FASE 2: POST-PROCESSING ENGINE (Mesos 3-6) — EUR 30K

#### Sprint 6-7 (Setmanes 11-14): Motor PPK/PPP
**Python Post-Processing Service:**
- [ ] Servei Python (FastAPI) desplegat com a microservei
- [ ] Upload RINEX: validació format (v2.11, v3.x), descompressió Hatanaka
- [ ] Pipeline PPK:
  1. Rebre RINEX base + rover
  2. Validar overlap temporal
  3. Executar `rnx2rtkp` (RTKLIB) amb configuració optimitzada
  4. Parsejar solució (.pos) → JSON amb coordenades + qualitat
  5. Generar report de qualitat (% fix, RMS, outliers)
- [ ] Pipeline PPP:
  1. Rebre RINEX rover + productes IGS (descàrrega automàtica)
  2. Executar PPP amb òrbites precises
  3. Retornar solució convergida
- [ ] Queue: Redis + Celery per processar jobs async
- [ ] Storage: MinIO/S3 per fitxers RINEX i resultats

#### Sprint 8-9 (Setmanes 15-18): Web UI Post-Processing
**React Web App:**
- [ ] Upload RINEX drag & drop
- [ ] Selecció base station (llista de CORS, o upload manual)
- [ ] Progrés del processament en temps real (WebSocket)
- [ ] Visualització solució al mapa (trajectòria, punts, qualitat per color)
- [ ] Gràfics de qualitat: timeline de fix/float/single, RMS, satèl·lits
- [ ] Detecció d'anomalies: salts de posició, pèrdues de fix, multipath
- [ ] Export resultats: CSV, GeoJSON, Shapefile, informe PDF
- [ ] Comparació de solucions (forward vs combined vs backward)

#### Sprint 10 (Setmanes 19-20): Integració + Automatització
- [ ] Download automàtic de dades CORS (xarxes públiques: IBGE, IGN, NGS)
- [ ] Wizard: "Upload rover data → seleccionem base automàticament → processem"
- [ ] Connexió amb mobile app: processar dades recollides al camp directament
- [ ] Analytics dashboard: estadístiques d'ús, jobs processats

**KPIs Fase 2:**
- Post-processing PPK funcional amb precisió equivalent a RTKLIB manual
- Temps processament: <2 min per sessió d'1 hora
- 50+ usuaris actius al post-processing web
- Conversió free→pro: objectiu 3-5%

---

### FASE 3: EXTENSIONS (Mesos 6-9) — EUR 30K

#### Opció A: Precision Agriculture (Recomanada)
- [ ] Planificació de camps: dibuixar límits, dividir en zones
- [ ] Recollida de mostres georeferenciadada
- [ ] Anàlisi de cobertura RTK al camp
- [ ] Mapa de rates variables (interpolació kriging)
- [ ] Export ISO-XML (per controladores de maquinària)
- [ ] Integració dades de dron (ortofoto GeoTIFF overlay)
- [ ] Dashboard: resum de camp, històric, recomanacions

#### Opció B: Real-Time Monitoring
- [ ] Dashboard multi-rover en temps real
- [ ] Alertes de desplaçament (monitoratge estructural)
- [ ] Històric de posicions amb gràfics
- [ ] API per integració amb sistemes externs

---

## PART III: ESTRUCTURA DE PROJECTE

```
ardusimple-soft/
├── apps/
│   ├── mobile/                    # React Native app
│   │   ├── src/
│   │   │   ├── screens/           # Map, Projects, Settings, Survey
│   │   │   ├── components/        # PointMarker, SatelliteBar, NTRIPStatus
│   │   │   ├── services/
│   │   │   │   ├── bluetooth.ts   # BLE + SPP connection manager
│   │   │   │   ├── usb-serial.ts  # USB OTG connection
│   │   │   │   ├── nmea-parser.ts # NMEA sentence parser
│   │   │   │   ├── ubx-parser.ts  # UBX binary protocol parser
│   │   │   │   ├── ntrip.ts       # NTRIP client via backend proxy
│   │   │   │   ├── survey.ts      # Point collection, averaging
│   │   │   │   └── sync.ts        # Offline sync with backend
│   │   │   ├── db/                # WatermelonDB models + migrations
│   │   │   └── utils/
│   │   │       ├── coordinates.ts # WGS84, UTM, local projections
│   │   │       └── export.ts      # CSV, GeoJSON generators
│   │   └── package.json
│   │
│   └── web/                       # React web app (post-processing)
│       ├── src/
│       │   ├── pages/             # Upload, Results, Dashboard
│       │   ├── components/        # Map, Charts, FileUpload
│       │   └── services/          # API client, WebSocket
│       └── package.json
│
├── services/
│   ├── api/                       # Node.js + Express backend
│   │   ├── src/
│   │   │   ├── routes/            # auth, projects, points, ntrip, jobs
│   │   │   ├── middleware/        # auth, validation, rate-limit
│   │   │   ├── models/            # Sequelize/Prisma models
│   │   │   ├── services/
│   │   │   │   ├── ntrip-proxy.ts # NTRIP caster proxy
│   │   │   │   └── sync.ts       # Mobile sync logic
│   │   │   └── config/
│   │   └── package.json
│   │
│   └── processing/                # Python post-processing engine
│       ├── app/
│       │   ├── api/               # FastAPI routes
│       │   ├── engines/
│       │   │   ├── ppk.py         # PPK via RTKLIB subprocess
│       │   │   ├── ppp.py         # PPP engine
│       │   │   └── quality.py     # Quality analysis + anomaly detection
│       │   ├── parsers/
│       │   │   ├── rinex.py       # RINEX parser (georinex wrapper)
│       │   │   └── solution.py    # RTKLIB .pos file parser
│       │   └── tasks/             # Celery async tasks
│       ├── rtklib/                # RTKLIB binaries + config templates
│       └── requirements.txt
│
├── packages/                      # Shared code (monorepo)
│   └── shared/
│       ├── types/                 # TypeScript types compartits
│       └── constants/             # Codis, projeccions, etc.
│
├── infra/
│   ├── docker-compose.yml         # PostgreSQL, Redis, MinIO, services
│   ├── Dockerfile.api
│   ├── Dockerfile.processing
│   └── terraform/                 # (opcional) IaC per producció
│
├── docs/
│   ├── api/                       # OpenAPI/Swagger
│   ├── tutorials/                 # Guies d'usuari
│   └── architecture.md
│
├── turbo.json                     # Turborepo config
├── package.json                   # Monorepo root
└── README.md
```

---

## PART IV: MODEL DE DADES

### PostgreSQL Schema (Core)

```sql
-- Users & Auth
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    plan VARCHAR(20) DEFAULT 'free',  -- free, pro, enterprise
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    coordinate_system VARCHAR(50) DEFAULT 'WGS84',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Survey Points
CREATE TABLE points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    name VARCHAR(100),
    code VARCHAR(50),
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    h_accuracy REAL,           -- horizontal accuracy meters
    v_accuracy REAL,           -- vertical accuracy meters
    fix_type SMALLINT,         -- 0=none, 1=single, 2=DGPS, 4=RTK fix, 5=RTK float
    num_satellites SMALLINT,
    averaging_epochs INTEGER,  -- number of epochs averaged
    photo_url TEXT,
    collected_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NTRIP Configurations
CREATE TABLE ntrip_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(100),
    caster_host VARCHAR(255) NOT NULL,
    caster_port INTEGER DEFAULT 2101,
    mountpoint VARCHAR(100) NOT NULL,
    username VARCHAR(100),
    password_encrypted VARCHAR(255),
    is_default BOOLEAN DEFAULT false
);

-- Post-Processing Jobs (Phase 2)
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(10) NOT NULL,  -- ppk, ppp
    status VARCHAR(20) DEFAULT 'queued',  -- queued, processing, completed, failed
    rover_file_key TEXT NOT NULL,
    base_file_key TEXT,
    config JSONB,
    result JSONB,               -- coordinates, quality metrics
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

---

## PART V: CRONOGRAMA DETALLAT

```
Mes 1        Mes 2        Mes 3        Mes 4        Mes 5        Mes 6        Mes 7        Mes 8        Mes 9
┌────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬────────────┐
│ S1: Setup  │ S3: Survey │ S5: QA     │ S6: PPK    │ S8: Web UI │ S10: Auto  │ S11: Agri  │ S12: Agri  │ S13: QA    │
│ S2: HW     │ S4: NTRIP  │    Beta    │ S7: PPP    │ S9: Charts │    Wizard  │    Fields  │    Export  │    Launch  │
│            │    Export   │  Launch ●  │            │            │  Launch ●  │            │            │  Launch ●  │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
FASE 1: MVP ──────────────────────────► FASE 2: POST-PROC ─────────────────► FASE 3: EXTENSIONS ─────────────────►
        EUR 45K                                 EUR 30K                              EUR 30K
```

---

## PART VI: EQUIP I PRESSUPOST

### Equip Mínim

| Rol | Fase 1 | Fase 2 | Fase 3 | Cost/mes |
|-----|--------|--------|--------|----------|
| Dev React Native (Senior) | ✅ | — | ✅ (agri mobile) | EUR 4-5K |
| Dev Backend Node.js (Mid-Senior) | ✅ | ✅ (API) | ✅ | EUR 3.5-4.5K |
| Dev Python/RTKLIB (Senior) | — | ✅ | — | EUR 4-5K |
| Dev React Web (Mid) | — | ✅ | — | EUR 3-4K |
| QA / Tester de camp | ✅ | ✅ | ✅ | EUR 2-3K |

### Desglossament Pressupost

| Concepte | Cost |
|----------|------|
| Desenvolupament Fase 1 (3 devs × 3 mesos) | EUR 38-42K |
| Desenvolupament Fase 2 (2 devs × 3 mesos) | EUR 25-28K |
| Desenvolupament Fase 3 (1-2 devs × 3 mesos) | EUR 18-22K |
| Infraestructura cloud (9 mesos) | EUR 3-5K |
| Hardware testing (receptors, antenes) | EUR 2-3K |
| Disseny UI/UX (freelance) | EUR 5-8K |
| Contingència (10%) | EUR 10-12K |
| **TOTAL** | **EUR 101-120K** |

### Infraestructura Cloud (Estimació mensual)

| Servei | Proveïdor | Cost/mes |
|--------|-----------|----------|
| API + Web hosting | Railway / Render | EUR 25-50 |
| PostgreSQL | Supabase / Railway | EUR 0-25 |
| Redis | Upstash | EUR 0-10 |
| S3/Storage | Cloudflare R2 | EUR 5-20 |
| Processing (Python) | Railway / Fly.io | EUR 25-50 |
| **Total infra** | | **EUR 55-155/mes** |

---

## PART VII: RISCOS I MITIGACIÓ

| Risc | Probabilitat | Impacte | Mitigació |
|------|-------------|---------|-----------|
| Bluetooth SPP inestable a iOS | Alta | Alt | Prioritzar BLE; afegir USB com fallback; iOS = BLE only |
| RTKLIB subprocess falla silenciosament | Mitjana | Alt | Validació estricta d'output, timeout, logs detallats |
| Emlid llança suport multi-hardware | Baixa | Molt Alt | Accelerar llançament, diferenciar amb post-processing + agri |
| React Native libs hardware poc mantingudes | Mitjana | Alt | Encapsular en native modules propis; considerar Flutter pivot |
| Adopció lenta (<50 beta users) | Mitjana | Mitjà | Co-marketing amb ArduSimple, tutorials YouTube, fòrums |
| Costos NTRIP/cloud escalen | Baixa | Mitjà | Arquitectura permet casters gratuïts; edge computing |

---

## PART VIII: MÈTRIQUES D'ÈXIT

### Fase 1 (Mes 3)
- [ ] App publicada a Play Store + TestFlight
- [ ] 200+ beta testers registrats
- [ ] Connexió estable amb ZED-F9P (BLE + USB)
- [ ] NTRIP funcional amb 3+ casters
- [ ] NPS beta testers > 7

### Fase 2 (Mes 6)
- [ ] Post-processing PPK funcional
- [ ] 500+ usuaris registrats
- [ ] 50+ jobs de post-processing/setmana
- [ ] Conversió free→pro: 3%+
- [ ] MRR: EUR 500+

### Fase 3 (Mes 9)
- [ ] 1,200+ usuaris registrats
- [ ] Mòdul agricultura funcional
- [ ] Conversió free→pro: 5-7%
- [ ] MRR: EUR 1,200+
- [ ] Breakeven trajectory: 18-20 mesos

---

## PART IX: PRIMERS PASSOS IMMEDIATS (Setmana 1)

1. **Crear monorepo** amb Turborepo: `apps/mobile`, `services/api`, `packages/shared`
2. **Inicialitzar React Native** Bare workflow amb TypeScript
3. **Setup backend** Node.js + Express + Prisma + PostgreSQL
4. **Docker Compose** per dev local (PostgreSQL + Redis)
5. **CI/CD** GitHub Actions: lint + test + build
6. **Comprar/confirmar hardware test:** simpleRTK2B + antena + Bluetooth adapter
7. **Disseny UI:** Wireframes de les 4 pantalles principals (Figma)
8. **Contractar equip:** Publicar ofertes per 3 devs (o confirmar equip intern)
