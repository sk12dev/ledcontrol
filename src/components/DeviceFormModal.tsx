import { useState, useEffect } from "react";
import { DialogRoot, DialogBackdrop, DialogPositioner, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogCloseTrigger, FieldRoot, FieldLabel, Input, FieldErrorText, Button, VStack, AlertRoot, AlertIndicator, AlertContent, Text } from "@chakra-ui/react";
import { devicesApi, type Device, type CreateDeviceRequest, type UpdateDeviceRequest } from "../api/backendClient";

interface DeviceFormModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export function DeviceFormModal({ device, isOpen, onClose, onSave }: DeviceFormModalProps) {
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when device changes or modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (device) {
        setName(device.name);
        setIpAddress(device.ipAddress);
        setMacAddress(device.macAddress || "");
      } else {
        setName("");
        setIpAddress("");
        setMacAddress("");
      }
      setErrors({});
    }
  }, [device, isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const validateIP = (ip: string): boolean => {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  };

  const validateMAC = (mac: string): boolean => {
    if (!mac) return true; // MAC is optional
    return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!ipAddress.trim()) {
      newErrors.ipAddress = "IP address is required";
    } else if (!validateIP(ipAddress)) {
      newErrors.ipAddress = "Invalid IP address format";
    }

    if (macAddress && !validateMAC(macAddress)) {
      newErrors.macAddress = "Invalid MAC address format (expected: AA:BB:CC:DD:EE:FF)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      if (device) {
        const updateData: UpdateDeviceRequest = {
          name: name.trim(),
          ipAddress: ipAddress.trim(),
          macAddress: macAddress.trim() || undefined,
        };
        await devicesApi.update(device.id, updateData);
      } else {
        const createData: CreateDeviceRequest = {
          name: name.trim(),
          ipAddress: ipAddress.trim(),
          macAddress: macAddress.trim() || undefined,
        };
        await devicesApi.create(createData);
      }
      await onSave();
      onClose();
    } catch (err) {
      console.error("Failed to save device:", err);
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to save device",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(details) => !details.open && handleClose()}>
      <DialogBackdrop bg="blackAlpha.500" />
      <DialogPositioner>
        <DialogContent bg="gray.800" border="1px" borderColor="gray.700" maxW="md">
          <DialogHeader>
            <DialogTitle color="white">
              {device ? "Edit Device" : "Add Device"}
            </DialogTitle>
            <DialogCloseTrigger color="gray.400" _hover={{ color: "white" }} disabled={isLoading} />
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleSubmit}>
              <VStack gap={4} align="stretch">
                {/* Name Field */}
                <FieldRoot invalid={!!errors.name} required>
                  <FieldLabel htmlFor="name" color="gray.300">
                    Name
                  </FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    placeholder="Device Name"
                    bg="gray.700"
                  />
                  <FieldErrorText>{errors.name}</FieldErrorText>
                </FieldRoot>

                {/* IP Address Field */}
                <FieldRoot invalid={!!errors.ipAddress} required>
                  <FieldLabel htmlFor="ipAddress" color="gray.300">
                    IP Address
                  </FieldLabel>
                  <Input
                    id="ipAddress"
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    disabled={isLoading}
                    placeholder="192.168.1.100"
                    bg="gray.700"
                  />
                  <FieldErrorText>{errors.ipAddress}</FieldErrorText>
                </FieldRoot>

                {/* MAC Address Field */}
                <FieldRoot invalid={!!errors.macAddress}>
                  <FieldLabel htmlFor="macAddress" color="gray.300">
                    MAC Address <Text as="span" color="gray.500" fontSize="xs">(optional)</Text>
                  </FieldLabel>
                  <Input
                    id="macAddress"
                    type="text"
                    value={macAddress}
                    onChange={(e) => setMacAddress(e.target.value)}
                    disabled={isLoading}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    bg="gray.700"
                  />
                  <FieldErrorText>{errors.macAddress}</FieldErrorText>
                </FieldRoot>

                {/* Submit Error */}
                {errors.submit && (
                  <AlertRoot status="error" borderRadius="md">
                    <AlertIndicator />
                    <AlertContent>{errors.submit}</AlertContent>
                  </AlertRoot>
                )}
              </VStack>
            </form>
          </DialogBody>
          <DialogFooter gap={3}>
            <Button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              colorScheme="gray"
              flex={1}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              colorScheme="blue"
              flex={1}
              loading={isLoading}
            >
              {device ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
