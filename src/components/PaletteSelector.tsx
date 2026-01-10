/**
 * Palette Selector Component
 * Allows users to select from available WLED palettes
 */

import { useState } from "react";

interface PaletteSelectorProps {
  palettes: string[];
  currentPalette: number;
  onPaletteChange: (paletteIndex: number) => Promise<void>;
  disabled?: boolean;
}

export function PaletteSelector({
  palettes,
  currentPalette,
  onPaletteChange,
  disabled = false,
}: PaletteSelectorProps) {
  const [loading, setLoading] = useState(false);

  const handlePaletteChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = parseInt(e.target.value, 10);
    if (isNaN(newIndex) || newIndex < 0 || newIndex >= palettes.length) {
      return;
    }

    setLoading(true);
    try {
      await onPaletteChange(newIndex);
    } finally {
      setLoading(false);
    }
  };

  if (palettes.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto">
      <label htmlFor="palette-select" className="block text-sm font-medium text-gray-300 mb-2">
        Color Palette
      </label>
      <div className="relative">
        <select
          id="palette-select"
          value={currentPalette}
          onChange={handlePaletteChange}
          disabled={disabled || loading}
          className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {palettes.map((palette, index) => (
            <option key={index} value={index}>
              {palette === "RSVD" || palette === "-" ? `[Reserved ${index}]` : palette}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
          ) : (
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </div>
      {currentPalette >= 0 && currentPalette < palettes.length && (
        <p className="mt-2 text-xs text-gray-400">
          Selected: <span className="text-yellow-400">{palettes[currentPalette]}</span>
        </p>
      )}
    </div>
  );
}

