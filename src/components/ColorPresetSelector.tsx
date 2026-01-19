/**
 * Color Preset Selector Component
 * Allows users to select from saved color presets when creating cues
 */

import { useState, useEffect } from "react";
import { Box, Heading, Input, Button, HStack, Text, Grid, GridItem, IconButton } from "@chakra-ui/react";
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
    <Box w="100%" p={4} bg="gray.800" borderRadius="lg">
      <Heading as="h4" size="sm" color="gray.300" mb={3}>
        Color Presets
      </Heading>

      {/* Save Current Color */}
      {selectedColor && (
        <Box mb={4} p={3} bg="gray.700" borderRadius="lg">
          <Text fontSize="xs" color="gray.400" mb={2}>
            Save Current Color
          </Text>
          <HStack gap={2}>
            <Box
              w={8}
              h={8}
              borderRadius="md"
              border="2px"
              borderColor="gray.600"
              flexShrink={0}
              bg={colorToHex(selectedColor)}
            />
            <Input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled || isSaving}
              placeholder="Enter preset name..."
              flex={1}
              bg="gray.600"
              size="sm"
            />
            <Button
              onClick={handleSavePreset}
              disabled={disabled || isSaving || !presetName.trim()}
              colorScheme="blue"
              size="sm"
              loading={isSaving}
            >
              Save
            </Button>
          </HStack>
        </Box>
      )}

      {/* Saved Color Presets */}
      {isLoading ? (
        <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>
          Loading presets...
        </Text>
      ) : colorPresets.length > 0 ? (
        <Grid templateColumns="repeat(auto-fill, minmax(150px, 1fr))" gap={2}>
          {colorPresets.map((preset) => (
            <GridItem key={preset.id}>
              <HStack
                align="center"
                gap={2}
                p={2}
                bg="gray.700"
                borderRadius="lg"
                _hover={{ bg: "gray.650" }}
                transition="background-color 0.2s"
                cursor={disabled ? "not-allowed" : "pointer"}
                onClick={() => !disabled && handleSelectPreset(preset)}
                opacity={disabled ? 0.5 : 1}
              >
                <Box
                  w={10}
                  h={10}
                  borderRadius="md"
                  border="2px"
                  borderColor="gray.600"
                  flexShrink={0}
                  bg={colorToHex(preset.color)}
                />
                <Box flex={1} minW={0}>
                  <Text color="white" fontWeight="medium" fontSize="sm" truncate>
                    {preset.name}
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    {colorToHex(preset.color)}
                  </Text>
                </Box>
                <IconButton
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) {
                      handleDeletePreset(preset.id, e);
                    }
                  }}
                  disabled={disabled || isDeleting === preset.id}
                  colorScheme="red"
                  size="xs"
                  aria-label={`Delete preset ${preset.name}`}
                >
                  <Text fontSize="xs">✕</Text>
                </IconButton>
              </HStack>
            </GridItem>
          ))}
        </Grid>
      ) : (
        <Box textAlign="center" py={4} color="gray.500">
          <Text fontSize="sm">No color presets saved yet.</Text>
          <Text fontSize="xs" mt={1}>
            Select a color and save it as a preset!
          </Text>
        </Box>
      )}
    </Box>
  );
}
