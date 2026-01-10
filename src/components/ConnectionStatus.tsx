/**
 * Connection Status Component
 * Displays connection state and device information
 */

import type { ConnectionStatus, WLEDInfo } from "../types/wled";

interface ConnectionStatusProps {
  status: ConnectionStatus;
  deviceInfo: WLEDInfo | null;
  error: string | null;
  onRefresh?: () => Promise<void>;
}

export function ConnectionStatus({ status, deviceInfo, error, onRefresh }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "text-green-400";
      case "connecting":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            status === "connected" ? "bg-green-400" :
            status === "connecting" ? "bg-yellow-400 animate-pulse" :
            status === "error" ? "bg-red-400" :
            "bg-gray-400"
          }`} />
          <span className={`font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={status === "connecting"}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {deviceInfo && status === "connected" && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-400">
          <div>
            <span className="text-gray-500">Device:</span>{" "}
            <span className="text-gray-300 font-medium">{deviceInfo.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Version:</span>{" "}
            <span className="text-gray-300 font-medium">{deviceInfo.ver}</span>
          </div>
          <div>
            <span className="text-gray-500">LEDs:</span>{" "}
            <span className="text-gray-300 font-medium">{deviceInfo.leds.count}</span>
          </div>
          <div>
            <span className="text-gray-500">Uptime:</span>{" "}
            <span className="text-gray-300 font-medium">
              {Math.floor(deviceInfo.uptime / 3600)}h
            </span>
          </div>
        </div>
      )}

      {status === "disconnected" && !error && (
        <p className="mt-2 text-sm text-gray-500">
          Configure IP address above to connect
        </p>
      )}
    </div>
  );
}

