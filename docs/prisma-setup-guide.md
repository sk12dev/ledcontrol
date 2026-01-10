# Prisma Setup Guide for WLED Control Interface

## Overview

This guide covers setting up Prisma ORM for the WLED Control Interface backend.

## Current Setup Status

✅ Prisma Client installed
✅ Prisma initialized
✅ Schema created with models: Device, Preset, UserPreference
⚠️ Database connection needs to be configured

## Configuration Steps

### 1. Set Up Environment Variables

Create a `.env` file in the project root (if not already created):

```bash
# Copy from .env.example (if you create one) or create manually
```

Add your database connection URL:

**For local connection (if database is on same machine):**
```env
DATABASE_URL="postgresql://wled_user:pass12345@localhost:5432/wled_control?schema=public"
```

**For remote Ubuntu server (192.168.1.39):**
```env
DATABASE_URL="postgresql://wled_user:pass12345@192.168.1.39:5432/wled_control?schema=public"
```

**Note:** 
- If connecting directly to remote server: Use the server IP (192.168.1.39)
- If using SSH tunnel: Use `localhost` (the tunnel handles the connection to 192.168.1.39)

**Connection URL Format:**

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
```

### 2. Install Required Dependencies

```bash
# Install dotenv for environment variable management (if not already installed)
npm install dotenv

# Install @prisma/client as a runtime dependency
npm install @prisma/client
```

### 3. Generate Prisma Client

Generate the Prisma Client from your schema:

```bash
npx prisma generate
```

This creates the TypeScript client in `src/generated/prisma/` based on your schema.

### 4. Create Database Migration

Create and apply your first migration to set up the database tables:

```bash
npx prisma migrate dev --name init
```

This will:

- Create migration files in `prisma/migrations/`
- Apply the migration to your database
- Create all tables (devices, presets, user_preferences)

### 5. Verify Database Setup

Check that tables were created:

```bash
# Open Prisma Studio (GUI for viewing/editing data)
npx prisma studio

# Or connect directly with psql:
psql -U wled_user -d wled_control
\dt  # List tables
```

## Prisma Schema Overview

### Device Model

Stores WLED device information:

- `id`: Auto-incrementing primary key
- `name`: Device name (e.g., "Living Room LEDs")
- `ipAddress`: Unique IP address (e.g., "192.168.1.100")
- `macAddress`: Optional MAC address
- `lastSeen`: Last connection timestamp
- `deviceInfo`: Full WLED device info as JSON (name, version, LED count, etc.)
- `createdAt` / `updatedAt`: Timestamps

### Preset Model

Stores custom color/brightness presets:

- `id`: Auto-incrementing primary key
- `name`: Preset name (e.g., "Sunset", "Ocean Blue")
- `color`: Array of [R, G, B, W] values (0-255 each)
- `brightness`: Brightness level (1-255)
- `deviceId`: Optional link to specific device
- `userId`: Optional link for multi-user support (future)
- `createdAt` / `updatedAt`: Timestamps

### UserPreference Model

Stores user preferences (for future use):

- `id`: Auto-incrementing primary key
- `userId`: User ID (for future multi-user support)
- `defaultDeviceId`: Default device to use
- `theme`: UI theme preference
- `preferences`: Flexible JSON field for additional settings
- `createdAt` / `updatedAt`: Timestamps

## Important Notes

### Brightness Constraint

The schema defines `brightness` as an `Int`, but the database schema includes a CHECK constraint to ensure values are between 1-255. Prisma doesn't directly support CHECK constraints in the schema, so you'll need to:

**Option 1:** Add constraint via raw SQL migration:

```sql
ALTER TABLE presets ADD CONSTRAINT brightness_range CHECK (brightness >= 1 AND brightness <= 255);
```

**Option 2:** Handle validation in application code (recommended for now):

```typescript
// In your API endpoint
if (brightness < 1 || brightness > 255) {
  throw new Error("Brightness must be between 1 and 255");
}
```

### Array Fields

Prisma supports PostgreSQL arrays with `Int[]` syntax. The `color` field stores [R, G, B, W] values as a PostgreSQL integer array.

## Using Prisma Client in Your Backend

### Example: Create a Device

```typescript
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function createDevice(name: string, ipAddress: string) {
  const device = await prisma.device.create({
    data: {
      name,
      ipAddress,
    },
  });
  return device;
}
```

### Example: Get All Devices

```typescript
async function getAllDevices() {
  const devices = await prisma.device.findMany({
    orderBy: { createdAt: "desc" },
  });
  return devices;
}
```

### Example: Create a Preset

```typescript
async function createPreset(
  name: string,
  color: [number, number, number, number], // [R, G, B, W]
  brightness: number,
  deviceId?: number
) {
  // Validate brightness
  if (brightness < 1 || brightness > 255) {
    throw new Error("Brightness must be between 1 and 255");
  }

  const preset = await prisma.preset.create({
    data: {
      name,
      color,
      brightness,
      deviceId,
    },
  });
  return preset;
}
```

### Example: Get Presets for a Device

```typescript
async function getPresetsForDevice(deviceId: number) {
  const presets = await prisma.preset.findMany({
    where: {
      deviceId,
    },
    orderBy: { name: "asc" },
  });
  return presets;
}
```

## Next Steps

1. **Set up your backend API** (Node.js/Express recommended):

   ```bash
   # Create backend directory structure
   mkdir backend
   cd backend
   npm init -y
   npm install express prisma @prisma/client
   npm install -D @types/express @types/node typescript ts-node
   ```

2. **Create API endpoints** to replace localStorage:

   - `GET /api/devices` - List all devices
   - `POST /api/devices` - Create device
   - `GET /api/presets` - List presets
   - `POST /api/presets` - Create preset
   - `DELETE /api/presets/:id` - Delete preset

3. **Update React app** to call backend API instead of localStorage

4. **Migrate existing localStorage data** to the database

## Common Commands

```bash
# Generate Prisma Client (after schema changes)
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name migration_name

# View database in browser (Prisma Studio)
npx prisma studio

# Format Prisma schema
npx prisma format

# Validate Prisma schema
npx prisma validate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Push schema to database (no migration files)
npx prisma db push
```

## Troubleshooting

### Issue: "Can't reach database server"

**Solution:**

- Check `.env` file has correct `DATABASE_URL`
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Test connection: `psql -U wled_user -d wled_control`
- Check firewall rules if connecting remotely

### Issue: "Authentication failed"

**Solution:**

- Verify username and password in `DATABASE_URL`
- Check `pg_hba.conf` allows connections from your IP
- Ensure database user exists and has permissions

### Issue: "Table does not exist"

**Solution:**

- Run migrations: `npx prisma migrate dev`
- Check if database exists: `psql -U wled_user -d wled_control -c "\dt"`

### Issue: Prisma Client not found

**Solution:**

- Generate client: `npx prisma generate`
- Verify import path: `import { PrismaClient } from '../generated/prisma'`
- Check `package.json` includes `@prisma/client`

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Client API Reference](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Prisma Migrate Guide](https://www.prisma.io/docs/guides/migrate)
- [PostgreSQL Arrays in Prisma](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#array)
