# WLED Control Interface

A full-stack application for controlling WLED devices with advanced cue system support for theatre productions.

## Features

- 🎨 Multi-device WLED control
- 🎬 Advanced cue system with timing and transitions
- 📋 Cue lists for show management
- 💾 Custom presets
- 🌐 Web-based interface
- 🗄️ PostgreSQL database backend

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   cd backend
   npm install
   cd ..
   ```

2. **Set up environment variables:**
   
   Create `backend/.env`:
   ```env
   DATABASE_URL="postgresql://wled_user:pass12345@192.168.1.39:5432/wled_control?schema=public"
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   ```
   
   Create `.env.local` for frontend:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```

3. **Set up database:**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Run development servers:**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Deployment

### Quick Deploy to Ubuntu Server

See [DEPLOYMENT.md](DEPLOYMENT.md) for quick start, or [docs/deployment-guide.md](docs/deployment-guide.md) for detailed instructions.

**Quick steps:**
1. Transfer files to server (see `scripts/deploy-to-server.ps1` for Windows)
2. Run `scripts/deploy.sh` on the server
3. Configure Nginx (see `scripts/nginx-ledcontrol.conf`)
4. Set up environment variables (see `backend/env.template` and `env.production.template`)

## Project Structure

```
ledcontrol/
├── backend/              # Express API server
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   └── lib/         # Prisma client
│   └── package.json
├── src/                 # React frontend
│   ├── components/      # React components
│   ├── api/            # API client
│   ├── hooks/          # Custom hooks
│   └── utils/          # Utilities
├── prisma/             # Database schema and migrations
├── scripts/            # Deployment and utility scripts
└── docs/               # Documentation
```

## Documentation

- [Deployment Guide](docs/deployment-guide.md) - Comprehensive deployment instructions
- [Quick Deployment](DEPLOYMENT.md) - Quick start deployment guide
- [Database Setup](docs/database-setup.md) - PostgreSQL setup instructions
- [Prisma Setup](docs/prisma-setup-guide.md) - Prisma ORM configuration

## Scripts

- `npm run dev` - Start frontend dev server
- `npm run build` - Build frontend for production
- `npm run backend:dev` - Start backend dev server
- `npm run backend:build` - Build backend for production
- `npm run backend:start` - Start backend production server

## License

MIT
