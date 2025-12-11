# Kiosk Digital Signage Solution

A web-based digital signage solution with central management of Raspberry Pi displays, featuring remote viewing capability, content scheduling, and interactive page support.

## Features

- **Central Management**: Web-based admin UI to manage all displays from one place
- **Remote Viewing**: See what's currently displayed on each Raspberry Pi screen in real-time
- **Content Scheduling**: Create rotation schedules with display durations and time windows
- **Interactive Page Support**: Handle authentication and MFA prompts without interruption
- **Real-time Updates**: WebSocket-based communication for instant configuration changes
- **Health Monitoring**: Track device status, CPU, memory, and connection health

## Architecture

- **Backend**: NestJS (Node.js + TypeScript) with SQLite database
- **Frontend**: React + Vite with TypeScript
- **Client**: Node.js + Puppeteer + Chromium (kiosk mode) for Raspberry Pi
- **Real-time**: Socket.IO for WebSocket communication
- **Authentication**: JWT tokens

## Project Structure

```
kiosk/
├── backend/      # NestJS API server
├── frontend/     # React admin UI
├── client/       # Raspberry Pi client application
└── shared/       # Shared TypeScript types
```

## Getting Started

### Prerequisites

- Node.js 18+ LTS
- npm 9+

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the backend server:
```bash
npm run backend:dev
```

Start the frontend development server:
```bash
npm run frontend:dev
```

Build the client application:
```bash
npm run client:build
```

## Documentation

See the [implementation plan](https://github.com/anthropics/claude-code/plans/mutable-knitting-dove.md) for detailed architecture and development phases.

## License

MIT
