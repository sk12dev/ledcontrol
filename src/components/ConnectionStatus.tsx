/**
 * Connection Status Component
 * Displays connection state and device information
 */

import { Box, Flex, HStack, Badge, Button, Grid, GridItem, Text, AlertRoot, AlertIndicator, AlertContent } from "@chakra-ui/react";
import type { ConnectionStatus as ConnectionStatusType, WLEDInfo } from "../types/wled";

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  deviceInfo: WLEDInfo | null;
  error: string | null;
  onRefresh?: () => Promise<void>;
}

export function ConnectionStatus({ status, deviceInfo, error, onRefresh }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "green";
      case "connecting":
        return "yellow";
      case "error":
        return "red";
      default:
        return "gray";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      default:
        return "Disconnected";
    }
  };

  return (
    <Box w="100%" maxW="4xl" mx="auto" p={4} bg="gray.800" borderRadius="lg" shadow="lg">
      <Flex align="center" justify="space-between" mb={2}>
        <HStack gap={2}>
          <Box
            w={3}
            h={3}
            borderRadius="full"
            bg={`${getStatusColor()}.400`}
            animation={status === "connecting" ? "pulse 2s infinite" : undefined}
          />
          <Badge colorScheme={getStatusColor()} fontSize="sm" fontWeight="medium">
            {getStatusText()}
          </Badge>
        </HStack>
        {onRefresh && (
          <Button
            onClick={onRefresh}
            disabled={status === "connecting"}
            size="sm"
            variant="solid"
            colorScheme="gray"
          >
            Refresh
          </Button>
        )}
      </Flex>

      {error && (
        <AlertRoot status="error" mt={2} borderRadius="md">
          <AlertIndicator />
          <AlertContent>{error}</AlertContent>
        </AlertRoot>
      )}

      {deviceInfo && status === "connected" && (
        <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={2} mt={3} fontSize="sm">
          <GridItem>
            <Text color="gray.500" as="span">Device: </Text>
            <Text color="gray.300" fontWeight="medium" as="span">{deviceInfo.name}</Text>
          </GridItem>
          <GridItem>
            <Text color="gray.500" as="span">Version: </Text>
            <Text color="gray.300" fontWeight="medium" as="span">{deviceInfo.ver}</Text>
          </GridItem>
          <GridItem>
            <Text color="gray.500" as="span">LEDs: </Text>
            <Text color="gray.300" fontWeight="medium" as="span">{deviceInfo.leds.count}</Text>
          </GridItem>
          <GridItem>
            <Text color="gray.500" as="span">Uptime: </Text>
            <Text color="gray.300" fontWeight="medium" as="span">
              {Math.floor(deviceInfo.uptime / 3600)}h
            </Text>
          </GridItem>
        </Grid>
      )}

      {status === "disconnected" && !error && (
        <Text mt={2} fontSize="sm" color="gray.500">
          Configure IP address above to connect
        </Text>
      )}
    </Box>
  );
}

