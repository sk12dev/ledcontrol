/**
 * WLED Service
 * Handles backend communication with WLED devices
 */

import { prisma } from "../lib/prisma.js";

/**
 * WLED segment update for effects (supports fx, sx, ix, pal, col)
 */
export interface WLEDSegmentUpdate {
  id?: number;
  col?: [[number, number, number, number], [number, number, number, number], [number, number, number, number]];
  fx?: number;
  sx?: number;
  ix?: number;
  pal?: number;
}

/**
 * WLED State Update interface
 */
interface WLEDStateUpdate {
  on?: boolean;
  bri?: number;
  seg?: Array<{
    id?: number;
    col?: [[number, number, number, number]] | [[number, number, number, number], [number, number, number, number], [number, number, number, number]];
    fx?: number;
    sx?: number;
    ix?: number;
    pal?: number;
  }>;
  transition?: number;
}

/**
 * WLED full JSON response (state + info + effects + palettes)
 */
export interface WLEDJsonResponse {
  state?: unknown;
  info?: { fxcount?: number; palcount?: number; [key: string]: unknown };
  effects?: string[];
  palettes?: string[];
}

/**
 * WLED State interface
 */
interface WLEDState {
  on: boolean;
  bri: number;
  seg?: Array<{
    id?: number;
    col?: [[number, number, number, number]];
  }>;
}

/**
 * Builds the base URL for WLED API requests
 */
function getBaseURL(ip: string): string {
  if (!ip || ip.trim() === "") {
    throw new Error("WLED IP address is required");
  }
  return `http://${ip.trim()}/json`;
}

/**
 * Fetches the current state from WLED device
 */
export async function getDeviceState(deviceId: number): Promise<WLEDState> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new Error(`Device with id ${deviceId} not found`);
  }

  const baseURL = getBaseURL(device.ipAddress);
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(`${baseURL}/state`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(
        `Failed to fetch state from device ${device.name}: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<WLEDState>;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Connection timeout while fetching state from device ${device.name}`);
    }
    throw error;
  }
}

/**
 * Updates the state on WLED device
 */
export async function updateDeviceState(
  deviceId: number,
  state: WLEDStateUpdate
): Promise<WLEDState> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new Error(`Device with id ${deviceId} not found`);
  }

  const baseURL = getBaseURL(device.ipAddress);
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(`${baseURL}/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(state),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(
        `Failed to update state on device ${device.name}: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<WLEDState>;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Connection timeout while updating device ${device.name}`);
    }
    throw error;
  }
}

/**
 * Applies a preset to a device
 */
export async function applyPresetToDevice(
  deviceId: number,
  presetId: number
): Promise<WLEDState> {
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
  });

  if (!preset) {
    throw new Error(`Preset with id ${presetId} not found`);
  }

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new Error(`Device with id ${deviceId} not found`);
  }

  // Apply preset color and brightness (fx: 0 = Solid)
  const primaryColor: [number, number, number, number] = [
    preset.color[0],
    preset.color[1],
    preset.color[2],
    preset.color[3],
  ];
  const state: WLEDStateUpdate = {
    bri: preset.brightness,
    seg: [
      {
        id: 0,
        fx: 0, // Solid - clear any previous effect
        col: [
          primaryColor,
          [0, 0, 0, 0] as [number, number, number, number],
          [0, 0, 0, 0] as [number, number, number, number],
        ],
      },
    ],
  };

  return updateDeviceState(deviceId, state);
}

/**
 * Applies a preset to multiple devices
 */
export async function applyPresetToDevices(
  presetId: number,
  deviceIds: number[]
): Promise<WLEDState[]> {
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
  });

  if (!preset) {
    throw new Error(`Preset with id ${presetId} not found`);
  }

  // Apply preset to all devices in parallel
  return Promise.all(
    deviceIds.map((deviceId) => applyPresetToDevice(deviceId, presetId))
  );
}

/**
 * Fetches full WLED JSON response (state, info, effects, palettes) from a device
 */
export async function fetchWledJson(deviceId: number): Promise<WLEDJsonResponse> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new Error(`Device with id ${deviceId} not found`);
  }

  const baseURL = getBaseURL(device.ipAddress);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(baseURL, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch WLED JSON from device ${device.name}: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as WLEDJsonResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Connection timeout while fetching from device ${device.name}`);
    }
    throw error;
  }
}

/**
 * Checks if a device is reachable
 */
export async function checkDeviceConnection(deviceId: number): Promise<boolean> {
  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) return false;

    const baseURL = getBaseURL(device.ipAddress);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${baseURL}/info`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // Offline/unreachable (timeout, ECONNREFUSED, etc.) — return false without logging
      return false;
    }
  } catch (error) {
    // Only log unexpected errors (e.g. DB), not normal unreachable-device cases
    const cause = error instanceof Error && "cause" in error ? (error.cause as NodeJS.ErrnoException) : null;
    const isReachable = cause?.code === "ECONNREFUSED" || cause?.code === "ETIMEDOUT" || cause?.code === "ENOTFOUND";
    if (!isReachable) {
      console.error(`[Connection Check] Error checking connection for device ${deviceId}:`, error);
    }
    return false;
  }
}

/**
 * Updates device state with specific color and brightness values.
 * Explicitly sets fx: 0 (Solid) so any previous effect is cleared.
 */
export async function updateDeviceColorAndBrightness(
  deviceId: number,
  color: [number, number, number, number],
  brightness: number,
  transition?: number
): Promise<WLEDState> {
  const primaryColor: [number, number, number, number] = [
    color[0],
    color[1],
    color[2],
    color[3],
  ];
  const state: WLEDStateUpdate = {
    bri: brightness,
    seg: [
      {
        id: 0,
        fx: 0, // Solid - ensures we clear any previous effect
        col: [
          primaryColor,
          [0, 0, 0, 0] as [number, number, number, number],
          [0, 0, 0, 0] as [number, number, number, number],
        ],
      },
    ],
  };

  if (transition !== undefined) {
    state.transition = transition;
  }

  return updateDeviceState(deviceId, state);
}

