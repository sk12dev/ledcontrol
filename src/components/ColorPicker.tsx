/**
 * Color Picker Component
 * Allows users to select RGB color for WLED device
 */

import { useState, useEffect } from "react";
import { Box, Input, HStack, Text, Spinner } from "@chakra-ui/react";
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
    <Box w="100%" maxW="md" mx="auto" p={4} bg="gray.800" borderRadius="lg" shadow="lg">
      <Box mb={2}>
        <label htmlFor="color-picker" style={{ color: "#d1d5db", fontSize: "0.875rem", fontWeight: "500", display: "block", cursor: "pointer" }}>
          Color
        </label>
      </Box>
      <HStack align="center" gap={4}>
        <HStack flex={1} align="center" gap={3}>
          <input
            id="color-picker"
            type="color"
            value={hexColor}
            onChange={(e) => handleColorChange(e.target.value)}
            disabled={disabled || isLoading}
            style={{
              width: "4rem",
              height: "4rem",
              borderRadius: "0.375rem",
              border: "2px solid #4b5563",
              cursor: disabled || isLoading ? "not-allowed" : "pointer",
              opacity: disabled || isLoading ? 0.5 : 1,
              padding: 0,
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
            flex={1}
            placeholder="#FFA000"
            bg="gray.700"
          />
        </HStack>
        {isLoading && (
          <Text color="gray.400" fontSize="sm">
            <Spinner size="sm" mr={2} />
            Updating...
          </Text>
        )}
      </HStack>
      <HStack mt={3} gap={2} fontSize="sm" color="gray.400">
        <Text>RGB:</Text>
        <Text fontFamily="mono">
          ({color[0]}, {color[1]}, {color[2]})
        </Text>
      </HStack>
    </Box>
  );
}
