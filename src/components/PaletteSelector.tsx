/**
 * Palette Selector Component
 * Allows users to select from available WLED palettes
 */

import { useState } from "react";
import { Box, FieldRoot, FieldLabel, NativeSelectRoot, NativeSelectField, Text, Spinner, HStack } from "@chakra-ui/react";

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
    <Box bg="gray.800" borderRadius="lg" p={6} maxW="md" mx="auto">
      <FieldRoot>
        <FieldLabel htmlFor="palette-select" color="gray.300" mb={2} fontSize="sm">
          Color Palette
        </FieldLabel>
        <NativeSelectRoot disabled={disabled || loading}>
          <NativeSelectField
            id="palette-select"
            value={String(currentPalette)}
            onChange={handlePaletteChange}
            bg="gray.700"
          >
            {palettes.map((palette, index) => (
              <option key={index} value={index}>
                {palette === "RSVD" || palette === "-" ? `[Reserved ${index}]` : palette}
              </option>
            ))}
          </NativeSelectField>
        </NativeSelectRoot>
        {loading && (
          <HStack mt={2} gap={2}>
            <Spinner size="sm" color="yellow.500" />
            <Text fontSize="xs" color="gray.400">Updating...</Text>
          </HStack>
        )}
        {currentPalette >= 0 && currentPalette < palettes.length && (
          <Text mt={2} fontSize="xs" color="gray.400">
            Selected: <Text as="span" color="yellow.400">{palettes[currentPalette]}</Text>
          </Text>
        )}
      </FieldRoot>
    </Box>
  );
}

