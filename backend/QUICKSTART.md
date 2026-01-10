# Backend API Quick Start

## Installation

```bash
cd backend
npm install
```

## Configuration

Create `.env` file:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://wled_user:pass12345@192.168.1.39:5432/wled_control?schema=public"
```

## Run

```bash
npm run dev
```

Server starts on http://localhost:3001

## Test

```bash
curl http://localhost:3001/health
```

## API Endpoints

- `GET /api/devices` - List all devices
- `POST /api/devices` - Create device
- `GET /api/devices/:id` - Get device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device

- `GET /api/presets` - List presets (optional: `?deviceId=1`)
- `POST /api/presets` - Create preset
- `GET /api/presets/:id` - Get preset
- `PUT /api/presets/:id` - Update preset
- `DELETE /api/presets/:id` - Delete preset

See `README.md` for full documentation.

