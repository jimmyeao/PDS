# Kiosk Digital Signage - Development Progress

**Last Updated:** 2025-12-13

## Project Overview
A web-based digital signage solution with central management of Raspberry Pi displays, featuring remote viewing capability, playlist management, and real-time device monitoring.

## Architecture
- **Backend:** ASP.NET Core 8.0 (C#) with PostgreSQL database
- **Frontend:** React + Vite with TypeScript
- **Client:** Node.js + Puppeteer + Chromium (for Raspberry Pi)
- **Real-time:** Native WebSockets (ASP.NET Core)
- **Authentication:** JWT tokens
- **Shared Types:** TypeScript package (`@kiosk/shared`) for type safety across client/frontend

---

## Technology Stack

### Backend (.NET)
- **Framework:** ASP.NET Core 8.0 (Minimal APIs)
- **Database:** PostgreSQL with Entity Framework Core
- **Authentication:** JWT Bearer tokens
- **Logging:** Serilog with console sink
- **WebSockets:** Native ASP.NET Core WebSockets
- **API Documentation:** Swagger/OpenAPI

### Frontend (React)
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 7
- **Routing:** React Router v6
- **State Management:** Zustand
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Icons:** Heroicons
- **WebSockets:** Native WebSocket API

### Client (Raspberry Pi)
- **Runtime:** Node.js with TypeScript
- **Browser Engine:** Puppeteer with Chromium
- **WebSockets:** ws library (native WebSocket protocol)
- **System Monitoring:** systeminformation package
- **Configuration:** dotenv

---

## Development History

### ✅ Phase 1-5: Initial Node.js Implementation (COMPLETED & DEPRECATED)
**Previous Architecture:** NestJS backend with Socket.IO and SQLite
- All phases 1-5 completed with NestJS/TypeORM/Socket.IO stack
- Successfully deployed and tested
- **Status:** Deprecated and removed in favor of .NET implementation

### ✅ Phase 6: .NET Migration & Refactor (COMPLETED)

#### Backend - ASP.NET Core Migration
- [x] Migrated from NestJS to ASP.NET Core 8.0 Minimal APIs
- [x] Switched from SQLite/TypeORM to PostgreSQL/Entity Framework Core
- [x] Implemented JWT authentication with Bearer tokens
- [x] Created Entity models (Device, DeviceLog, ContentItem, Playlist, PlaylistItem, DevicePlaylist, Screenshot)
- [x] Built RESTful API endpoints for all resources
- [x] Implemented native WebSocket support (replaced Socket.IO)
- [x] Added real-time device status broadcasting to admin clients
- [x] Implemented content push on device connection and playlist assignment
- [x] Added health check endpoints (/health, /healthz)
- [x] Integrated Serilog for structured logging
- [x] Added Swagger/OpenAPI documentation
- [x] Implemented CORS policies for frontend development
- [x] Database migration system with EF Core
- [x] Automatic schema updates on startup (Token column, unique indexes, etc.)

#### Frontend - WebSocket Migration
- [x] Migrated from Socket.IO client to native WebSocket API
- [x] Updated WebSocket event handling for new backend protocol
- [x] Maintained real-time device status indicators
- [x] Kept existing UI components and state management
- [x] Updated API service layer for new endpoint structure

#### Client - WebSocket & API Migration
- [x] Migrated from Socket.IO to native WebSocket (ws library)
- [x] Updated event protocol to match .NET backend expectations
- [x] Implemented playlist executor (replaced schedule executor)
- [x] Added content rotation with display duration support
- [x] Maintained health monitoring and screenshot functionality
- [x] Updated configuration for new API endpoints
- [x] WebSocket authentication via token query parameter
- [x] Automatic content updates when playlists are assigned/modified

---

## Current Implementation Details

### Backend Entities & Database Schema

**Devices**
- Id (int, PK)
- DeviceId (string, unique)
- Name (string)
- Token (string, nullable) - Persistent authentication token
- CreatedAt (DateTime)

**DeviceLogs**
- Id (int, PK)
- DeviceId (int, FK)
- Message (string)
- Timestamp (DateTime)

**Content**
- Id (int, PK)
- Name (string)
- Url (string, nullable)
- CreatedAt (DateTime)

**Playlists**
- Id (int, PK)
- Name (string)
- IsActive (bool)
- Items (collection)

**PlaylistItems**
- Id (int, PK)
- PlaylistId (int, FK)
- ContentId (int, FK, nullable)
- Url (string, nullable)
- DurationSeconds (int, nullable)
- OrderIndex (int, nullable)
- TimeWindowStart (string, nullable)
- TimeWindowEnd (string, nullable)
- DaysOfWeek (JSON string, nullable)

**DevicePlaylists** (junction table)
- DeviceId (int, FK)
- PlaylistId (int, FK)

**Screenshots**
- Id (int, PK)
- DeviceStringId (string)
- CurrentUrl (string, nullable)
- CreatedAt (DateTime)

### API Endpoints

#### Authentication
- `POST /auth/register` - Register new admin user
- `POST /auth/login` - Login and receive JWT token
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user info

#### Devices
- `POST /devices` - Create/register new device
- `GET /devices` - List all devices
- `GET /devices/{id}` - Get device by ID
- `GET /devices/{id}/token` - Get device token
- `POST /devices/{id}/token/rotate` - Rotate device token
- `GET /devices/{id}/logs` - Get device logs
- `PATCH /devices/{id}` - Update device
- `DELETE /devices/{id}` - Delete device

#### Content
- `POST /content` - Create content item
- `GET /content` - List all content
- `GET /content/{id}` - Get content by ID
- `PATCH /content/{id}` - Update content
- `DELETE /content/{id}` - Delete content

#### Playlists
- `POST /playlists` - Create playlist
- `GET /playlists` - List all playlists
- `GET /playlists/{id}` - Get playlist with items
- `PATCH /playlists/{id}` - Update playlist
- `DELETE /playlists/{id}` - Delete playlist

#### Playlist Items
- `POST /playlists/items` - Add item to playlist
- `GET /playlists/{playlistId}/items` - Get playlist items
- `PATCH /playlists/items/{id}` - Update playlist item
- `DELETE /playlists/items/{id}` - Remove playlist item

#### Playlist Assignment
- `POST /playlists/assign` - Assign playlist to device
- `GET /playlists/device/{deviceId}` - Get device's playlists
- `GET /playlists/{playlistId}/devices` - Get playlist's devices
- `DELETE /playlists/assign/device/{deviceId}/playlist/{playlistId}` - Unassign playlist

#### Screenshots
- `GET /screenshots/device/{deviceId}/latest` - Get latest screenshot
- `GET /screenshots/device/{deviceId}` - Get all device screenshots
- `GET /screenshots/{id}` - Get screenshot by ID

#### WebSocket
- `WS /ws?role=device&token={token}` - Device connection
- `WS /ws?role=admin` - Admin connection

### WebSocket Events

#### Server to Client
- `content:update` - Push playlist content to device
- `display:navigate` - Navigate device to URL
- `screenshot:request` - Request screenshot from device
- `config:update` - Update device configuration
- `device:restart` - Restart device
- `display:refresh` - Refresh device display
- `admin:devices:sync` - Sync connected devices list to admin
- `admin:device:status` - Device status update (online/offline)
- `admin:device:health` - Device health metrics
- `admin:screenshot:received` - Screenshot upload confirmation
- `admin:error` - Error report from device

#### Client to Server
- `device:register` - Device registration on connect
- `health:report` - Periodic health metrics
- `device:status` - Device status update
- `error:report` - Error reporting
- `screenshot:upload` - Screenshot upload

---

## File Structure
```
PDS/
├── src/
│   └── PDS.Api/                      ✅ .NET Backend
│       ├── Program.cs                   Main entry point, API endpoints, services
│       ├── Entities.cs                  EF Core entities and DbContext
│       ├── Contracts.cs                 DTOs and interfaces (if present)
│       ├── Migrations/                  EF Core migrations
│       └── PDS.Api.csproj              Project file
├── frontend/
│   ├── src/
│   │   ├── pages/                    ✅ Complete (Login, Dashboard, Devices, Content, Playlists)
│   │   ├── components/               ✅ Complete (ProtectedRoute, DashboardLayout, Notifications)
│   │   ├── services/                 ✅ Complete (auth, device, content, playlist, websocket)
│   │   └── store/                    ✅ Complete (auth, device, content, playlist, websocket, theme)
│   ├── package.json
│   └── vite.config.ts
├── client/
│   ├── src/
│   │   ├── index.ts                  ✅ Main entry point, orchestration
│   │   ├── config.ts                 ✅ Configuration management
│   │   ├── logger.ts                 ✅ Logging utility
│   │   ├── websocket.ts              ✅ Native WebSocket client (ws library)
│   │   ├── display.ts                ✅ Puppeteer display controller
│   │   ├── playlist-executor.ts      ✅ Playlist execution engine
│   │   ├── health.ts                 ✅ Health monitoring
│   │   ├── screenshot.ts             ✅ Screenshot capture/upload
│   │   └── services/                 API client services
│   ├── .env.example
│   ├── package.json
│   └── README.md
└── shared/
    ├── src/
    │   ├── index.ts
    │   └── types/                    ✅ Shared TypeScript types for WebSocket events, payloads
    └── package.json
```

---

## Current Status

### ✅ Completed & Working
- [x] .NET backend running on port 5001
- [x] Frontend builds and connects to backend
- [x] PostgreSQL database with EF Core migrations
- [x] JWT authentication
- [x] Native WebSocket real-time communication
- [x] Device registration and token-based auth
- [x] Playlist management (CRUD operations)
- [x] Content management
- [x] Playlist assignment to devices
- [x] Real-time content push to devices on assignment
- [x] Device status monitoring (online/offline)
- [x] Health metrics reporting
- [x] Screenshot capture and retrieval
- [x] Raspberry Pi client with Puppeteer display
- [x] Playlist execution with content rotation

### 🔧 Known Minor Issues (Cosmetic)
- Some UI styling inconsistencies (cosmetic only)
- Frontend console may show minor warnings

---

## Configuration

### Backend (src/PDS.Api)
**appsettings.json** (create if needed):
```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=pds;Username=postgres;Password=postgres"
  },
  "Jwt": {
    "Secret": "your-secret-key-here-minimum-32-characters",
    "Issuer": "pds",
    "Audience": "pds-clients"
  }
}
```

### Frontend
**frontend/.env**:
```
VITE_API_URL=http://localhost:5001
```

### Client (Raspberry Pi)
**client/.env**:
```
SERVER_URL=http://your-server:5001
DEVICE_ID=your-device-id
DEVICE_TOKEN=generated-device-token
LOG_LEVEL=info
SCREENSHOT_INTERVAL=300000
HEALTH_REPORT_INTERVAL=60000
```

---

## Deployment

### Backend
```bash
cd src/PDS.Api
dotnet restore
dotnet ef database update  # Run migrations
dotnet run                 # Development
dotnet publish -c Release  # Production build
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Development
npm run build      # Production build
```

### Client (Raspberry Pi)
```bash
cd client
npm install
npm run build
npm start          # Or use PM2 for process management
```

---

## Migration Notes

### Changes from NestJS to .NET
1. **Database:** SQLite → PostgreSQL (better concurrency, more features)
2. **ORM:** TypeORM → Entity Framework Core (native C# integration)
3. **WebSocket:** Socket.IO → Native WebSockets (simpler, less overhead)
4. **API Style:** NestJS decorators → ASP.NET Minimal APIs (more concise)
5. **Naming:** Schedules → Playlists (better terminology for content rotation)

### Removed Components
- Old `backend/` folder (NestJS implementation) - **REMOVED**
- Socket.IO dependencies in client and frontend (replaced with native WebSocket)
- Schedule-related terminology (replaced with Playlist)

### Retained Components
- `frontend/` - React/Vite frontend (updated API calls, WebSocket protocol)
- `client/` - Raspberry Pi client (updated WebSocket, API integration)
- `shared/` - TypeScript types package (still used by client and frontend)

---

## Next Steps
- Fine-tune UI cosmetic issues
- Add user management (currently using simple JWT without user database)
- Implement screenshot viewing in admin UI
- Add device grouping/tagging functionality
- Enhance playlist scheduling (time windows, days of week filtering)
- Add analytics and reporting
- Implement automated deployment scripts
- Add Docker support for easy deployment
