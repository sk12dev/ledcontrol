/**
 * Brightness Slider Component
 * Allows users to adjust brightness (1-255)
 */

import { useState, useEffect } from "react";

interface BrightnessSliderProps {
  brightness: number;
  onBrightnessChange: (brightness: number) => Promise<void>;
  disabled?: boolean;
}

export function BrightnessSlider({
  brightness,
  onBrightnessChange,
  disabled = false,
}: BrightnessSliderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [localBrightness, setLocalBrightness] = useState(() => {
    // Ensure we have a valid initial value
    const initialValue = brightness || 127;
    return Math.max(1, Math.min(255, initialValue));
  });

  useEffect(() => {
    if (brightness != null && !isNaN(brightness)) {
      const clampedValue = Math.max(1, Math.min(255, brightness));
      setLocalBrightness(clampedValue);
    }
  }, [brightness]);

  const handleChange = async (value: number) => {
    const clampedValue = Math.max(1, Math.min(255, value));
    setLocalBrightness(clampedValue);
    
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      await onBrightnessChange(clampedValue);
    } finally {
      setIsLoading(false);
    }
  };

  // Use localBrightness for display to avoid NaN during slider movement
  const displayBrightness = localBrightness || brightness || 127;
  const percentage = Math.round((displayBrightness / 255) * 100);

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-gray-800 rounded-lg shadow-lg">
      <label htmlFor="brightness-slider" className="block text-sm font-medium text-gray-300 mb-2">
        Brightness
      </label>
      <div className="flex items-center gap-4">
        <input
          id="brightness-slider"
          type="range"
          min="1"
          max="255"
          value={displayBrightness}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value)) {
              handleChange(value);
            }
          }}
          disabled={disabled || isLoading}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="w-20 text-right">
          <span className="text-lg font-mono text-white">{percentage}%</span>
          <span className="text-xs text-gray-400 block">({displayBrightness})</span>
        </div>
      </div>
      {isLoading && (
        <div className="mt-2 text-xs text-gray-400">Updating...</div>
      )}
    </div>
  );
}

