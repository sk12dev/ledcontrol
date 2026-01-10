/**
 * Color Picker Component
 * Allows users to select RGB color for WLED device
 */

import { useState, useEffect } from "react";
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
    <div className="w-full max-w-md mx-auto p-4 bg-gray-800 rounded-lg shadow-lg">
      <label htmlFor="color-picker" className="block text-sm font-medium text-gray-300 mb-2">
        Color
      </label>
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-3">
          <input
            id="color-picker"
            type="color"
            value={hexColor}
            onChange={(e) => handleColorChange(e.target.value)}
            disabled={disabled || isLoading}
            className="w-16 h-16 rounded border-2 border-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <input
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
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            placeholder="#FFA000"
          />
        </div>
        {isLoading && (
          <div className="text-gray-400 text-sm">Updating...</div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
        <span>RGB:</span>
        <span className="font-mono">
          ({color[0]}, {color[1]}, {color[2]})
        </span>
      </div>
    </div>
  );
}

