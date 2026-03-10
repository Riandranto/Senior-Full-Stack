# Farady - Taxi/Bajaj Ride-Hailing App (Madagascar)

## Overview

Farady is a ride-hailing PWA (Progressive Web App) tailored for Madagascar (specifically Fort-Dauphin and surrounding areas within 100km). The key differentiator is that **drivers propose the price** (reverse bidding model) rather than a fixed fare system. Passengers post a ride request, drivers send price offers, and passengers choose which offer to accept.

The app supports three roles:
- **PASSENGER (Mpandeha)** – requests rides, receives driver offers, accepts/rejects
- **DRIVER (Mpamily)** – sees nearby ride requests, sends price offers, tracks ride status
- **ADMIN** – approves driver documents, manages users, configures app settings

Key constraints:
- No Google Maps or paid map services — uses OpenStreetMap via Leaflet
- Default language is Malagasy (MG), with French (FR) as an option
- MVP payment is cash-only (mobile money extensible later)
- Geo-restricted to a 100km radius around Fort-Dauphin (lat: -25.0325, lng: 46.9920)
- Authentication via OTP (phone-based)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 (SPA, no SSR) with TypeScript strict mode
- **Bundler**: Vite, configured with root at `client/`
- **Routing**: `wouter` (lightweight client-side routing)
- **State/Data Fetching**: TanStack React Query v5 for server state; no heavy global store (Zustand available if needed)
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming; taxi-yellow primary color theme (`--primary: 48 100% 50%`)
- **Maps**: Leaflet + react-leaflet with OpenStreetMap tiles (street-level); Nominatim for forward geocoding (text search) and reverse geocoding (map tap); Haversine distance calculation; separate pickup (green) and dropoff (red) marker icons
- **Animations**: Framer Motion for mobile bottom sheets and transitions
- **Fonts**: DM Sans + Outfit (Google Fonts)
- **i18n**: Custom lightweight context (`client/src/lib/i18n.tsx`) supporting `mg` (Malagasy) and `fr` (French)
- **Real-time**: Native WebSocket hook (`use-websocket.ts`) connecting to `/ws`, auto-reconnects with 3s delay, invalidates React Query caches on relevant events

**Page structure:**
- `/login` – OTP auth flow
- `/passenger` – ride request + map
- `/passenger/ride` – active ride tracking + offer bidding
- `/passenger/history` – past rides
- `/driver` – online/offline toggle + nearby requests list
- `/admin` – comprehensive admin dashboard (overview, rides, drivers, users, settings)
- `/profile` – shared profile/document upload page
- `/settings` – language switcher, theme
- `/passenger/help`, `/driver/help` – help & assistance (FAQ, emergency contacts, safety)

**Features:**
- In-app notification system (bell icon in header, unread badge, notification panel)
- Driver rating system (1-5 stars after ride completion, updates driver average)
- OSRM real road-based routing (route polyline follows actual roads, distance/ETA from OSRM API with Haversine fallback)
- Auto distance/ETA calculation (OSRM primary, Haversine fallback ~25 km/h)
- Driver auto-ETA: OSRM calculates driver-to-pickup time automatically (no manual input)
- Driver can call passenger directly from request cards
- SOS/security button during active rides (police 117, ambulance 118, location sharing)
- Trip sharing via Web Share API
- Smart location search: local places database (Bazary Be, Libanona, Tanambao, etc.) + admin custom places from DB + Nominatim forward geocoding with fallback
- Admin custom places management (CRUD) — admin can add locations that appear in passenger search
- Map tap for location selection with Nominatim reverse geocoding
- "My location" GPS button for quick pickup selection
- Map only flies to center on explicit user actions (suggestion select, GPS locate), not on every render — fully pannable/zoomable at all times
- Auto fit-bounds when both pickup and dropoff markers are placed
- Settings page: functional dark mode toggle (persisted to localStorage), language toggle (MG/FR persisted), notifications toggle, About dialog
- Help page: fully scrollable with emergency contacts, FAQ accordion, usage guides, safety tips
- Admin dashboard: real-time stats, ride management, driver approval/suspension, user blocking, platform config (radius, commission, offer expiry), real-time Leaflet map showing active rides + driver locations, status filters + pagination on all lists, document viewer (CIN/permis) in driver detail dialog

**Path aliases:**
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Backend Architecture

