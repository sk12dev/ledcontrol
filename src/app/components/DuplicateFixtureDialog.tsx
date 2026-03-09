import { useState, useMemo, useEffect } from "react";
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
import { dmxFixturesApi, type DmxFixture, type CreateDmxFixtureRequest } from "@/api/backendClient";

interface DuplicateFixtureDialogProps {
  fixture: DmxFixture;
  allFixtures: DmxFixture[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function getNextAvailableStartAddress(
  fixtures: DmxFixture[],
  artNetNodeId: number
): number {
  const nodeFixtures = fixtures.filter((f) => f.artNetNodeId === artNetNodeId);
  const maxEnd = nodeFixtures.reduce((max, f) => {
    const end = f.startAddress + f.channelCount - 1;
    return Math.max(max, end);
  }, 0);
  return maxEnd + 1;
}

function computeDuplicatePlan(
  fixture: DmxFixture,
  allFixtures: DmxFixture[],
  count: number
): { name: string; startAddress: number }[] {
  const result: { name: string; startAddress: number }[] = [];
  let nextStart = getNextAvailableStartAddress(allFixtures, fixture.artNetNodeId);

  for (let i = 0; i < count; i++) {
    const suffix = count > 1 ? ` (${i + 1})` : " (Copy)";
    result.push({
      name: `${fixture.name}${suffix}`,
      startAddress: nextStart,
    });
    nextStart += fixture.channelCount;
  }
  return result;
}

export function DuplicateFixtureDialog({
  fixture,
  allFixtures,
  isOpen,
  onClose,
  onSuccess,
}: DuplicateFixtureDialogProps) {
  const [count, setCount] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCount(1);
      setError(null);
    }
  }, [isOpen]);

  const plan = useMemo(() => {
    const safeCount = Math.max(1, Math.min(99, count));
    return computeDuplicatePlan(fixture, allFixtures, safeCount);
  }, [fixture, allFixtures, count]);

  const lastEnd = plan.length > 0 ? plan[plan.length - 1].startAddress + fixture.channelCount - 1 : 0;
  const exceedsLimit = lastEnd > 512;

  const handleSubmit = async () => {
    if (exceedsLimit) return;
    const safeCount = Math.max(1, Math.min(99, count));
    setIsCreating(true);
    setError(null);
    try {
      const purposes = Array.isArray(fixture.channelPurposes) ? fixture.channelPurposes : ["red", "green", "blue", "alpha"];
      let fixturesSoFar = [...allFixtures];
      for (let i = 0; i < safeCount; i++) {
        const nextStart = getNextAvailableStartAddress(fixturesSoFar, fixture.artNetNodeId);
        const suffix = safeCount > 1 ? ` (${i + 1})` : " (Copy)";
        const data: CreateDmxFixtureRequest = {
          name: `${fixture.name}${suffix}`,
          artNetNodeId: fixture.artNetNodeId,
          startAddress: nextStart,
          channelCount: fixture.channelCount,
          channelPurposes: purposes,
        };
        const created = await dmxFixturesApi.create(data);
        fixturesSoFar = [...fixturesSoFar, created];
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create duplicates");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[460px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white">Duplicate Fixture</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create copies of "{fixture.name}". Start addresses will be assigned sequentially to avoid overlaps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="count" className="text-zinc-300">
              Number of copies
            </Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={99}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              disabled={isCreating}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            {exceedsLimit && (
              <p className="text-sm text-red-400">Last fixture would end at channel {lastEnd}. DMX universe is 1–512.</p>
            )}
          </div>

          {plan.length > 0 && (
            <div className="space-y-2">
              <Label className="text-zinc-300">Preview</Label>
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 max-h-40 overflow-y-auto p-2">
                <div className="text-xs text-zinc-400 space-y-1">
                  {plan.map((p, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-zinc-300 truncate mr-2">{p.name}</span>
                      <span className="text-zinc-500 tabular-nums shrink-0">
                        Ch {p.startAddress}+{fixture.channelCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isCreating} className="border-zinc-700">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || exceedsLimit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isCreating ? "Creating..." : `Create ${plan.length} fixture${plan.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
