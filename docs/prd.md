# WLED LED Control Interface - Product Requirements Document

## Project Overview

This project is a React + TypeScript web application for controlling WLED LED strips via ESP32 controllers. The application communicates with WLED devices through the WLED JSON API over HTTP.

**Project Goal:** Create an intuitive, user-friendly interface for controlling programmable LED strips, starting with basic on/off and color control functionality.

## Technology Stack

- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **API:** WLED JSON API (HTTP REST)
- **State Management:** React Hooks (useState, useEffect, custom hooks)
- **Storage:** localStorage for configuration persistence

## WLED API Integration

### Base URL

All API requests are made to `http://[WLED-IP-ADDRESS]/json`

### Key Endpoints

- `GET /json/state` - Retrieve current device state
- `POST /json/state` - Update device state
- `GET /json/info` - Retrieve device information

### API Documentation

Full documentation available at: https://kno.wled.ge/interfaces/json-api/

## Project Structure

```
my-react-app/
├── docs/
│   └── prd.md                    # This document - project reference
├── src/
│   ├── api/
│   │   └── wledClient.ts       # WLED API client service
│   ├── components/
│   │   ├── PowerToggle.tsx     # On/Off toggle button
│   │   ├── ColorPicker.tsx     # Color selection component
│   │   ├── IPConfig.tsx        # IP address configuration
│   │   └── ConnectionStatus.tsx # Connection status indicator
│   ├── hooks/
│   │   └── useWLED.ts          # Custom hook for WLED state management
│   ├── types/
│   │   └── wled.ts             # TypeScript types for WLED API
│   ├── utils/
│   │   └── config.ts           # Configuration persistence utilities
│   ├── App.tsx                  # Main application component
│   └── main.tsx
└── public/
```

## Architecture

### Component Hierarchy

- `App.tsx` - Main application container
  - `IPConfig` - IP address configuration (header)
  - `PowerToggle` - Power on/off control (shown when connected)
  - `ColorPicker` - Color selection (shown when connected)
  - `ConnectionStatus` - Connection state indicator (footer)

### Data Flow

1. User configures WLED device IP address via `IPConfig`
2. IP address persisted to localStorage via `config.ts` utilities
3. `useWLED` hook manages connection and state
4. `wledClient.ts` handles all HTTP API calls
5. Components update UI based on state from `useWLED` hook

### Component Details

#### IPConfig Component (`src/components/IPConfig.tsx`)

- **Purpose:** Configure and save WLED device IP address
- **Features:**
  - Text input for IP address
  - Real-time validation (IP format)
  - Save button with persistence to localStorage
  - Visual feedback (error messages, success confirmation)
  - Enter key support for quick save
- **Props:**
  - `onIPChange: (ip: string) => void` - Callback when IP is saved
  - `currentIP: string` - Currently configured IP address
- **State Management:** Uses local state for input, calls `setWLEDIP()` from `config.ts`

#### PowerToggle Component (`src/components/PowerToggle.tsx`)

- **Purpose:** Large, prominent button to turn WLED device on/off
- **Features:**
  - Visual state indication (yellow when on, gray when off)
  - Loading state during API calls
  - Disabled state when not connected
  - Smooth transitions and animations
- **Props:**
  - `power: boolean` - Current power state
  - `onToggle: () => Promise<void>` - Toggle function from useWLED hook
  - `disabled?: boolean` - Optional disabled state
- **Styling:** 128x128px circular button with Tailwind CSS

#### ColorPicker Component (`src/components/ColorPicker.tsx`)

- **Purpose:** Select RGB color for WLED device
- **Features:**
  - HTML5 color picker input
  - Hex color code input field
  - RGB value display
  - Real-time color updates
  - Loading state during API calls
- **Props:**
  - `color: WLEDColor` - Current color [R, G, B, W]
  - `onColorChange: (color: WLEDColor) => Promise<void>` - Color change handler
  - `disabled?: boolean` - Optional disabled state
- **Color Format:** Converts between WLED [R,G,B,W] arrays and hex strings

#### ConnectionStatus Component (`src/components/ConnectionStatus.tsx`)

- **Purpose:** Display connection state and device information
- **Features:**
  - Connection status indicator (connected/connecting/error/disconnected)
  - Device information display (name, version, LED count, uptime)
  - Error message display
  - Refresh button to reconnect
- **Props:**
  - `status: ConnectionStatus` - Current connection status
  - `deviceInfo: WLEDInfo | null` - Device information when connected
  - `error: string | null` - Error message if any
  - `onRefresh?: () => Promise<void>` - Optional refresh function
- **Status Colors:** Green (connected), Yellow (connecting), Red (error), Gray (disconnected)

#### useWLED Hook (`src/hooks/useWLED.ts`)

