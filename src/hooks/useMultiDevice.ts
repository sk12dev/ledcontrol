import { useState, useEffect, useCallback } from "react";
import {
  devicesApi,
  connectionApi,
  executionApi,
  type Device,
  type ConnectionStatus,
} from "../api/backendClient";

interface UseMultiDeviceReturn {
  devices: Device[];
  connectionStatuses: ConnectionStatus[];
  loading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
  fetchConnectionStatuses: () => Promise<void>;
  reconnectDevice: (deviceId: number) => Promise<void>;
  applyPresetToDevices: (presetId: number, deviceIds: number[]) => Promise<void>;
  refreshDevices: () => Promise<void>;
  getDeviceConnectionStatus: (deviceId: number) => ConnectionStatus | null;
  getConnectedDevices: () => Device[];
}

export function useMultiDevice(): UseMultiDeviceReturn {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<ConnectionStatus[]>([]);
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
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to apply preset";
        setError(errorMessage);
        console.error("Error applying preset:", err);
        throw err;
      }
    },
    []
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

  return {
    devices,
    connectionStatuses,
    loading,
    error,
    fetchDevices,
    fetchConnectionStatuses,
    reconnectDevice,
    applyPresetToDevices,
    refreshDevices,
    getDeviceConnectionStatus,
    getConnectedDevices,
  };
}

