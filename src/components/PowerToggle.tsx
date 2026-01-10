/**
 * Power Toggle Component
 * Large, prominent button to turn WLED device on/off
 */

import { useState } from "react";

interface PowerToggleProps {
  power: boolean;
  onToggle: () => Promise<void>;
  disabled?: boolean;
}

export function PowerToggle({ power, onToggle, disabled = false }: PowerToggleProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    try {
      await onToggle();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`
        w-32 h-32 rounded-full font-bold text-xl transition-all duration-300
        focus:outline-none focus:ring-4 focus:ring-offset-4 focus:ring-offset-gray-900
        ${power
          ? "bg-yellow-400 hover:bg-yellow-500 text-gray-900 shadow-lg shadow-yellow-400/50"
          : "bg-gray-700 hover:bg-gray-600 text-gray-300 shadow-lg"
        }
        ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${isLoading ? "animate-pulse" : ""}
      `}
    >
      {isLoading ? (
        <span className="text-sm">...</span>
      ) : power ? (
        "ON"
      ) : (
        "OFF"
      )}
    </button>
  );
}

