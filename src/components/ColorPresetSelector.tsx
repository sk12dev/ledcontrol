/**
 * Color Preset Selector Component
 * Compact dropdown to pick a preset; optional save current and manage presets.
 */

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type { WLEDColor } from "../types/wled";
import { colorPresetsApi, type ColorPreset, type CreateColorPresetRequest } from "../api/backendClient";

interface ColorPresetSelectorProps {
  selectedColor: WLEDColor | null;
  onColorSelect: (color: WLEDColor) => void;
  disabled?: boolean;
}

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
  const [manageOpen, setManageOpen] = useState(false);

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
    if (!presetName.trim() || !selectedColor) return;
    setIsSaving(true);
    try {
      const newPreset: CreateColorPresetRequest = {
        name: presetName.trim(),
        color: selectedColor,
      };
      const savedPreset = await colorPresetsApi.create(newPreset);
      setColorPresets((prev) => [...prev, savedPreset]);
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
    if (!confirm("Are you sure you want to delete this color preset?")) return;
    setIsDeleting(id);
    try {
      await colorPresetsApi.delete(id);
      setColorPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting color preset:", error);
      alert("Failed to delete color preset. Please try again.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSavePreset();
  };

  return (
    <div className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value=""
          onValueChange={(value) => {
            const preset = colorPresets.find((p) => p.id === parseInt(value, 10));
            if (preset && !disabled) handleSelectPreset(preset);
          }}
          disabled={disabled || isLoading}
        >
          <SelectTrigger className="h-8 text-sm bg-zinc-800 border-zinc-700 text-zinc-300 w-[180px] data-[slot=select-trigger]">
            <SelectValue placeholder="Presets..." />
          </SelectTrigger>
          <SelectContent>
            {colorPresets.length === 0 ? (
              <div className="py-4 text-center text-sm text-zinc-500">No presets saved</div>
            ) : (
              colorPresets.map((preset) => (
                <SelectItem key={preset.id} value={String(preset.id)}>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded border border-zinc-600 flex-shrink-0"
                      style={{ backgroundColor: colorToHex(preset.color) }}
                    />
                    <span className="truncate">{preset.name}</span>
                    <span className="text-zinc-500 text-xs truncate">{colorToHex(preset.color)}</span>
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {selectedColor && (
          <>
            <Input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={disabled || isSaving}
              placeholder="Save as..."
              className="h-8 text-sm flex-1 min-w-[100px] max-w-[140px] bg-zinc-800 border-zinc-700 text-white"
            />
            <Button
              onClick={handleSavePreset}
              disabled={disabled || isSaving || !presetName.trim()}
              size="sm"
              className="h-8 text-sm bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? "..." : "Save"}
            </Button>
          </>
        )}
      </div>

      {colorPresets.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setManageOpen((o) => !o)}
            className="text-xs text-zinc-500 hover:text-zinc-400"
          >
            {manageOpen ? "Hide presets" : "Manage presets"}
          </button>
          {manageOpen && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto rounded border border-zinc-700 bg-zinc-800 p-2">
              {colorPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center gap-2 py-1 px-2 rounded hover:bg-zinc-700/50"
                >
                  <span
                    className="w-5 h-5 rounded border border-zinc-600 flex-shrink-0"
                    style={{ backgroundColor: colorToHex(preset.color) }}
                  />
                  <span className="text-sm text-white truncate flex-1 min-w-0">{preset.name}</span>
                  <span className="text-xs text-zinc-500">{colorToHex(preset.color)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    disabled={disabled || isDeleting === preset.id}
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                    aria-label={`Delete ${preset.name}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
