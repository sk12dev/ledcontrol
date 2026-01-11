/**
 * Preset Selector Component
 * Allows users to apply WLED presets by ID
 */

import { useState, useEffect } from "react";
import { Box, FieldRoot, FieldLabel, Input, HStack, Button, Text, IconButton } from "@chakra-ui/react";

interface PresetSelectorProps {
  currentPreset: number | null;
  onPresetChange: (presetId: number | null) => Promise<void>;
  disabled?: boolean;
}

export function PresetSelector({
  currentPreset,
  onPresetChange,
  disabled = false,
}: PresetSelectorProps) {
  const [presetInput, setPresetInput] = useState<string>(currentPreset !== null ? String(currentPreset) : "");
  const [loading, setLoading] = useState(false);

  // Sync input with current preset when it changes externally
  useEffect(() => {
    if (currentPreset !== null) {
      setPresetInput(String(currentPreset));
    }
  }, [currentPreset]);

  const handleApplyPreset = async () => {
    const presetId = presetInput.trim() === "" ? null : parseInt(presetInput.trim(), 10);
    
    if (presetInput.trim() !== "" && (presetId === null || isNaN(presetId) || presetId < 0 || presetId > 250)) {
      return;
    }

    setLoading(true);
    try {
      await onPresetChange(presetId);
    } finally {
      setLoading(false);
    }
  };

  const handleClearPreset = async () => {
    setPresetInput("");
    setLoading(true);
    try {
      await onPresetChange(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleApplyPreset();
    }
  };

  return (
    <Box bg="gray.800" borderRadius="lg" p={6} maxW="md" mx="auto">
      <FieldRoot>
        <FieldLabel htmlFor="preset-input" color="gray.300" mb={2} fontSize="sm">
          Preset ID (0-250)
        </FieldLabel>
        <HStack gap={2}>
          <Input
            id="preset-input"
            type="number"
            min={0}
            max={250}
            value={presetInput}
            onChange={(e) => setPresetInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled || loading}
            placeholder="Enter preset ID..."
            flex={1}
            bg="gray.700"
          />
          <Button
            onClick={handleApplyPreset}
            disabled={disabled || loading}
            colorScheme="yellow"
            loading={loading}
          >
            Apply
          </Button>
          {currentPreset !== null && (
            <IconButton
              onClick={handleClearPreset}
              disabled={disabled || loading}
              colorScheme="gray"
              aria-label="Clear preset"
            >
              <Text>✕</Text>
            </IconButton>
          )}
        </HStack>
        {currentPreset !== null && (
          <Text mt={2} fontSize="xs" color="gray.400">
            Active preset: <Text as="span" color="yellow.400">{currentPreset}</Text>
          </Text>
        )}
        <Text mt={2} fontSize="xs" color="gray.500">
          Note: Presets must be configured on your WLED device first
        </Text>
      </FieldRoot>
    </Box>
  );
}

