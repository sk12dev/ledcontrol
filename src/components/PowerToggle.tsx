/**
 * Power Toggle Component
 * Large, prominent button to turn WLED device on/off
 */

import { useState } from "react";
import { Button } from "@chakra-ui/react";

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
    <Button
      onClick={handleClick}
      disabled={disabled || isLoading}
      w={32}
      h={32}
      borderRadius="full"
      fontWeight="bold"
      fontSize="xl"
      loading={isLoading}
      shadow="lg"
      bg={power ? "yellow.400" : "gray.700"}
      color={power ? "gray.900" : "gray.300"}
      _hover={{
        bg: power ? "yellow.500" : "gray.600",
      }}
      _disabled={{
        opacity: 0.5,
        cursor: "not-allowed",
      }}
    >
      {isLoading ? "..." : power ? "ON" : "OFF"}
    </Button>
  );
}

