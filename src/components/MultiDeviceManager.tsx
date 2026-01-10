import { useMultiDevice } from "../hooks/useMultiDevice";
import { presetsApi, devicesApi, type Preset, type Device } from "../api/backendClient";
import { useState, useEffect } from "react";
import { DeviceFormModal } from "./DeviceFormModal";

interface MultiDeviceManagerProps {
  onDeviceSelect?: (deviceIds: number[]) => void;
  selectedDeviceIds?: number[];
}

export function MultiDeviceManager({
  onDeviceSelect,
  selectedDeviceIds = [],
}: MultiDeviceManagerProps) {
  const {
    devices,
    loading,
    error,
    reconnectDevice,
    applyPresetToDevices,
    refreshDevices,
    getDeviceConnectionStatus,
    fetchConnectionStatuses,
  } = useMultiDevice();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  useEffect(() => {
    presetsApi.getAll().then(setPresets).catch(console.error);
  }, []);

  const handleDeviceToggle = (deviceId: number) => {
    if (!onDeviceSelect) return;

    if (selectedDeviceIds.includes(deviceId)) {
      onDeviceSelect(selectedDeviceIds.filter((id) => id !== deviceId));
    } else {
      onDeviceSelect([...selectedDeviceIds, deviceId]);
    }
  };

  const handleSelectAll = () => {
    if (!onDeviceSelect) return;
    const connectedDeviceIds = devices
      .filter((device) => getDeviceConnectionStatus(device.id)?.isConnected)
      .map((device) => device.id);
    onDeviceSelect(connectedDeviceIds);
  };

  const handleDeselectAll = () => {
    if (!onDeviceSelect) return;
    onDeviceSelect([]);
  };

  const handleReconnect = async (deviceId: number) => {
    try {
      await reconnectDevice(deviceId);
      // Force refresh connection statuses after reconnect
      await fetchConnectionStatuses();
    } catch (error) {
      console.error("Failed to reconnect device:", error);
      // Still try to refresh status in case it partially worked
      await fetchConnectionStatuses();
    }
  };

  const handleApplyPreset = async () => {
    if (!selectedPresetId || selectedDeviceIds.length === 0) return;

    setApplyingPreset(true);
    try {
      await applyPresetToDevices(selectedPresetId, selectedDeviceIds);
    } catch (error) {
      console.error("Failed to apply preset:", error);
    } finally {
      setApplyingPreset(false);
    }
  };

  const handleAddDevice = () => {
    setEditingDevice(null);
    setIsModalOpen(true);
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setIsModalOpen(true);
  };

  const handleDeleteDevice = async (deviceId: number) => {
    if (!window.confirm("Are you sure you want to delete this device? This action cannot be undone.")) {
      return;
    }

    try {
      await devicesApi.delete(deviceId);
      await refreshDevices();
    } catch (error) {
      console.error("Failed to delete device:", error);
      alert(error instanceof Error ? error.message : "Failed to delete device");
    }
  };

  const handleSaveDevice = async () => {
    await refreshDevices();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDevice(null);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Device Manager</h2>
        <p className="text-gray-400">Loading devices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Device Manager</h2>
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={refreshDevices}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Device Manager</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleAddDevice}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
            >
              Add Device
            </button>
            {onDeviceSelect && (
              <>
                <button
                  onClick={handleSelectAll}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                >
                  Select All Connected
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm"
                >
                  Deselect All
                </button>
              </>
            )}
            <button
              onClick={refreshDevices}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

      {/* Preset Application */}
      {onDeviceSelect && selectedDeviceIds.length > 0 && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Apply Preset to Selected Devices</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Preset</label>
              <select
                value={selectedPresetId || ""}
                onChange={(e) =>
                  setSelectedPresetId(e.target.value ? parseInt(e.target.value) : null)
                }
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
              >
                <option value="">Select a preset...</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleApplyPreset}
              disabled={!selectedPresetId || applyingPreset}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
            >
              {applyingPreset ? "Applying..." : "Apply Preset"}
            </button>
          </div>
        </div>
      )}

      {/* Device List */}
      <div className="space-y-2">
        {devices.length === 0 ? (
          <p className="text-gray-400">No devices found.</p>
        ) : (
          devices.map((device) => {
            const connectionStatus = getDeviceConnectionStatus(device.id);
            const isConnected = connectionStatus?.isConnected ?? false;
            const isSelected = selectedDeviceIds.includes(device.id);

            return (
              <div
                key={device.id}
                className={`p-4 rounded-lg border ${
                  isSelected
                    ? "bg-blue-900 border-blue-500"
                    : "bg-gray-700 border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {onDeviceSelect && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleDeviceToggle(device.id)}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{device.name}</h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            isConnected
                              ? "bg-green-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {isConnected ? "Connected" : "Disconnected"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{device.ipAddress}</p>
                      {connectionStatus && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last ping:{" "}
                          {connectionStatus.lastPingAt
                            ? new Date(connectionStatus.lastPingAt).toLocaleTimeString()
                            : "Never"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditDevice(device)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                      title="Edit device"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                      title="Delete device"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleReconnect(device.id)}
                      disabled={isConnected}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed rounded text-white text-sm"
                      title="Reconnect device"
                    >
                      Reconnect
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* Device Form Modal */}
      <DeviceFormModal
        device={editingDevice}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveDevice}
      />
    </>
  );
}

