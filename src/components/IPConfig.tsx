/**
 * IP Configuration Component
 * Allows users to configure and save the WLED device IP address
 */

import { useState, useEffect } from "react";
import { getWLEDIP, setWLEDIP, isValidIP } from "../utils/config";

interface IPConfigProps {
  onIPChange: (ip: string) => void;
  currentIP: string;
}

export function IPConfig({ onIPChange, currentIP }: IPConfigProps) {
  const [inputIP, setInputIP] = useState<string>(currentIP);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setInputIP(currentIP);
  }, [currentIP]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    setLoading(true);

    if (inputIP.trim() === "") {
      setError("IP address cannot be empty");
      setLoading(false);
      return;
    }

    if (!isValidIP(inputIP)) {
      setError("Invalid IP address format");
      setLoading(false);
      return;
    }

    try {
      const success = await setWLEDIP(inputIP);
      if (success) {
        setSaved(true);
        onIPChange(inputIP);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError("Failed to save IP address");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save IP address");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-gray-800 rounded-lg shadow-lg">
      <label htmlFor="wled-ip" className="block text-sm font-medium text-gray-300 mb-2">
        WLED Device IP Address
      </label>
      <div className="flex gap-2">
        <input
          id="wled-ip"
          type="text"
          value={inputIP}
          onChange={(e) => {
            setInputIP(e.target.value);
            setError(null);
            setSaved(false);
          }}
          onKeyPress={handleKeyPress}
          placeholder="192.168.1.100"
          disabled={loading}
          className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
      {saved && (
        <p className="mt-2 text-sm text-green-400">IP address saved!</p>
      )}
      {currentIP && !error && !saved && (
        <p className="mt-2 text-sm text-gray-400">Current: {currentIP}</p>
      )}
    </div>
  );
}
