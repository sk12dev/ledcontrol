/**
 * Brightness Slider Component
 * Allows users to adjust brightness (1-255)
 */

import { useState, useEffect } from "react";
import { Box, Text, HStack, Spinner, SliderRoot, SliderTrack, SliderRange, SliderThumb } from "@chakra-ui/react";

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
    <Box w="100%" maxW="md" mx="auto" p={4} bg="gray.800" borderRadius="lg" shadow="lg">
      <Box mb={2}>
        <label htmlFor="brightness-slider" style={{ color: "#d1d5db", fontSize: "0.875rem", fontWeight: "500", display: "block", cursor: "pointer" }}>
          Brightness
        </label>
      </Box>
      <HStack align="center" gap={4}>
        <SliderRoot
          id="brightness-slider"
          min={1}
          max={255}
          value={[displayBrightness]}
          onValueChange={(details) => {
            const value = details.value[0];
            if (value !== undefined && !isNaN(value)) {
              handleChange(value);
            }
          }}
          disabled={disabled || isLoading}
          flex={1}
          colorPalette="yellow"
        >
          <SliderTrack>
            <SliderRange />
          </SliderTrack>
          <SliderThumb index={0} />
        </SliderRoot>
        <Box w={20} textAlign="right">
          <Text fontSize="lg" fontFamily="mono" color="white">
            {percentage}%
          </Text>
          <Text fontSize="xs" color="gray.400">
            ({displayBrightness})
          </Text>
        </Box>
      </HStack>
      {isLoading && (
        <HStack mt={2} fontSize="xs" color="gray.400">
          <Spinner size="xs" />
          <Text>Updating...</Text>
        </HStack>
      )}
    </Box>
  );
}

