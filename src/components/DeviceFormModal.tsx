import { useState, useEffect } from "react";
import { devicesApi, type Device, type CreateDeviceRequest, type UpdateDeviceRequest } from "../api/backendClient";

interface DeviceFormModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export function DeviceFormModal({ device, isOpen, onClose, onSave }: DeviceFormModalProps) {
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when device changes or modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (device) {
        setName(device.name);
        setIpAddress(device.ipAddress);
        setMacAddress(device.macAddress || "");
      } else {
        setName("");
        setIpAddress("");
        setMacAddress("");
      }
      setErrors({});
    }
  }, [device, isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const validateIP = (ip: string): boolean => {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  };

  const validateMAC = (mac: string): boolean => {
    if (!mac) return true; // MAC is optional
    return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!ipAddress.trim()) {
      newErrors.ipAddress = "IP address is required";
    } else if (!validateIP(ipAddress)) {
      newErrors.ipAddress = "Invalid IP address format (e.g., 192.168.1.100)";
    }

    if (macAddress && !validateMAC(macAddress)) {
      newErrors.macAddress = "Invalid MAC address format (e.g., AA:BB:CC:DD:EE:FF)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const deviceData: CreateDeviceRequest | UpdateDeviceRequest = {
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        macAddress: macAddress.trim() || null,
      };

      if (device) {
        await devicesApi.update(device.id, deviceData);
      } else {
        await devicesApi.create(deviceData as CreateDeviceRequest);
      }

      await onSave();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save device";
      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">
              {device ? "Edit Device" : "Add Device"}
            </h2>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-white disabled:opacity-50"
              aria-label="Close"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3 py-2 bg-gray-700 border rounded text-white placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                  ${errors.name ? "border-red-500" : "border-gray-600"}`}
                placeholder="Device Name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-400">{errors.name}</p>
              )}
            </div>

            {/* IP Address Field */}
            <div>
              <label htmlFor="ipAddress" className="block text-sm font-medium text-gray-300 mb-1">
                IP Address <span className="text-red-400">*</span>
              </label>
              <input
                id="ipAddress"
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3 py-2 bg-gray-700 border rounded text-white placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                  ${errors.ipAddress ? "border-red-500" : "border-gray-600"}`}
                placeholder="192.168.1.100"
              />
              {errors.ipAddress && (
                <p className="mt-1 text-sm text-red-400">{errors.ipAddress}</p>
              )}
            </div>

            {/* MAC Address Field */}
            <div>
              <label htmlFor="macAddress" className="block text-sm font-medium text-gray-300 mb-1">
                MAC Address <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <input
                id="macAddress"
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3 py-2 bg-gray-700 border rounded text-white placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                  ${errors.macAddress ? "border-red-500" : "border-gray-600"}`}
                placeholder="AA:BB:CC:DD:EE:FF"
              />
              {errors.macAddress && (
                <p className="mt-1 text-sm text-red-400">{errors.macAddress}</p>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                {errors.submit}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                {isLoading ? "Saving..." : device ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

