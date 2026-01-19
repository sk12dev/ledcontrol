import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  type Show,
  type CreateShowRequest,
  type UpdateShowRequest,
} from "../api/backendClient";

interface ShowFormModalProps {
  show: Show | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export function ShowFormModal({ show, isOpen, onClose, onSave }: ShowFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when show changes or modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (show) {
        setName(show.name);
        setDescription(show.description || "");
      } else {
        setName("");
        setDescription("");
      }
      setErrors({});
    }
  }, [show, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      if (show) {
        // Update existing show
        const updateData: UpdateShowRequest = {
          name: name.trim(),
          description: description.trim() || null,
        };
        const { showsApi } = await import("../api/backendClient");
        await showsApi.update(show.id, updateData);
      } else {
        // Create new show
        const createData: CreateShowRequest = {
          name: name.trim(),
          description: description.trim() || null,
        };
        const { showsApi } = await import("../api/backendClient");
        await showsApi.create(createData);
      }
      await onSave();
      onClose();
    } catch (err) {
      console.error("Failed to save show:", err);
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to save show",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white">
            {show ? "Edit Show" : "Create Show"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
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
                disabled={isLoading}
                placeholder="Show Name"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
              {errors.name && (
                <p className="text-sm text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-zinc-300">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                placeholder="Optional description for this show"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 min-h-[100px]"
                rows={4}
              />
            </div>

            {errors.submit && (
              <p className="text-sm text-red-400">{errors.submit}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-zinc-700 text-zinc-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isLoading ? "Saving..." : show ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
