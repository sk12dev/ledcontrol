/**
 * Configuration utilities for WLED device management
 * Now uses backend API instead of localStorage
 */

import { devicesApi, type Device } from "../api/backendClient";

/**
 * Validates IP address format (basic validation)
 * @param ip - IP address string to validate
 * @returns true if format appears valid
 */
export function isValidIP(ip: string): boolean {
  if (!ip || ip.trim() === "") return false;

  // Basic IP validation regex
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;

  // Check each octet is 0-255
  const parts = ip.split(".");
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Gets the stored WLED IP address from the default device
 * Falls back to localStorage for backward compatibility during migration
 * @returns IP address string or empty string if not set
 */
export async function getWLEDIP(): Promise<string> {
  try {
    // Try to get from API first (most recent devices)
    const devices = await devicesApi.getAll();
    
    // Get the most recently used device (by lastSeen or createdAt)
    if (devices.length > 0) {
      const sortedDevices = [...devices].sort((a, b) => {
        const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : new Date(a.createdAt).getTime();
        const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      return sortedDevices[0].ipAddress;
    }

    // Fallback to localStorage for backward compatibility
    const stored = localStorage.getItem("wled_ip_address");
    return stored || "";
  } catch (error) {
    console.error("Error reading device IP from API, falling back to localStorage:", error);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem("wled_ip_address");
      return stored || "";
    } catch (localError) {
      console.error("Error reading from localStorage:", localError);
      return "";
    }
  }
}

/**
 * Gets or creates a device with the given IP address
 * @param ip - IP address to save
 * @returns The device, or null if IP is invalid
 */
export async function getOrCreateDevice(ip: string): Promise<Device | null> {
  if (!isValidIP(ip)) {
    return null;
  }

  try {
    // Check if device with this IP already exists
    const devices = await devicesApi.getAll();
    const existingDevice = devices.find((d) => d.ipAddress === ip);

    if (existingDevice) {
      // Update last seen timestamp
      await devicesApi.updateLastSeen(existingDevice.id);
      return existingDevice;
    }

    // Create new device with default name
    const newDevice = await devicesApi.create({
      name: `WLED ${ip}`,
      ipAddress: ip.trim(),
    });

    // Also save to localStorage for backward compatibility
    try {
      localStorage.setItem("wled_ip_address", ip.trim());
    } catch (localError) {
      console.warn("Could not save to localStorage:", localError);
    }

    return newDevice;
  } catch (error) {
    console.error("Error creating/getting device:", error);
    // Fallback to localStorage
    try {
      if (isValidIP(ip)) {
        localStorage.setItem("wled_ip_address", ip.trim());
      }
    } catch (localError) {
      console.error("Error writing to localStorage:", localError);
    }
    return null;
  }
}

/**
 * Saves the WLED IP address (creates or updates device)
 * @param ip - IP address to save
 * @returns true if saved successfully, false otherwise
 */
export async function setWLEDIP(ip: string): Promise<boolean> {
  try {
    if (ip.trim() === "") {
      // Don't delete devices, just clear localStorage fallback
      localStorage.removeItem("wled_ip_address");
      return true;
    }

    if (!isValidIP(ip)) {
      return false;
    }

    await getOrCreateDevice(ip);
    return true;
  } catch (error) {
    console.error("Error saving device IP:", error);
    // Fallback to localStorage
    try {
      localStorage.setItem("wled_ip_address", ip.trim());
      return true;
    } catch (localError) {
      console.error("Error writing to localStorage:", localError);
      return false;
    }
  }
}

/**
 * Clears the stored WLED IP address (localStorage only, for backward compatibility)
 * Note: This doesn't delete devices from the database
 */
export function clearWLEDIP(): void {
  try {
    localStorage.removeItem("wled_ip_address");
  } catch (error) {
    console.error("Error clearing localStorage:", error);
  }
}

/**
 * Gets a device by IP address
 */
export async function getDeviceByIP(ip: string): Promise<Device | null> {
  try {
    const devices = await devicesApi.getAll();
    return devices.find((d) => d.ipAddress === ip) || null;
  } catch (error) {
    console.error("Error fetching device by IP:", error);
    return null;
  }
}