- **Purpose:** Centralized state management for WLED device interactions
- **State:**
  - `power: boolean` - Device power state
  - `color: WLEDColor` - Current color
  - `brightness: number` - Current brightness (1-255)
  - `connectionStatus: ConnectionStatus` - Connection state
  - `deviceInfo: WLEDInfo | null` - Device information
  - `error: string | null` - Error message
  - `ip: string` - Current IP address
- **Functions:**
  - `togglePower()` - Toggle device on/off
  - `setColor(color)` - Set device color
  - `setBrightness(brightness)` - Set brightness level
  - `connect(ip)` - Connect to device at IP
  - `refresh()` - Refresh state from device
- **Auto-connect:** Automatically connects when IP changes

#### wledClient (`src/api/wledClient.ts`)

- **Purpose:** HTTP client for WLED JSON API
- **Functions:**
  - `getState(ip)` - GET `/json/state`
  - `setState(ip, state)` - POST `/json/state`
  - `getInfo(ip)` - GET `/json/info`
  - `getFullResponse(ip)` - GET `/json` (complete response)
  - `checkConnection(ip)` - Test device connectivity
- **Error Handling:** Throws errors with descriptive messages
- **URL Construction:** Builds URLs from IP address

#### Type Definitions (`src/types/wled.ts`)

- **Purpose:** TypeScript interfaces for WLED API
- **Key Types:**
  - `WLEDColor` - [R, G, B, W] tuple
  - `WLEDState` - Complete state object
  - `WLEDInfo` - Device information
  - `WLEDSegment` - LED segment configuration
  - `ConnectionStatus` - Connection state enum
- **Based on:** Official WLED JSON API documentation

#### Config Utilities (`src/utils/config.ts`)

- **Purpose:** IP address persistence and validation
- **Functions:**
  - `getWLEDIP()` - Read IP from localStorage
  - `setWLEDIP(ip)` - Save IP to localStorage
  - `isValidIP(ip)` - Validate IP format
  - `clearWLEDIP()` - Clear stored IP
- **Storage Key:** `wled_ip_address`
- **Validation:** Basic IP format and octet range validation

## Configuration Management

- IP address stored in localStorage with key `wled_ip_address`
- Default fallback: empty string (user must configure)
- Validation: Basic IP format validation
- Persistence: Automatic save on configuration change

## Current Features (v1.0)

### Implemented

- **IP Address Configuration**
  - Input field with validation
  - localStorage persistence
  - Real-time validation feedback
  - Enter key support
- **Power Control**
  - Large, prominent toggle button
  - Visual state indication
  - Smooth animations
- **Color Selection**
  - HTML5 color picker
  - Hex code input
  - RGB value display
  - Real-time updates
- **Connection Management**
  - Auto-connect on IP change
  - Connection status indicator
  - Device information display
  - Error handling and display
  - Manual refresh capability

### User Experience

- Responsive design with Tailwind CSS
- Dark theme optimized for LED control
- Clear visual feedback for all actions
- Loading states during API calls
- Error messages for failed operations
- Disabled states when not connected

## Future Enhancements

- Brightness slider control
- Effect selection dropdown
- Palette selection
- Multiple segments support
- Presets management
- Real-time sync via WebSocket
- Transition duration control

## Development Guidelines

### Adding New Features

1. Update this PRD with feature description
2. Add TypeScript types if needed in `src/types/wled.ts`
3. Extend `wledClient.ts` if new API endpoints needed
4. Update `useWLED` hook for new state management
5. Create/update components as needed
6. Update this PRD with implementation details

### Code Organization

- Keep components focused and single-purpose
- Use TypeScript types for all API interactions
- Handle errors gracefully with user-friendly messages
- Follow React best practices (hooks, functional components)

## Implementation Notes

### Color Handling

- WLED uses RGBA color arrays: `[R, G, B, W]` where each value is 0-255
- Initial implementation uses RGB only (W channel set to 0)
- Color is stored in the first segment's `col[0]` array
- Conversion utilities handle hex ↔ RGB conversion

### State Synchronization

- State is fetched on initial connection
- Manual refresh available via ConnectionStatus component
- Future: WebSocket support for real-time updates

### Error Handling

- Network errors caught and displayed to user
- Invalid IP addresses validated before save
- API errors show user-friendly messages
- Connection status reflects error state

### Browser Compatibility

- Uses modern browser APIs (fetch, localStorage)
- HTML5 color input for color picker
- No polyfills required for modern browsers

## Development Workflow

### Running the Application

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### File Organization

- Components are self-contained and reusable
- Types are centralized in `src/types/`
- API logic separated from UI components
- Utilities are pure functions

### Testing Considerations

- Components can be tested in isolation
- Mock `wledClient` for unit tests
- localStorage can be mocked for config tests
- API responses can be mocked for integration tests

## Notes

- **This document should be referenced first** when questions arise about project structure or implementation
- Update this document when making significant architectural changes
- Keep implementation details current with codebase
- All components follow React best practices (functional components, hooks)
