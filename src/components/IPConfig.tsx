/**
 * IP Configuration Component
 * Allows users to configure and save the WLED device IP address
 */

import { useState, useEffect } from "react";
import { Box, FieldRoot, FieldLabel, Input, HStack, Button, Text, FieldErrorText, FieldHelperText } from "@chakra-ui/react";
import { setWLEDIP, isValidIP } from "../utils/config";

interface IPConfigProps {
  onIPChange: (ip: string) => void;
  currentIP: string;
}

export function IPConfig({ onIPChange, currentIP }: IPConfigProps) {
  const [inputIP, setInputIP] = useState<string>(currentIP);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setInputIP(currentIP);
  }, [currentIP]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    setLoading(true);

    if (inputIP.trim() === "") {
      setError("IP address cannot be empty");
      setLoading(false);
      return;
    }

    if (!isValidIP(inputIP)) {
      setError("Invalid IP address format");
      setLoading(false);
      return;
    }

    try {
      const success = await setWLEDIP(inputIP);
      if (success) {
        setSaved(true);
        onIPChange(inputIP);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError("Failed to save IP address");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save IP address");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <Box w="100%" maxW="md" mx="auto" p={4} bg="gray.800" borderRadius="lg" shadow="lg">
      <FieldRoot invalid={!!error}>
        <FieldLabel htmlFor="wled-ip" color="gray.300" mb={2} fontSize="sm">
          WLED Device IP Address
        </FieldLabel>
        <HStack gap={2}>
          <Input
            id="wled-ip"
            type="text"
            value={inputIP}
            onChange={(e) => {
              setInputIP(e.target.value);
              setError(null);
              setSaved(false);
            }}
            onKeyPress={handleKeyPress}
            placeholder="192.168.1.100"
            disabled={loading}
            flex={1}
            bg="gray.700"
          />
          <Button
            onClick={handleSave}
            disabled={loading}
            colorScheme="blue"
            loading={loading}
          >
            Save
          </Button>
        </HStack>
        {error && (
          <FieldErrorText mt={2}>{error}</FieldErrorText>
        )}
        {saved && (
          <Text mt={2} fontSize="sm" color="green.400">
            IP address saved!
          </Text>
        )}
        {currentIP && !error && !saved && (
          <FieldHelperText mt={2} color="gray.400">
            Current: {currentIP}
          </FieldHelperText>
        )}
      </FieldRoot>
    </Box>
  );
}
