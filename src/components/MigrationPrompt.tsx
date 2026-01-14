/**
 * Migration Prompt Component
 * Prompts user to migrate localStorage data to backend on first load
 */

import { useState } from "react";
import { DialogRoot, DialogBackdrop, DialogPositioner, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogCloseTrigger, Button, Text, VStack, ListRoot, ListItem, Box } from "@chakra-ui/react";
import { migrateLocalStorageToBackend } from "../utils/migrateToBackend";

export function MigrationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    devicesMigrated: number;
    presetsMigrated: number;
    errors: string[];
  } | null>(null);

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateLocalStorageToBackend();
      setMigrationResult(result);
      if (result.errors.length === 0) {
        // Hide prompt after successful migration
        setTimeout(() => {
          setShowPrompt(false);
        }, 3000);
      }
    } catch (error) {
      console.error("Migration failed:", error);
      setMigrationResult({
        devicesMigrated: 0,
        presetsMigrated: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <DialogRoot open={showPrompt} onOpenChange={(details) => !details.open && handleDismiss()}>
      <DialogBackdrop bg="blackAlpha.500" />
      <DialogPositioner>
        <DialogContent bg="gray.800" maxW="md" mx={4}>
          <DialogHeader>
            <DialogTitle color="white">
              Migrate Data to Backend
            </DialogTitle>
            <DialogCloseTrigger />
          </DialogHeader>
          <DialogBody>
            <Text color="gray.300" mb={6}>
              We found data in your browser's local storage. Would you like to migrate it to the backend database?
              This will make your data available across devices and browsers.
            </Text>

            {migrationResult && (
              <Box mb={4} p={3} bg="gray.700" borderRadius="md">
                <Text fontSize="sm" color="gray.300" mb={2} fontWeight="bold">
                  Migration Complete:
                </Text>
                <ListRoot fontSize="sm" color="gray.400" gap={1}>
                  <ListItem>✅ Devices migrated: {migrationResult.devicesMigrated}</ListItem>
                  <ListItem>✅ Presets migrated: {migrationResult.presetsMigrated}</ListItem>
                  {migrationResult.errors.length > 0 && (
                    <ListItem color="red.400">
                      ❌ Errors: {migrationResult.errors.length}
                    </ListItem>
                  )}
                </ListRoot>
                {migrationResult.errors.length > 0 && (
                  <VStack mt={2} align="stretch" gap={1}>
                    {migrationResult.errors.map((err, i) => (
                      <Text key={i} fontSize="xs" color="red.400">
                        {err}
                      </Text>
                    ))}
                  </VStack>
                )}
              </Box>
            )}
          </DialogBody>
          <DialogFooter gap={3}>
            <Button
              onClick={handleMigrate}
              disabled={isMigrating || (migrationResult !== null && migrationResult.errors.length === 0)}
              colorScheme="blue"
              flex={1}
              loading={isMigrating}
            >
              {migrationResult ? "Migrated!" : "Migrate Now"}
            </Button>
            <Button
              onClick={handleDismiss}
              disabled={isMigrating}
              colorScheme="gray"
            >
              {migrationResult && migrationResult.errors.length === 0 ? "Close" : "Later"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
