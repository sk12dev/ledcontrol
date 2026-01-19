/**
 * Color Picker Component
 * Allows users to select RGB color for WLED device
 */

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import type { WLEDColor } from "../types/wled";

interface ColorPickerProps {
  color: WLEDColor;
  onColorChange: (color: WLEDColor) => Promise<void>;
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

/**
 * Converts hex string to WLED color array [R, G, B, W]
 */
function hexToColor(hex: string): WLEDColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      0, // White channel
    ];
  }
  return [255, 160, 0, 0]; // Default orange
}

export function ColorPicker({ color, onColorChange, disabled = false }: ColorPickerProps) {
  const [hexColor, setHexColor] = useState<string>(colorToHex(color));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setHexColor(colorToHex(color));
  }, [color]);

  const handleColorChange = async (newHex: string) => {
    setHexColor(newHex);
    
    if (disabled || isLoading) return;

    const newColor = hexToColor(newHex);
    setIsLoading(true);
    try {
      await onColorChange(newColor);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
      <div className="mb-2">
        <label htmlFor="color-picker" className="text-zinc-300 text-sm font-medium block cursor-pointer">
          Color
        </label>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-3">
          <input
            id="color-picker"
            type="color"
            value={hexColor}
            onChange={(e) => handleColorChange(e.target.value)}
            disabled={disabled || isLoading}
            className="w-16 h-16 rounded-md border-2 border-zinc-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 p-0"
            style={{
              WebkitAppearance: "none",
              appearance: "none",
            }}
          />
          <Input
            type="text"
            value={hexColor}
            onChange={(e) => {
              const value = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                setHexColor(value);
                if (value.length === 7) {
                  handleColorChange(value);
                }
              }
            }}
            disabled={disabled || isLoading}
            placeholder="#FFA000"
            className="flex-1 bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Updating...</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 text-sm text-zinc-400">
        <span>RGB:</span>
        <span className="font-mono">
          ({color[0]}, {color[1]}, {color[2]})
        </span>
      </div>
    </div>
  );
}
