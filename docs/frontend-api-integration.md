# Frontend API Integration Guide

## Overview

The React frontend has been updated to use the backend API instead of localStorage. All data is now stored in the PostgreSQL database via the Express backend.

## What Changed

### 1. API Client (`src/api/backendClient.ts`)
- Created new API client with full TypeScript types
- Supports all CRUD operations for devices and presets
- Handles errors gracefully with fallback to localStorage during migration

### 2. Updated Utilities

#### `src/utils/config.ts`
- `getWLEDIP()` - Now async, fetches from backend API
- `setWLEDIP()` - Now async, creates/updates device in database
- Falls back to localStorage for backward compatibility

#### `src/utils/presets.ts`
- All functions are now async
- `getPresets()` - Fetches from API with optional device filter
- `savePreset()` - Creates preset via API
- `deletePreset()` - Deletes preset via API
- `updatePreset()` - Updates preset via API
- Falls back to localStorage for backward compatibility

### 3. Updated Components

#### `IPConfig.tsx`
- Updated to handle async `setWLEDIP()`
- Added loading states
- Better error handling

#### `CustomPresets.tsx`
- Updated to handle async preset operations
- Proper loading states for save/delete operations
- Error handling with user feedback

#### `useWLED.ts`
- Updated to load IP address asynchronously on mount
- Uses `useEffect` to fetch IP from backend

### 4. Migration Component

#### `MigrationPrompt.tsx`
- Automatically detects localStorage data on first load
- Prompts user to migrate data to backend
- Shows migration progress and results
- Integrated into main App component

## Environment Configuration

Create a `.env` file in the project root:

```env
# Backend API URL
# Default: http://localhost:3001/api
# For production, set this to your deployed backend URL
VITE_API_URL=http://localhost:3001/api
```

**Note:** Vite requires the `VITE_` prefix for environment variables to be exposed to the client.

## Migration Process

### Automatic Migration
The app will automatically detect localStorage data and prompt you to migrate on first load.

### Manual Migration
You can also trigger migration programmatically:

```typescript
import { migrateLocalStorageToBackend } from "./utils/migrateToBackend";

const result = await migrateLocalStorageToBackend();
console.log("Devices migrated:", result.devicesMigrated);
console.log("Presets migrated:", result.presetsMigrated);
console.log("Errors:", result.errors);
```

Or use the npm script:
```bash
npm run migrate
```

## Testing API Endpoints

### Run Automated Tests
```bash
npm run test:api
```

This will test all endpoints:
- Health check
- Device CRUD operations
- Preset CRUD operations

### Manual Testing

#### Test Health Endpoint
```bash
curl http://localhost:3001/health
```

#### Test Devices API
```bash
# Get all devices
curl http://localhost:3001/api/devices

# Create device
curl -X POST http://localhost:3001/api/devices \
  -H "Content-Type: application/json" \
  -d '{"name":"Test LED","ipAddress":"192.168.1.100"}'

# Get device by ID
curl http://localhost:3001/api/devices/1

# Update device
curl -X PUT http://localhost:3001/api/devices/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated LED"}'

# Delete device
curl -X DELETE http://localhost:3001/api/devices/1
```

#### Test Presets API
```bash
# Get all presets
curl http://localhost:3001/api/presets

# Get presets for device
curl http://localhost:3001/api/presets?deviceId=1

# Create preset
curl -X POST http://localhost:3001/api/presets \
  -H "Content-Type: application/json" \
  -d '{"name":"Sunset","color":[255,100,50,0],"brightness":200}'

# Update preset
curl -X PUT http://localhost:3001/api/presets/1 \
  -H "Content-Type: application/json" \
  -d '{"brightness":150}'

# Delete preset
curl -X DELETE http://localhost:3001/api/presets/1
```

## Backward Compatibility

The updated utilities maintain backward compatibility:
- If API calls fail, they fall back to localStorage
- Existing localStorage data can be migrated at any time
- Migration is optional - users can continue using localStorage if needed

## Error Handling

All API calls include:
- Try/catch error handling
- User-friendly error messages
- Console logging for debugging
- Fallback to localStorage on failure

## Type Safety

All API interactions are fully typed:
- Request/response types defined in `backendClient.ts`
- TypeScript ensures type safety throughout
- IDE autocomplete and type checking enabled

## Next Steps

1. **Test the API endpoints** - Run `npm run test:api`
2. **Migrate existing data** - Use the migration prompt or script
3. **Verify frontend functionality** - Test all features in the UI
4. **Deploy** - When ready, deploy both frontend and backend

## Troubleshooting

### API Connection Errors
- Verify backend is running on `http://localhost:3001`
- Check `VITE_API_URL` in `.env` file
- Check CORS configuration in backend

### Migration Errors
- Check browser console for detailed error messages
- Verify database connection is working
- Ensure backend API endpoints are accessible

### TypeScript Errors
- Run `npm run build` to check for type errors
- Ensure all imports are correct
- Check that `@prisma/client` types are generated

## Files Changed

- ✅ `src/api/backendClient.ts` - New API client
- ✅ `src/utils/config.ts` - Updated to use API
- ✅ `src/utils/presets.ts` - Updated to use API
- ✅ `src/components/IPConfig.tsx` - Async support
- ✅ `src/components/CustomPresets.tsx` - Async support
- ✅ `src/hooks/useWLED.ts` - Async IP loading
- ✅ `src/components/MigrationPrompt.tsx` - New component
- ✅ `src/utils/migrateToBackend.ts` - Migration utility
- ✅ `scripts/test-api.ts` - API test script

