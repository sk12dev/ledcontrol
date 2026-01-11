/**
 * Custom Presets Component
 * Allows users to save and apply custom presets (color + brightness)
 */

import { useState, useEffect } from "react";
import { Box, Heading, FieldRoot, FieldLabel, Input, Button, HStack, Text, Grid, GridItem, IconButton } from "@chakra-ui/react";
import type { WLEDColor, CustomPreset } from "../types/wled";
import { getPresets, savePreset, deletePreset } from "../utils/presets";

interface CustomPresetsProps {
  color: WLEDColor;
  brightness: number;
  onApplyPreset: (color: WLEDColor, brightness: number) => Promise<void>;
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

export function CustomPresets({
  color,
  brightness,
  onApplyPreset,
  disabled = false,
}: CustomPresetsProps) {
  const [presets, setPresets] = useState<CustomPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState<string | null>(null);

  // Ensure brightness is always a valid number
  const validBrightness = (brightness != null && !isNaN(brightness) && brightness >= 1 && brightness <= 255)
    ? brightness
    : 127;

  // Load presets on mount and when they change
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const loadedPresets = await getPresets();
        setPresets(loadedPresets);
      } catch (error) {
        console.error("Failed to load presets:", error);
      }
    };
    loadPresets();
  }, []);

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const newPreset = await savePreset({
        name: presetName.trim(),
        color,
        brightness: validBrightness,
      });
      setPresets([...presets, newPreset]);
      setPresetName("");
    } catch (error) {
      console.error("Failed to save preset:", error);
      alert("Failed to save preset. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyPreset = async (preset: CustomPreset) => {
    setIsApplying(preset.id);
    try {
      await onApplyPreset(preset.color, preset.brightness);
    } finally {
      setIsApplying(null);
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent any event bubbling
    console.log("Delete button clicked for preset:", id);
    
    try {
      const success = await deletePreset(id);
      console.log("Delete result:", success);
      
      if (success) {
        setPresets(prevPresets => prevPresets.filter(p => p.id !== id));
        console.log("Preset deleted, updating state");
      } else {
        console.error("Failed to delete preset:", id);
        // Reload presets from storage in case of mismatch
        const loadedPresets = await getPresets();
        setPresets(loadedPresets);
      }
    } catch (error) {
      console.error("Error deleting preset:", error);
      alert("Failed to delete preset. Please try again.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSavePreset();
    }
  };

  return (
    <Box w="100%" maxW="2xl" mx="auto" p={6} bg="gray.800" borderRadius="lg" shadow="lg">
      <Heading as="h2" size="lg" color="white" mb={4}>
        Custom Presets
      </Heading>
      
      {/* Save Current Settings */}
      <Box mb={6} p={4} bg="gray.700" borderRadius="lg">
        <FieldRoot>
          <FieldLabel htmlFor="preset-name" color="gray.300" mb={2} fontSize="sm">
            Save Current Settings
          </FieldLabel>
          <HStack gap={2}>
            <Input
              id="preset-name"
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled || isSaving}
              placeholder="Enter preset name..."
              flex={1}
              bg="gray.600"
            />
            <Button
              onClick={handleSavePreset}
              disabled={disabled || isSaving || !presetName.trim()}
              colorScheme="yellow"
              loading={isSaving}
            >
              Save
            </Button>
          </HStack>
          <Text mt={2} fontSize="xs" color="gray.400">
            Current: Color {colorToHex(color)} • Brightness {Math.round((validBrightness / 255) * 100)}%
          </Text>
        </FieldRoot>
      </Box>

      {/* Saved Presets List */}
      {presets.length > 0 ? (
        <Box>
          <Heading as="h3" size="sm" color="gray.300" mb={3}>
            Saved Presets
          </Heading>
          <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap={3}>
            {presets.map((preset) => (
              <GridItem key={preset.id}>
                <HStack
                  align="center"
                  gap={3}
                  p={3}
                  bg="gray.700"
                  borderRadius="lg"
                  _hover={{ bg: "gray.650" }}
                  transition="background-color 0.2s"
                >
                  <Box
                    w={12}
                    h={12}
                    borderRadius="md"
                    border="2px"
                    borderColor="gray.600"
                    flexShrink={0}
                    bg={colorToHex(preset.color)}
                  />
                  <Box flex={1} minW={0}>
                    <Text color="white" fontWeight="medium" truncate>
                      {preset.name}
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      {preset.brightness != null && !isNaN(preset.brightness) 
                        ? `${Math.round((preset.brightness / 255) * 100)}% brightness`
                        : "Invalid brightness"}
                    </Text>
                  </Box>
                  <HStack gap={1}>
                    <Button
                      onClick={() => handleApplyPreset(preset)}
                      disabled={disabled || isApplying === preset.id}
                      colorScheme="green"
                      size="sm"
                      loading={isApplying === preset.id}
                    >
                      Apply
                    </Button>
                    <IconButton
                      type="button"
                      onClick={(e) => {
                        console.log("Delete button clicked, preset ID:", preset.id);
                        handleDeletePreset(preset.id, e);
                      }}
                      disabled={disabled || isApplying === preset.id}
                      colorScheme="red"
                      size="sm"
                      aria-label={`Delete preset ${preset.name}`}
                    >
                      <Text>✕</Text>
                    </IconButton>
                  </HStack>
                </HStack>
              </GridItem>
            ))}
          </Grid>
        </Box>
      ) : (
        <Box textAlign="center" py={8} color="gray.500">
          <Text>No presets saved yet.</Text>
          <Text fontSize="sm" mt={1}>
            Set a color and brightness, then save it as a preset!
          </Text>
        </Box>
      )}
    </Box>
  );
}

