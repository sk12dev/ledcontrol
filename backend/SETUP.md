# Backend Setup Instructions

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

This will install:
- Express and TypeScript types
- Prisma Client
- CORS middleware
- Zod for validation
- tsx for running TypeScript directly

### 2. Set Up Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Copy the example (if it exists) or create manually
cp .env.example .env  # If .env.example exists
```

Add these variables to `.env`:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://wled_user:pass12345@192.168.1.39:5432/wled_control?schema=public"
```

**Note:** The `DATABASE_URL` should match your PostgreSQL connection string. If your Prisma is configured at the root level, you can also reference the root `.env` file.

### 3. Verify Prisma Client

Make sure Prisma Client is generated (from project root):

```bash
# From project root (not backend directory)
npx prisma generate
```

The Prisma client should be generated in `src/generated/prisma/` at the root level.

### 4. Start Development Server

```bash
cd backend
npm run dev
```

The server should start on `http://localhost:3001` (or your configured PORT).

### 5. Test the API

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3001/health
```

You should see:
```json
{"status":"ok","timestamp":"2026-01-09T..."}
```

## Troubleshooting

### "Cannot find module 'express'"
**Solution:** Run `npm install` in the backend directory.

### "PrismaClient is not defined" or import errors
**Solution:** 
1. Make sure you've run `npx prisma generate` from the project root
2. Verify the Prisma client exists at `src/generated/prisma/client.ts`
3. Check that the import path in `backend/src/lib/prisma.ts` is correct: `../../../src/generated/prisma/client`

### "Cannot connect to database"
**Solution:**
1. Verify your `DATABASE_URL` in `.env` is correct
2. Test database connection: `psql -U wled_user -d wled_control -h 192.168.1.39`
3. Make sure PostgreSQL is running on your server

### Port already in use
**Solution:** Change the `PORT` in `.env` to a different port (e.g., 3002, 3003).

## Next Steps

Once the backend is running:

1. **Update React app** to use the backend API instead of localStorage
2. **Test API endpoints** using curl or a tool like Postman
3. **Create a migration script** to move existing localStorage data to the database

## API Testing Examples

### Create a Device
```bash
curl -X POST http://localhost:3001/api/devices \
  -H "Content-Type: application/json" \
  -d '{"name":"Living Room LEDs","ipAddress":"192.168.1.100"}'
```

### Get All Devices
```bash
curl http://localhost:3001/api/devices
```

### Create a Preset
```bash
curl -X POST http://localhost:3001/api/presets \
  -H "Content-Type: application/json" \
  -d '{"name":"Sunset","color":[255,100,50,0],"brightness":200}'
```

## Project Structure

```
backend/
├── src/
│   ├── lib/
│   │   └── prisma.ts          # Prisma client singleton
│   ├── middleware/
│   │   └── errorHandler.ts    # Global error handler
│   ├── routes/
│   │   ├── devices.ts         # Device CRUD endpoints
│   │   └── presets.ts         # Preset CRUD endpoints
│   └── server.ts              # Express app entry point
├── dist/                      # Compiled output (after build)
├── .env                       # Environment variables (create this)
├── package.json
├── tsconfig.json
└── README.md
```

