# WLED Control Backend API

Backend API server for the WLED Control Interface, built with Express, TypeScript, and Prisma.

## Features

- RESTful API for managing WLED devices and presets
- TypeScript for type safety
- Prisma ORM for database access
- Input validation with Zod
- CORS enabled for frontend integration
- Error handling middleware

## API Endpoints

### Devices

- `GET /api/devices` - Get all devices
- `GET /api/devices/:id` - Get device by ID
- `POST /api/devices` - Create new device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device
- `PATCH /api/devices/:id/seen` - Update last seen timestamp

### Presets

- `GET /api/presets` - Get all presets (optional query: `?deviceId=1&userId=1`)
- `GET /api/presets/:id` - Get preset by ID
- `POST /api/presets` - Create new preset
- `PUT /api/presets/:id` - Update preset
- `DELETE /api/presets/:id` - Delete preset

### Health

- `GET /health` - Health check endpoint

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update `.env` with your configuration:
- `DATABASE_URL`: Your PostgreSQL connection string
- `PORT`: Server port (default: 3001)
- `FRONTEND_URL`: Your React app URL (default: http://localhost:5173)

### 3. Generate Prisma Client

Since Prisma is configured at the root level, generate the client from the root:

```bash
# From project root
npx prisma generate
```

### 4. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001` (or your configured PORT).

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server (requires build first)
- `npm run lint` - Lint TypeScript files

## API Examples

### Create a Device

```bash
curl -X POST http://localhost:3001/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Living Room LEDs",
    "ipAddress": "192.168.1.100",
    "macAddress": "AA:BB:CC:DD:EE:FF"
  }'
```

### Create a Preset

```bash
curl -X POST http://localhost:3001/api/presets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset",
    "color": [255, 100, 50, 0],
    "brightness": 200,
    "deviceId": 1
  }'
```

### Get All Devices

```bash
curl http://localhost:3001/api/devices
```

### Get Presets for a Device

```bash
curl http://localhost:3001/api/presets?deviceId=1
```

## Project Structure

```
backend/
├── src/
│   ├── lib/
│   │   └── prisma.ts          # Prisma client instance
│   ├── middleware/
│   │   └── errorHandler.ts    # Error handling middleware
│   ├── routes/
│   │   ├── devices.ts         # Device routes
│   │   └── presets.ts         # Preset routes
│   └── server.ts              # Express app setup
├── dist/                      # Compiled JavaScript (generated)
├── .env                       # Environment variables (not in git)
├── .env.example               # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Database

This backend uses Prisma ORM. The Prisma schema is located at the root of the project:
- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`

The Prisma client is generated in `src/generated/prisma/` at the root level and is referenced from the backend.

## CORS Configuration

CORS is configured to allow requests from your React frontend. Update `FRONTEND_URL` in `.env` to match your frontend's URL.

## Error Handling

All errors are caught by the error handler middleware and returned as JSON:

```json
{
  "error": "Error message",
  "details": { /* optional validation details */ }
}
```

## Development

The development server uses `tsx` for TypeScript execution with hot reload. Changes to TypeScript files will automatically restart the server.

## Production

1. Build the project: `npm run build`
2. Set `NODE_ENV=production` in `.env`
3. Start the server: `npm start`

Make sure to configure your production database URL and frontend URL in the `.env` file.

