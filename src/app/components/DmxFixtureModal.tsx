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
  dmxFixturesApi,
  type DmxFixture,
  type ArtNetNode,
  type CreateDmxFixtureRequest,
  type UpdateDmxFixtureRequest,
} from "@/api/backendClient";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { AlertCircle, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DmxFixtureModalProps {
  fixture: DmxFixture | null;
  nodes: ArtNetNode[];
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

const CHANNEL_PURPOSES = [
  "red",
  "green",
  "blue",
  "white",
  "alpha",
  "amber",
  "uv",
  "dimmer",
  "strobe",
  "pan",
  "tilt",
  "gobo",
  "color wheel",
  "fan",
  "fog",
  "custom",
] as const;

export function DmxFixtureModal({
  fixture,
  nodes,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: DmxFixtureModalProps) {
  const [name, setName] = useState("");
  const [artNetNodeId, setArtNetNodeId] = useState<number | null>(null);
  const [startAddress, setStartAddress] = useState(1);
  const [channelCount, setChannelCount] = useState(4);
  const [channelPurposes, setChannelPurposes] = useState<string[]>([
    "red",
    "green",
    "blue",
    "alpha",
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (fixture) {
        setName(fixture.name);
        setArtNetNodeId(fixture.artNetNodeId);
        setStartAddress(fixture.startAddress);
        setChannelCount(fixture.channelCount);
        const purposes = Array.isArray(fixture.channelPurposes)
          ? [...fixture.channelPurposes]
          : [];
        while (purposes.length < fixture.channelCount) purposes.push("dimmer");
        setChannelPurposes(purposes.slice(0, fixture.channelCount));
      } else {
        setName("");
        setArtNetNodeId(nodes[0]?.id ?? null);
        setStartAddress(1);
        setChannelCount(4);
        setChannelPurposes(["red", "green", "blue", "alpha"]);
      }
      setErrors({});
    }
  }, [fixture, nodes, isOpen]);

  useEffect(() => {
    if (isOpen && !fixture) {
      const newCount = Math.max(1, Math.min(512, channelCount));
      const current = channelPurposes;
      if (current.length > newCount) {
        setChannelPurposes(current.slice(0, newCount));
      } else if (current.length < newCount) {
        setChannelPurposes([
          ...current,
          ...Array(newCount - current.length).fill("dimmer"),
        ]);
      }
    }
  }, [channelCount, isOpen, fixture]);

  const handleChannelCountChange = (val: number) => {
    const newCount = Math.max(1, Math.min(512, val));
    setChannelCount(newCount);
    const current = channelPurposes;
    if (current.length > newCount) {
      setChannelPurposes(current.slice(0, newCount));
    } else if (current.length < newCount) {
      setChannelPurposes([
        ...current,
        ...Array(newCount - current.length).fill("dimmer"),
      ]);
    }
  };

  const handlePurposeChange = (index: number, purpose: string) => {
    setChannelPurposes((prev) => {
      const next = [...prev];
      next[index] = purpose;
      return next;
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!artNetNodeId) newErrors.artNetNodeId = "Select an Art-Net node";
    if (startAddress < 1 || startAddress > 512)
      newErrors.startAddress = "Start address must be 1-512";
    if (channelCount < 1 || channelCount > 512)
      newErrors.channelCount = "Channel count must be 1-512";
    if (startAddress + channelCount - 1 > 512) {
      newErrors.startAddress =
        "Start address + channel count cannot exceed 512";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    try {
      const purposes = channelPurposes.slice(0, channelCount);
      if (fixture) {
        const data: UpdateDmxFixtureRequest = {
          name: name.trim(),
          artNetNodeId: artNetNodeId!,
          startAddress,
          channelCount,
          channelPurposes: purposes,
        };
        await dmxFixturesApi.update(fixture.id, data);
      } else {
        const data: CreateDmxFixtureRequest = {
          name: name.trim(),
          artNetNodeId: artNetNodeId!,
          startAddress,
          channelCount,
          channelPurposes: purposes,
        };
        await dmxFixturesApi.create(data);
      }
      await onSave();
      onClose();
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to save fixture",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!fixture || !onDelete) return;
    if (!confirm(`Delete "${fixture.name}"?`)) return;
    setIsDeleting(true);
    setErrors({});
    try {
      await dmxFixturesApi.delete(fixture.id);
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !isLoading && !isDeleting && onClose()}
    >
      <DialogContent className="sm:max-w-[560px] bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {fixture ? "Edit DMX Fixture" : "Add DMX Fixture"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure fixture channel mapping.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-zinc-300">
              Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading || isDeleting}
              placeholder="Fixture Name"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            {errors.name && (
              <p className="text-sm text-red-400">{errors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Art-Net Node *</Label>
            <Select
              value={artNetNodeId?.toString() ?? ""}
              onValueChange={(v) => setArtNetNodeId(parseInt(v, 10))}
              disabled={isLoading || isDeleting}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="Select node" />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id.toString()}>
                    {n.name} ({n.ipAddress})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.artNetNodeId && (
              <p className="text-sm text-red-400">{errors.artNetNodeId}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startAddress" className="text-zinc-300">
                Start Address (1-512)
              </Label>
              <Input
                id="startAddress"
                type="number"
                min={1}
                max={512}
                value={startAddress}
                onChange={(e) =>
                  setStartAddress(parseInt(e.target.value, 10) || 1)
                }
                disabled={isLoading || isDeleting}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              {errors.startAddress && (
                <p className="text-sm text-red-400">{errors.startAddress}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="channelCount" className="text-zinc-300">
                Channels
              </Label>
              <Input
                id="channelCount"
                type="number"
                min={1}
                max={512}
                value={channelCount}
                onChange={(e) =>
                  handleChannelCountChange(parseInt(e.target.value, 10) || 1)
                }
                disabled={isLoading || isDeleting}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              {errors.channelCount && (
                <p className="text-sm text-red-400">{errors.channelCount}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Channel Purposes</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
              {channelPurposes.slice(0, channelCount).map((p, i) => (
                <Select
                  key={i}
                  value={p}
                  onValueChange={(v) => handlePurposeChange(i, v)}
                  disabled={isLoading || isDeleting}
                >
                  <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue>
                      {i + 1}: {p}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_PURPOSES.map((pr) => (
                      <SelectItem key={pr} value={pr}>
                        {pr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>
          {errors.submit && (
            <Alert
              variant="destructive"
              className="bg-red-900/20 border-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">
                {errors.submit}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-3">
            {fixture && onDelete && (
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
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading || isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isDeleting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isLoading ? "Saving..." : fixture ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
