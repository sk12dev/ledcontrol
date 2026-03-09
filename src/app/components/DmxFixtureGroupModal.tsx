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
import { Textarea } from "@/app/components/ui/textarea";
import {
  type DmxFixtureGroup,
  type DmxFixture,
} from "@/api/backendClient";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { AlertCircle, Trash2 } from "lucide-react";
import { ScrollArea } from "@/app/components/ui/scroll-area";

interface DmxFixtureGroupModalProps {
  group: DmxFixtureGroup | null;
  fixtures: DmxFixture[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    description: string | null,
    fixtureIds: number[]
  ) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function DmxFixtureGroupModal({
  group,
  fixtures,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: DmxFixtureGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<number>>(
    new Set()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (group) {
        setName(group.name);
        setDescription(group.description ?? "");
        setSelectedFixtureIds(
          new Set(group.fixtures.map((f) => f.id))
        );
      } else {
        setName("");
        setDescription("");
        setSelectedFixtureIds(new Set());
      }
      setErrors({});
    }
  }, [group, fixtures, isOpen]);

  const handleFixtureToggle = (fixtureId: number) => {
    setSelectedFixtureIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedFixtureIds(new Set(fixtures.map((f) => f.id)));
  };

  const handleDeselectAll = () => {
    setSelectedFixtureIds(new Set());
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    try {
      await onSave(name.trim(), description.trim() || null, Array.from(selectedFixtureIds));
      onClose();
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to save group",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!group || !onDelete) return;
    if (!confirm(`Delete "${group.name}"?`)) return;
    setIsDeleting(true);
    setErrors({});
    try {
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

  const handleClose = () => {
    if (!isLoading && !isDeleting) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[560px] bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">
            {group ? "Edit Fixture Group" : "Add Fixture Group"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a group of fixtures to select together in cues.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name" className="text-zinc-300">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading || isDeleting}
              placeholder="e.g. Front Wash"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            {errors.name && <p className="text-sm text-red-400">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-zinc-300">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading || isDeleting}
              placeholder="Optional description"
              rows={2}
              className="bg-zinc-800 border-zinc-700 text-white resize-none"
            />
          </div>

          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <Label className="text-zinc-300">Fixtures</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-zinc-400 hover:text-white h-7"
                  onClick={handleSelectAll}
                  disabled={isLoading || isDeleting || fixtures.length === 0}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-zinc-400 hover:text-white h-7"
                  onClick={handleDeselectAll}
                  disabled={isLoading || isDeleting}
                >
                  Deselect All
                </Button>
              </div>
            </div>
            {fixtures.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">
                No fixtures available. Add fixtures first.
              </p>
            ) : (
              <ScrollArea className="flex-1 min-h-0 border border-zinc-700 rounded-lg">
                <div className="p-2 space-y-1 max-h-40">
                  {fixtures.map((fixture) => (
                    <label
                      key={fixture.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-zinc-800 ${
                        selectedFixtureIds.has(fixture.id)
                          ? "bg-zinc-800"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFixtureIds.has(fixture.id)}
                        onChange={() => handleFixtureToggle(fixture.id)}
                        disabled={isLoading || isDeleting}
                        className="rounded border-zinc-600 text-emerald-600"
                      />
                      <span className="text-sm text-zinc-200">
                        {fixture.name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        (Ch {fixture.startAddress}+{fixture.channelCount})
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
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

          <DialogFooter className="gap-3 pt-2">
            {group && onDelete && (
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
              {isLoading ? "Saving..." : group ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
