/**
 * Preset Selector Component
 * Allows users to apply WLED presets by ID
 */

import { useState, useEffect } from "react";

interface PresetSelectorProps {
  currentPreset: number | null;
  onPresetChange: (presetId: number | null) => Promise<void>;
  disabled?: boolean;
}

export function PresetSelector({
  currentPreset,
  onPresetChange,
  disabled = false,
}: PresetSelectorProps) {
  const [presetInput, setPresetInput] = useState<string>(currentPreset !== null ? String(currentPreset) : "");
  const [loading, setLoading] = useState(false);

  // Sync input with current preset when it changes externally
  useEffect(() => {
    if (currentPreset !== null) {
      setPresetInput(String(currentPreset));
    }
  }, [currentPreset]);

  const handleApplyPreset = async () => {
    const presetId = presetInput.trim() === "" ? null : parseInt(presetInput.trim(), 10);
    
    if (presetInput.trim() !== "" && (isNaN(presetId) || presetId < 0 || presetId > 250)) {
      return;
    }

    setLoading(true);
    try {
      await onPresetChange(presetId);
    } finally {
      setLoading(false);
    }
  };

  const handleClearPreset = async () => {
    setPresetInput("");
    setLoading(true);
    try {
      await onPresetChange(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleApplyPreset();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto">
      <label htmlFor="preset-input" className="block text-sm font-medium text-gray-300 mb-2">
        Preset ID (0-250)
      </label>
      <div className="flex gap-2">
        <input
          id="preset-input"
          type="number"
          min="0"
          max="250"
          value={presetInput}
          onChange={(e) => setPresetInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled || loading}
          placeholder="Enter preset ID..."
          className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleApplyPreset}
          disabled={disabled || loading}
          className="px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            "Apply"
          )}
        </button>
        {currentPreset !== null && (
          <button
            onClick={handleClearPreset}
            disabled={disabled || loading}
            className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            title="Clear preset"
          >
            ✕
          </button>
        )}
      </div>
      {currentPreset !== null && (
        <p className="mt-2 text-xs text-gray-400">
          Active preset: <span className="text-yellow-400">{currentPreset}</span>
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        Note: Presets must be configured on your WLED device first
      </p>
    </div>
  );
}

