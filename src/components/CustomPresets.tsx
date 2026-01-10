/**
 * Custom Presets Component
 * Allows users to save and apply custom presets (color + brightness)
 */

import { useState, useEffect } from "react";
import type { WLEDColor, CustomPreset } from "../types/wled";
import { getPresets, savePreset, deletePreset } from "../utils/presets";

interface CustomPresetsProps {
  color: WLEDColor;
  brightness: number;
  onApplyPreset: (color: WLEDColor, brightness: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * Converts WLED color array [R, G, B, W] to hex string
 */
function colorToHex(color: WLEDColor): string {
  const [r, g, b] = color;
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("")}`;
}

export function CustomPresets({
  color,
  brightness,
  onApplyPreset,
  disabled = false,
}: CustomPresetsProps) {
  const [presets, setPresets] = useState<CustomPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState<string | null>(null);

  // Ensure brightness is always a valid number
  const validBrightness = (brightness != null && !isNaN(brightness) && brightness >= 1 && brightness <= 255)
    ? brightness
    : 127;

  // Load presets on mount and when they change
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const loadedPresets = await getPresets();
        setPresets(loadedPresets);
      } catch (error) {
        console.error("Failed to load presets:", error);
      }
    };
    loadPresets();
  }, []);

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const newPreset = await savePreset({
        name: presetName.trim(),
        color,
        brightness: validBrightness,
      });
      setPresets([...presets, newPreset]);
      setPresetName("");
    } catch (error) {
      console.error("Failed to save preset:", error);
      alert("Failed to save preset. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyPreset = async (preset: CustomPreset) => {
    setIsApplying(preset.id);
    try {
      await onApplyPreset(preset.color, preset.brightness);
    } finally {
      setIsApplying(null);
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent any event bubbling
    console.log("Delete button clicked for preset:", id);
    
    try {
      const success = await deletePreset(id);
      console.log("Delete result:", success);
      
      if (success) {
        setPresets(prevPresets => prevPresets.filter(p => p.id !== id));
        console.log("Preset deleted, updating state");
      } else {
        console.error("Failed to delete preset:", id);
        // Reload presets from storage in case of mismatch
        const loadedPresets = await getPresets();
        setPresets(loadedPresets);
      }
    } catch (error) {
      console.error("Error deleting preset:", error);
      alert("Failed to delete preset. Please try again.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSavePreset();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Custom Presets</h2>
      
      {/* Save Current Settings */}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <label htmlFor="preset-name" className="block text-sm font-medium text-gray-300 mb-2">
          Save Current Settings
        </label>
        <div className="flex gap-2">
          <input
            id="preset-name"
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled || isSaving}
            placeholder="Enter preset name..."
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg border border-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSavePreset}
            disabled={disabled || isSaving || !presetName.trim()}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Current: Color {colorToHex(color)} • Brightness {Math.round((validBrightness / 255) * 100)}%
        </div>
      </div>

      {/* Saved Presets List */}
      {presets.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Saved Presets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors relative"
              >
                <div
                  className="w-12 h-12 rounded border-2 border-gray-600 flex-shrink-0"
                  style={{ backgroundColor: colorToHex(preset.color) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{preset.name}</div>
                  <div className="text-xs text-gray-400">
                    {preset.brightness != null && !isNaN(preset.brightness) 
                      ? `${Math.round((preset.brightness / 255) * 100)}% brightness`
                      : "Invalid brightness"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleApplyPreset(preset)}
                    disabled={disabled || isApplying === preset.id}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Apply preset"
                  >
                    {isApplying === preset.id ? "..." : "Apply"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      console.log("Delete button clicked, preset ID:", preset.id);
                      handleDeletePreset(preset.id, e);
                    }}
                    disabled={disabled || isApplying === preset.id}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer relative z-10"
                    title="Delete preset"
                    aria-label={`Delete preset ${preset.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No presets saved yet.</p>
          <p className="text-sm mt-1">Set a color and brightness, then save it as a preset!</p>
        </div>
      )}
    </div>
  );
}

