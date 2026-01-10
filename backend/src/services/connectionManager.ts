/**
 * Connection Manager Service
 * Manages device connection status and monitoring
 */

import { prisma } from "../lib/prisma.js";
import { checkDeviceConnection } from "./wledService.js";

interface ConnectionStatus {
  deviceId: number;
  isConnected: boolean;
  lastPingAt: Date | null;
  errorCount: number;
}

class ConnectionManager {
  private connectionStatus: Map<number, ConnectionStatus> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 10000; // 10 seconds
  private readonly MAX_ERROR_COUNT = 3;

  /**
   * Start monitoring all devices
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.checkAllDevices().catch((error) => {
        console.error("Error during device monitoring:", error);
      });
    }, this.PING_INTERVAL);

    // Initial check
    this.checkAllDevices().catch((error) => {
      console.error("Error during initial device check:", error);
    });
  }

  /**
   * Stop monitoring devices
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check connection status of all devices
   */
  async checkAllDevices(): Promise<void> {
    const devices = await prisma.device.findMany({
      select: { id: true },
    });

    await Promise.all(
      devices.map((device) => this.checkDeviceConnection(device.id))
    );
  }

  /**
   * Check connection status of a single device
   */
  async checkDeviceConnection(deviceId: number): Promise<boolean> {
    console.log(`[ConnectionManager] Checking connection for device ${deviceId}`);
    const isConnected = await checkDeviceConnection(deviceId);
    const now = new Date();

    const currentStatus = this.connectionStatus.get(deviceId);
    let errorCount = currentStatus?.errorCount || 0;

    if (isConnected) {
      errorCount = 0; // Reset error count on success
      // Mark as connected immediately on successful check
      const newStatus = {
        deviceId,
        isConnected: true,
        lastPingAt: now,
        errorCount: 0,
      };
      this.connectionStatus.set(deviceId, newStatus);
      console.log(`[ConnectionManager] Device ${deviceId} is CONNECTED`);
      return true;
    } else {
      errorCount += 1;
      // Only mark as disconnected after multiple failures
      const finalConnected = errorCount < this.MAX_ERROR_COUNT;

      const newStatus = {
        deviceId,
        isConnected: finalConnected,
        lastPingAt: now,
        errorCount,
      };
      this.connectionStatus.set(deviceId, newStatus);
      console.log(`[ConnectionManager] Device ${deviceId} connection check FAILED (errorCount: ${errorCount}, isConnected: ${finalConnected})`);

      return finalConnected;
    }
  }

  /**
   * Get connection status for a device
   */
  getConnectionStatus(deviceId: number): ConnectionStatus | null {
    return this.connectionStatus.get(deviceId) || null;
  }

  /**
   * Get all connected devices
   */
  getConnectedDevices(): number[] {
    const connected: number[] = [];
    this.connectionStatus.forEach((status, deviceId) => {
      if (status.isConnected) {
        connected.push(deviceId);
      }
    });
    return connected;
  }

  /**
   * Get all devices with their connection status
   * Returns status for all devices in the database, checking ones that haven't been checked yet
   */
  async getAllConnectionStatuses(): Promise<ConnectionStatus[]> {
    console.log(`[ConnectionManager] getAllConnectionStatuses called`);
    const devices = await prisma.device.findMany({
      select: { id: true },
    });

    console.log(`[ConnectionManager] Found ${devices.length} devices in database`);

    // Check devices that haven't been checked yet
    const uncheckedDevices = devices.filter(
      (device) => !this.connectionStatus.has(device.id)
    );

    console.log(`[ConnectionManager] ${uncheckedDevices.length} devices need to be checked`);

    // Check all unchecked devices
    if (uncheckedDevices.length > 0) {
      console.log(`[ConnectionManager] Checking unchecked devices:`, uncheckedDevices.map(d => d.id));
      await Promise.all(
        uncheckedDevices.map((device) => this.checkDeviceConnection(device.id))
      );
    }

    // Return statuses for all devices
    const statuses: ConnectionStatus[] = devices.map((device) => {
      const status = this.connectionStatus.get(device.id);
      if (status) {
        console.log(`[ConnectionManager] Device ${device.id} status: ${status.isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
        return status;
      }
      // Fallback: device not checked yet (shouldn't happen after the check above)
      console.log(`[ConnectionManager] Device ${device.id} has no status (fallback)`);
      return {
        deviceId: device.id,
        isConnected: false,
        lastPingAt: null,
        errorCount: 0,
      };
    });

    console.log(`[ConnectionManager] Returning ${statuses.length} statuses`);
    return statuses;
  }

  /**
   * Force reconnection check for a device (on-demand)
   */
  async reconnectDevice(deviceId: number): Promise<boolean> {
    // Reset error count and check immediately
    this.connectionStatus.delete(deviceId);
    return this.checkDeviceConnection(deviceId);
  }

  /**
   * Initialize connection status for all devices
   */
  async initialize(): Promise<void> {
    console.log(`[ConnectionManager] Initializing connection manager`);
    // Don't initialize with false status - let the first check determine it
    // Start monitoring immediately so devices get checked
    this.startMonitoring();
    // Also do an immediate check of all devices
    try {
      await this.checkAllDevices();
      console.log(`[ConnectionManager] Initial check complete`);
    } catch (error) {
      console.error(`[ConnectionManager] Error during initial check:`, error);
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();

