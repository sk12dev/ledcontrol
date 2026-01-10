/**
 * WLED API Client
 * Handles all HTTP communication with WLED devices
 */

import type { WLEDState, WLEDInfo, WLEDStateUpdate, WLEDResponse } from "../types/wled";

/**
 * Builds the base URL for WLED API requests
 * @param ip - WLED device IP address
 * @returns Base URL string
 */
function getBaseURL(ip: string): string {
  if (!ip || ip.trim() === "") {
    throw new Error("WLED IP address is required");
  }
  return `http://${ip.trim()}/json`;
}

/**
 * Fetches the current state from WLED device
 * @param ip - WLED device IP address
 * @returns Promise resolving to WLED state
 */
export async function getState(ip: string): Promise<WLEDState> {
  const baseURL = getBaseURL(ip);
  const response = await fetch(`${baseURL}/state`);

  if (!response.ok) {
    throw new Error(`Failed to fetch state: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Updates the state on WLED device
 * @param ip - WLED device IP address
 * @param state - Partial state update object
 * @returns Promise resolving to updated WLED state
 */
export async function setState(ip: string, state: WLEDStateUpdate): Promise<WLEDState> {
  const baseURL = getBaseURL(ip);
  const response = await fetch(`${baseURL}/state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error(`Failed to update state: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches device information from WLED device
 * @param ip - WLED device IP address
 * @returns Promise resolving to WLED info
 */
export async function getInfo(ip: string): Promise<WLEDInfo> {
  const baseURL = getBaseURL(ip);
  const response = await fetch(`${baseURL}/info`);

  if (!response.ok) {
    throw new Error(`Failed to fetch info: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches complete WLED response (state + info + effects + palettes)
 * @param ip - WLED device IP address
 * @returns Promise resolving to complete WLED response
 */
export async function getFullResponse(ip: string): Promise<WLEDResponse> {
  const baseURL = getBaseURL(ip);
  const response = await fetch(baseURL);

  if (!response.ok) {
    throw new Error(`Failed to fetch WLED data: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches available palettes from WLED device
 * @param ip - WLED device IP address
 * @returns Promise resolving to array of palette names
 */
export async function getPalettes(ip: string): Promise<string[]> {
  const baseURL = getBaseURL(ip);
  const response = await fetch(`${baseURL}/pal`);

  if (!response.ok) {
    throw new Error(`Failed to fetch palettes: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches available effects from WLED device
 * @param ip - WLED device IP address
 * @returns Promise resolving to array of effect names
 */
export async function getEffects(ip: string): Promise<string[]> {
  const baseURL = getBaseURL(ip);
  const response = await fetch(`${baseURL}/eff`);

  if (!response.ok) {
    throw new Error(`Failed to fetch effects: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Checks if WLED device is reachable
 * @param ip - WLED device IP address
 * @returns Promise resolving to true if device is reachable
 */
export async function checkConnection(ip: string): Promise<boolean> {
  try {
    await getInfo(ip);
    return true;
  } catch (error) {
    return false;
  }
}

