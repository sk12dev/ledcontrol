/**
 * Color Preset Selector Component
 * Allows users to select from saved color presets when creating cues
 */

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import type { WLEDColor } from "../types/wled";
import { colorPresetsApi, type ColorPreset, type CreateColorPresetRequest } from "../api/backendClient";

interface ColorPresetSelectorProps {
  selectedColor: WLEDColor | null;
  onColorSelect: (color: WLEDColor) => void;
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

export function ColorPresetSelector({
  selectedColor,
  onColorSelect,
  disabled = false,
}: ColorPresetSelectorProps) {
  const [colorPresets, setColorPresets] = useState<ColorPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load color presets on mount
  useEffect(() => {
    const loadColorPresets = async () => {
      try {
        setIsLoading(true);
        const presets = await colorPresetsApi.getAll();
        setColorPresets(presets);
      } catch (error) {
        console.error("Failed to load color presets:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadColorPresets();
  }, []);

  const handleSavePreset = async () => {
    if (!presetName.trim() || !selectedColor) {
      return;
    }

    setIsSaving(true);
    try {
      const newPreset: CreateColorPresetRequest = {
        name: presetName.trim(),
        color: selectedColor,
      };
      const savedPreset = await colorPresetsApi.create(newPreset);
      setColorPresets([...colorPresets, savedPreset]);
      setPresetName("");
    } catch (error) {
      console.error("Failed to save color preset:", error);
      alert("Failed to save color preset. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectPreset = (preset: ColorPreset) => {
    onColorSelect(preset.color);
  };

  const handleDeletePreset = async (id: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this color preset?")) {
      return;
    }

    setIsDeleting(id);
    try {
      await colorPresetsApi.delete(id);
      setColorPresets(colorPresets.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error deleting color preset:", error);
      alert("Failed to delete color preset. Please try again.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSavePreset();
    }
  };

  return (
    <div className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
      <h4 className="text-sm font-semibold text-zinc-300 mb-3">
        Color Presets
      </h4>

      {/* Save Current Color */}
      {selectedColor && (
        <div className="mb-4 p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
          <p className="text-xs text-zinc-400 mb-2">
            Save Current Color
          </p>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-md border-2 border-zinc-600 flex-shrink-0"
              style={{ backgroundColor: colorToHex(selectedColor) }}
            />
            <Input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled || isSaving}
              placeholder="Enter preset name..."
              className="flex-1 bg-zinc-800 border-zinc-700 text-white"
            />
            <Button
              onClick={handleSavePreset}
              disabled={disabled || isSaving || !presetName.trim()}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Saved Color Presets */}
      {isLoading ? (
        <p className="text-sm text-zinc-400 text-center py-4">
          Loading presets...
        </p>
      ) : colorPresets.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {colorPresets.map((preset) => (
            <div key={preset.id}>
              <div
                className={`flex items-center gap-2 p-2 bg-zinc-800 border border-zinc-700 rounded-lg transition-colors ${
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-750"
                }`}
                onClick={() => !disabled && handleSelectPreset(preset)}
              >
                <div
                  className="w-10 h-10 rounded-md border-2 border-zinc-600 flex-shrink-0"
                  style={{ backgroundColor: colorToHex(preset.color) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {preset.name}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {colorToHex(preset.color)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) {
                      handleDeletePreset(preset.id, e as any);
                    }
                  }}
                  disabled={disabled || isDeleting === preset.id}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                  aria-label={`Delete preset ${preset.name}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-zinc-500">
          <p className="text-sm">No color presets saved yet.</p>
          <p className="text-xs mt-1">
            Select a color and save it as a preset!
          </p>
        </div>
      )}
    </div>
  );
}