- **Runtime**: Node.js with Express, using `tsx` for TypeScript execution in dev
- **Entry**: `server/index.ts` → registers routes via `server/routes.ts`
- **Session**: `express-session` with `memorystore` (in-memory, single-instance; swap to `connect-pg-simple` for production persistence)
- **WebSocket**: `ws` library, WebSocketServer attached to the same HTTP server at path `/ws`. Clients authenticate by sending `{ type: 'auth', payload: { userId } }` after connection. Server maintains a `Map<userId, WebSocket>` for targeted messaging.
- **Real-time events** (defined in `shared/schema.ts` as `WS_EVENTS`): `OFFER_NEW`, `RIDE_STATUS_CHANGED`, driver location updates, etc.
- **Storage layer**: `server/storage.ts` exports `DatabaseStorage` implementing `IStorage` interface — all DB access goes through this abstraction, making it easy to swap implementations.
- **API routes**: Defined with type-safe schema in `shared/routes.ts` using Zod; route paths and methods are shared between client and server.
- **Build**: Custom `script/build.ts` runs Vite for client then esbuild for server, bundling an allowlisted set of server dependencies into `dist/index.cjs` for fast cold starts.

### Data Storage

- **Database**: PostgreSQL via `drizzle-orm/node-postgres` (requires `DATABASE_URL` env var)
- **ORM**: Drizzle ORM with schema defined in `shared/schema.ts`
- **Migrations**: `drizzle-kit push` (dev) or `./migrations/` folder for production

**Core tables:**
| Table | Purpose |
|---|---|
| `users` | All users (phone, name, role, language, OTP, block/approve status) |
| `driver_profiles` | Driver-specific data (vehicle type TAXI/BAJAJ, license, approval status, online status, rating) |
| `rides` | Ride requests (pickup/dropoff coords + address, status, passenger, accepted driver, price) |
| `offers` | Price offers from drivers for a ride |
| `driver_locations` | Real-time driver position (lat/lng, timestamp, filtered) |
| `driver_documents` | Uploaded document URLs for admin review |
| `app_config` | Admin-configurable settings (price floor/ceiling, etc.) |

**Geo utilities** (in `shared/schema.ts`):
- `calculateDistance()` — Haversine formula
- `isWithinRange()` — checks if coords are within 100km of Fort-Dauphin center

### Authentication & Authorization

- **Auth method**: Phone number + OTP (no passwords). OTP stored temporarily in `users.otpAuth`.
- **Session**: Express session cookie (`maxAge: 24h`), `userId` and `role` stored in session.
- **RBAC**: Route-level middleware checks `req.session.role` against allowed roles (`PASSENGER`, `DRIVER`, `ADMIN`).
- **Frontend guard**: `ProtectedRoute` component reads `useAuth()` and redirects based on role.
- **Driver approval gate**: Drivers must have `status: 'APPROVED'` in `driver_profiles` before accepting rides. Admin approves via document review in the admin dashboard.
- **WS auth**: Simple message-based auth (`{ type: 'auth', payload: { userId } }`) — no token validation yet; should be hardened for production.

### Mapping & Location

- **Tile rendering**: OpenStreetMap tiles via Leaflet (no API key needed)
- **Geocoding**: Nominatim API (free, low-volume MVP; should add local cache)
- **Routing/ETA**: OSRM public API (self-host ready — just swap the base URL env var); Haversine fallback if OSRM unavailable
- **Driver tracking**: Position sent every 2–5 seconds via WebSocket; server applies speed/jump filter before broadcasting to passengers
- **Snap-to-road**: Optional OSRM map matching endpoint

## External Dependencies

### Infrastructure
- **PostgreSQL** — primary database (via `DATABASE_URL` env var, must be provisioned)
- **Node.js** — runtime for Express server

### Key NPM Packages
| Package | Role |
|---|---|
| `drizzle-orm` + `pg` | Database ORM + PostgreSQL driver |
| `drizzle-kit` | Schema migrations (`db:push`) |
| `drizzle-zod` | Auto-generates Zod validators from Drizzle schemas |
| `express` | HTTP server |
| `ws` | WebSocket server |
| `express-session` + `memorystore` | Session management |
| `connect-pg-simple` | (Available) Persistent session store for production |
| `leaflet` + `react-leaflet` | Map rendering |
| `framer-motion` | UI animations |
| `@tanstack/react-query` | Server state management |
| `wouter` | Client-side routing |
| `zod` | Schema validation |
| `nanoid` | ID generation |
| `date-fns` | Date formatting |
| `multer` | File upload handling (driver documents) |

### Free External APIs (No Keys Required)
- **OpenStreetMap tiles** — `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (street-level map rendering)
- **Nominatim** — `https://nominatim.openstreetmap.org/` (geocoding; respect usage policy, add caching)

### Environment Variables Required
```
DATABASE_URL=           # PostgreSQL connection string
SESSION_SECRET=         # Express session secret (fallback: "super-secret-key")
```

### Replit-Specific Plugins
- `@replit/vite-plugin-runtime-error-modal` — error overlay in dev
- `@replit/vite-plugin-cartographer` — Replit file mapper (dev only)
- `@replit/vite-plugin-dev-banner` — Replit dev banner (dev only)