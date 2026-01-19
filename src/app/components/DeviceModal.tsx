import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { devicesApi, type Device, type CreateDeviceRequest, type UpdateDeviceRequest } from "@/api/backendClient";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { AlertCircle, Trash2 } from "lucide-react";

interface DeviceModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function DeviceModal({ device, isOpen, onClose, onSave, onDelete }: DeviceModalProps) {
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
          macAddress: macAddress.trim() || null,
        };
        await devicesApi.update(device.id, updateData);
      } else {
        const createData: CreateDeviceRequest = {
          name: name.trim(),
          ipAddress: ipAddress.trim(),
          macAddress: macAddress.trim() || null,
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

  const handleDelete = async () => {
    if (!device || !onDelete) return;

    if (!confirm(`Are you sure you want to delete "${device.name}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setErrors({});

    try {
      await devicesApi.delete(device.id);
      await onDelete();
      onClose();
    } catch (err) {
      console.error("Failed to delete device:", err);
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to delete device",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isLoading && !isDeleting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white">
            {device ? "Edit Device" : "Add Device"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {device
              ? "Update the device information below."
              : "Enter the device information to add a new lighting device."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-zinc-300">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading || isDeleting}
              placeholder="Device Name"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* IP Address Field */}
          <div className="space-y-2">
            <Label htmlFor="ipAddress" className="text-zinc-300">
              IP Address <span className="text-red-400">*</span>
            </Label>
            <Input
              id="ipAddress"
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              disabled={isLoading || isDeleting}
              placeholder="192.168.1.100"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              aria-invalid={!!errors.ipAddress}
            />
            {errors.ipAddress && (
              <p className="text-sm text-red-400">{errors.ipAddress}</p>
            )}
          </div>

          {/* MAC Address Field */}
          <div className="space-y-2">
            <Label htmlFor="macAddress" className="text-zinc-300">
              MAC Address <span className="text-zinc-500 text-xs">(optional)</span>
            </Label>
            <Input
              id="macAddress"
              type="text"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              disabled={isLoading || isDeleting}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              aria-invalid={!!errors.macAddress}
            />
            {errors.macAddress && (
              <p className="text-sm text-red-400">{errors.macAddress}</p>
            )}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-800">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">
                {errors.submit}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-3">
            {device && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading || isDeleting}
                className="sm:mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading || isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isDeleting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isLoading ? "Saving..." : device ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
