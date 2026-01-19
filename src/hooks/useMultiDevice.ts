import { useState, useEffect, useCallback } from "react";
import {
  devicesApi,
  connectionApi,
  executionApi,
  type Device,
  type ConnectionStatus,
} from "../api/backendClient";
import { getState } from "../api/wledClient";

export interface DeviceState {
  deviceId: number;
  isOn: boolean;
  brightness: number; // 0-255
  color: [number, number, number, number]; // [R, G, B, W]
  lastUpdated: number; // timestamp
}

interface UseMultiDeviceReturn {
  devices: Device[];
  connectionStatuses: ConnectionStatus[];
  deviceStates: Map<number, DeviceState>;
  loading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
  fetchConnectionStatuses: () => Promise<void>;
  fetchDeviceState: (deviceId: number) => Promise<void>;
  refreshDeviceStates: () => Promise<void>;
  reconnectDevice: (deviceId: number) => Promise<void>;
  applyPresetToDevices: (presetId: number, deviceIds: number[]) => Promise<void>;
  refreshDevices: () => Promise<void>;
  getDeviceConnectionStatus: (deviceId: number) => ConnectionStatus | null;
  getDeviceState: (deviceId: number) => DeviceState | null;
  getConnectedDevices: () => Device[];
}

export function useMultiDevice(): UseMultiDeviceReturn {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<ConnectionStatus[]>([]);
  const [deviceStates, setDeviceStates] = useState<Map<number, DeviceState>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await devicesApi.getAll();
      setDevices(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch devices";
      setError(errorMessage);
      console.error("Error fetching devices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConnectionStatuses = useCallback(async () => {
    try {
      console.log("[Frontend] Fetching connection statuses...");
      const statuses = await connectionApi.getAllStatuses();
      console.log("[Frontend] Received connection statuses:", statuses);
      setConnectionStatuses(statuses);
    } catch (err) {
      console.error("[Frontend] Error fetching connection statuses:", err);
      // Don't set error here, just log it
    }
  }, []);

  const fetchDeviceState = useCallback(async (deviceId: number) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) {
      console.warn(`[Frontend] Device ${deviceId} not found`);
      return;
    }

    const status = connectionStatuses.find((s) => s.deviceId === deviceId);
    if (!status?.isConnected) {
      // Device not connected, don't try to fetch state
      return;
    }

    try {
      const wledState = await getState(device.ipAddress);
      
      // Extract color from first segment
      let color: [number, number, number, number] = [255, 160, 0, 0]; // Default orange
      if (wledState.seg && wledState.seg.length > 0 && wledState.seg[0].col && wledState.seg[0].col[0]) {
        const [r, g, b, w = 0] = wledState.seg[0].col[0];
        color = [r, g, b, w];
      }

      const deviceState: DeviceState = {
        deviceId,
        isOn: wledState.on === true,
        brightness: wledState.bri ?? 128,
        color,
        lastUpdated: Date.now(),
      };

      setDeviceStates((prev) => {
        const next = new Map(prev);
        next.set(deviceId, deviceState);
        return next;
      });
    } catch (err) {
      console.error(`[Frontend] Error fetching state for device ${deviceId}:`, err);
      // Don't update state on error, keep previous state
    }
  }, [devices, connectionStatuses]);

  const refreshDeviceStates = useCallback(async () => {
    const connectedDevices = devices.filter((device) => {
      const status = connectionStatuses.find((s) => s.deviceId === device.id);
      return status?.isConnected === true;
    });

    // Fetch states for all connected devices in parallel
    await Promise.all(connectedDevices.map((device) => fetchDeviceState(device.id)));
  }, [devices, connectionStatuses, fetchDeviceState]);

  const reconnectDevice = useCallback(async (deviceId: number): Promise<void> => {
    try {
      setError(null);
      await connectionApi.reconnect(deviceId);
      await fetchConnectionStatuses(); // Refresh statuses
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reconnect device";
      setError(errorMessage);
      console.error("Error reconnecting device:", err);
      throw err;
    }
  }, [fetchConnectionStatuses]);

  const applyPresetToDevices = useCallback(
    async (presetId: number, deviceIds: number[]): Promise<void> => {
      try {
        setError(null);
        await executionApi.applyPreset(presetId, deviceIds);
        // Refresh device states after applying preset
        await Promise.all(deviceIds.map((id) => fetchDeviceState(id)));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to apply preset";
        setError(errorMessage);
        console.error("Error applying preset:", err);
        throw err;
      }
    },
    [fetchDeviceState]
  );

  const refreshDevices = useCallback(async (): Promise<void> => {
    await fetchDevices();
    await fetchConnectionStatuses();
  }, [fetchDevices, fetchConnectionStatuses]);

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Fetch connection statuses on mount and periodically
  useEffect(() => {
    fetchConnectionStatuses();

    const interval = setInterval(() => {
      fetchConnectionStatuses();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [fetchConnectionStatuses]);

  // Get connection status for a specific device
  const getDeviceConnectionStatus = useCallback(
    (deviceId: number): ConnectionStatus | null => {
      return connectionStatuses.find((status) => status.deviceId === deviceId) || null;
    },
    [connectionStatuses]
  );

  // Get connected devices
  const getConnectedDevices = useCallback((): Device[] => {
    const connectedDeviceIds = connectionStatuses
      .filter((status) => status.isConnected)
      .map((status) => status.deviceId);

    return devices.filter((device) => connectedDeviceIds.includes(device.id));
  }, [devices, connectionStatuses]);

  // Get device state
  const getDeviceState = useCallback(
    (deviceId: number): DeviceState | null => {
      return deviceStates.get(deviceId) || null;
    },
    [deviceStates]
  );

  // Fetch device states when connection statuses change
  useEffect(() => {
    if (connectionStatuses.length > 0 && devices.length > 0) {
      refreshDeviceStates();
    }
  }, [connectionStatuses, devices, refreshDeviceStates]);

  // Poll device states periodically for connected devices
  useEffect(() => {
    const interval = setInterval(() => {
      refreshDeviceStates();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [refreshDeviceStates]);

  return {
    devices,
    connectionStatuses,
    deviceStates,
    loading,
    error,
    fetchDevices,
    fetchConnectionStatuses,
    fetchDeviceState,
    refreshDeviceStates,
    reconnectDevice,
    applyPresetToDevices,
    refreshDevices,
    getDeviceConnectionStatus,
    getDeviceState,
    getConnectedDevices,
  };
}

