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
import {
  artnetNodesApi,
  type ArtNetNode,
  type CreateArtNetNodeRequest,
  type UpdateArtNetNodeRequest,
} from "@/api/backendClient";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { AlertCircle, Trash2 } from "lucide-react";

interface ArtNetNodeModalProps {
  node: ArtNetNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function ArtNetNodeModal({
  node,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: ArtNetNodeModalProps) {
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [subnet, setSubnet] = useState(0);
  const [universe, setUniverse] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (node) {
        setName(node.name);
        setIpAddress(node.ipAddress);
        setSubnet(node.subnet ?? 0);
        setUniverse(node.universe ?? 0);
      } else {
        setName("");
        setIpAddress("");
        setSubnet(0);
        setUniverse(0);
      }
      setErrors({});
    }
  }, [node, isOpen]);

  const validateIP = (ip: string): boolean => {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!ipAddress.trim()) newErrors.ipAddress = "IP address is required";
    else if (!validateIP(ipAddress)) newErrors.ipAddress = "Invalid IP address format";
    if (subnet < 0 || subnet > 15) newErrors.subnet = "Subnet must be 0-15";
    if (universe < 0 || universe > 15) newErrors.universe = "Universe must be 0-15";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    try {
      if (node) {
        const data: UpdateArtNetNodeRequest = {
          name: name.trim(),
          ipAddress: ipAddress.trim(),
          subnet,
          universe,
        };
        await artnetNodesApi.update(node.id, data);
      } else {
        const data: CreateArtNetNodeRequest = {
          name: name.trim(),
          ipAddress: ipAddress.trim(),
          subnet,
          universe,
        };
        await artnetNodesApi.create(data);
      }
      await onSave();
      onClose();
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to save Art-Net node",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!node || !onDelete) return;
    if (!confirm(`Delete "${node.name}"?`)) return;
    setIsDeleting(true);
    setErrors({});
    try {
      await artnetNodesApi.delete(node.id);
      await onDelete();
      onClose();
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to delete",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && !isDeleting && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white">
            {node ? "Edit Art-Net Node" : "Add Art-Net Node"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure the Art-Net node to receive DMX data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-zinc-300">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading || isDeleting}
              placeholder="Node Name"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            {errors.name && <p className="text-sm text-red-400">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ipAddress" className="text-zinc-300">IP Address *</Label>
            <Input
              id="ipAddress"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              disabled={isLoading || isDeleting}
              placeholder="192.168.1.100"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            {errors.ipAddress && <p className="text-sm text-red-400">{errors.ipAddress}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subnet" className="text-zinc-300">Subnet (0-15)</Label>
              <Input
                id="subnet"
                type="number"
                min={0}
                max={15}
                value={subnet}
                onChange={(e) => setSubnet(parseInt(e.target.value, 10) || 0)}
                disabled={isLoading || isDeleting}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              {errors.subnet && <p className="text-sm text-red-400">{errors.subnet}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="universe" className="text-zinc-300">Universe (0-15)</Label>
              <Input
                id="universe"
                type="number"
                min={0}
                max={15}
                value={universe}
                onChange={(e) => setUniverse(parseInt(e.target.value, 10) || 0)}
                disabled={isLoading || isDeleting}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              {errors.universe && <p className="text-sm text-red-400">{errors.universe}</p>}
            </div>
          </div>
          {errors.submit && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-800">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">{errors.submit}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-3">
            {node && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading || isDeleting}
                className="sm:mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading || isDeleting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isDeleting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isLoading ? "Saving..." : node ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
