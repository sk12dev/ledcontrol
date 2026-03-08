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
      devices.map((device: { id: number }) => this.checkDeviceConnection(device.id))
    );
  }

  /**
   * Check connection status of a single device
   */
  async checkDeviceConnection(deviceId: number): Promise<boolean> {
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
    const devices = await prisma.device.findMany({
      select: { id: true },
    });

    const uncheckedDevices = devices.filter(
      (device: { id: number }) => !this.connectionStatus.has(device.id)
    );

    if (uncheckedDevices.length > 0) {
      await Promise.all(
        uncheckedDevices.map((device: { id: number }) => this.checkDeviceConnection(device.id))
      );
    }

    const statuses: ConnectionStatus[] = devices.map((device: { id: number }) => {
      const status = this.connectionStatus.get(device.id);
      if (status) return status;
      return {
        deviceId: device.id,
        isConnected: false,
        lastPingAt: null,
        errorCount: 0,
      };
    });

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
    this.startMonitoring();
    try {
      await this.checkAllDevices();
    } catch (error) {
      console.error(`[ConnectionManager] Error during initial check:`, error);
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();

