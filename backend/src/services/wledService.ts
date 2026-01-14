/**
 * WLED Service
 * Handles backend communication with WLED devices
 */

import { prisma } from "../lib/prisma.js";

/**
 * WLED State Update interface
 */
interface WLEDStateUpdate {
  on?: boolean;
  bri?: number;
  seg?: Array<{
    id?: number;
    col?: [[number, number, number, number]];
  }>;
  transition?: number;
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

  // Apply preset color and brightness
  const state: WLEDStateUpdate = {
    bri: preset.brightness,
    seg: [
      {
        id: 0,
        col: [[preset.color[0], preset.color[1], preset.color[2], preset.color[3]]],
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
 * Checks if a device is reachable
 */
export async function checkDeviceConnection(deviceId: number): Promise<boolean> {
  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      console.log(`[Connection Check] Device ${deviceId} not found in database`);
      return false;
    }

    const baseURL = getBaseURL(device.ipAddress);
    console.log(`[Connection Check] Checking device ${deviceId} (${device.ipAddress}) at ${baseURL}/info`);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[Connection Check] Timeout checking device ${deviceId} (${device.ipAddress})`);
      controller.abort();
    }, 5000); // 5 second timeout
    
    try {
      const response = await fetch(`${baseURL}/info`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const isOk = response.ok;
      console.log(`[Connection Check] Device ${deviceId} (${device.ipAddress}) - Response OK: ${isOk}, Status: ${response.status}`);
      return isOk;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // If aborted, it's a timeout
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.log(`[Connection Check] Device ${deviceId} (${device.ipAddress}) - Connection timeout`);
        return false;
      }
      console.error(`[Connection Check] Device ${deviceId} (${device.ipAddress}) - Fetch error:`, fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error(`[Connection Check] Error checking connection for device ${deviceId}:`, error);
    return false;
  }
}

/**
 * Updates device state with specific color and brightness values
 */
export async function updateDeviceColorAndBrightness(
  deviceId: number,
  color: [number, number, number, number],
  brightness: number,
  transition?: number
): Promise<WLEDState> {
  const state: WLEDStateUpdate = {
    bri: brightness,
    seg: [
      {
        id: 0,
        col: [[color[0], color[1], color[2], color[3]]],
      },
    ],
  };

  if (transition !== undefined) {
    state.transition = transition;
  }

  return updateDeviceState(deviceId, state);
}

