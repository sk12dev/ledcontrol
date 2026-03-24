import { useState, useMemo, useCallback, useRef } from "react";
import {
  LayoutGrid,
  Search,
  ChevronUp,
  ChevronDown,
  Trash2,
  ChevronsDownUp,
  GripVertical,
} from "lucide-react";
import { useCues } from "../hooks/useCues";
import { useShows } from "../hooks/useShows";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  type CueList,
  type CueListEntry,
  type CreateCueListRequest,
  type UpdateCueListRequest,
} from "../api/backendClient";
import { cn } from "@/app/components/ui/utils";

interface CueListBuilderProps {
  cueList?: CueList;
  showId?: number; // Optional - if not provided, will use cueList's showId or require selection
  onSave: (cueList: CreateCueListRequest | UpdateCueListRequest) => Promise<void>;
  onCancel: () => void;
}

/** Sum of fade in + hold + fade out when hold is finite (matches backend “step length” feel). */
function stepTotalSecondsDisplay(entry: CueListEntry): string {
  const fi = Number(entry.fadeInSeconds ?? 0);
  const fo = Number(entry.fadeOutSeconds ?? 0);
  const hold = entry.durationSeconds;
  if (hold == null) return "—";
  return `${(fi + fo + Number(hold)).toFixed(2)}s`;
}

export function CueListBuilder({ cueList, showId: propShowId, onSave, onCancel }: CueListBuilderProps) {
  const { shows } = useShows();
  const { cues, loading: cuesLoading } = useCues();
  const [name, setName] = useState(cueList?.name || "");
  const [description, setDescription] = useState(cueList?.description || "");
  const [selectedShowId, setSelectedShowId] = useState<number | null>(
    propShowId ?? cueList?.showId ?? null
  );
  const [entries, setEntries] = useState<CueListEntry[]>(() => {
    if (cueList?.cueListCues) {
      return cueList.cueListCues
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          cueId: item.cueId,
          fadeInSeconds: Number(item.fadeInSeconds ?? 0),
          fadeOutSeconds: Number(item.fadeOutSeconds ?? 0),
          durationSeconds: item.durationSeconds != null ? Number(item.durationSeconds) : null,
          repeatIntervalSeconds: Number(item.repeatIntervalSeconds ?? 0),
          repeatTotalPlays: item.repeatTotalPlays ?? null,
        }));
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cueSearch, setCueSearch] = useState("");
  const [bulkTimingOpen, setBulkTimingOpen] = useState(false);

  /** Template values for “apply to all”; entries stay independent after apply. */
  const [bulkFadeIn, setBulkFadeIn] = useState(0);
  const [bulkFadeOut, setBulkFadeOut] = useState(0);
  const [bulkDurationText, setBulkDurationText] = useState("");
  const [bulkApplyFadeIn, setBulkApplyFadeIn] = useState(true);
  const [bulkApplyFadeOut, setBulkApplyFadeOut] = useState(true);
  const [bulkApplyDuration, setBulkApplyDuration] = useState(true);
  const [bulkRepeatInterval, setBulkRepeatInterval] = useState(0);
  const [bulkRepeatTotalText, setBulkRepeatTotalText] = useState("");
  const [bulkApplyRepeatInterval, setBulkApplyRepeatInterval] = useState(true);
  const [bulkApplyRepeatTotal, setBulkApplyRepeatTotal] = useState(true);

  // Filter cues by selected show
  const availableCues = useMemo(() => {
    if (!selectedShowId) return [];
    return cues.filter((cue) => cue.showId === selectedShowId);
  }, [cues, selectedShowId]);

  const filteredAvailableCues = useMemo(() => {
    const q = cueSearch.trim().toLowerCase();
    if (!q) return availableCues;
    return availableCues.filter(
      (cue) =>
        cue.name.toLowerCase().includes(q) ||
        (cue.description?.toLowerCase().includes(q) ?? false)
    );
  }, [availableCues, cueSearch]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Cue list name is required");
      return;
    }

    if (!selectedShowId) {
      setError("Show selection is required");
      return;
    }

    if (entries.length === 0) {
      setError("At least one cue must be selected");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const cueListData: CreateCueListRequest | UpdateCueListRequest = {
        name: name.trim(),
        description: description.trim() || null,
        ...(cueList 
          ? (selectedShowId !== cueList.showId ? { showId: selectedShowId } : {}) // Update if show changed
          : { showId: selectedShowId } // Required for new cue lists
        ),
        cues: entries.map((e) => {
          const interval = e.repeatIntervalSeconds ?? 0;
          return {
            cueId: e.cueId,
            fadeInSeconds: e.fadeInSeconds ?? 0,
            fadeOutSeconds: e.fadeOutSeconds ?? 0,
            durationSeconds: e.durationSeconds ?? null,
            repeatIntervalSeconds: interval,
            repeatTotalPlays:
              interval > 0 ? (e.repeatTotalPlays ?? null) : null,
          };
        }),
      };

      await onSave(cueListData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save cue list"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCueAdd = (cueId: number) => {
    setEntries([...entries, { cueId, fadeInSeconds: 0, fadeOutSeconds: 0, durationSeconds: null }]);
  };

  const handleRemoveByIndex = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...entries];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setEntries(next);
  };

  const handleMoveDown = (index: number) => {
    if (index === entries.length - 1) return;
    const next = [...entries];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setEntries(next);
  };

  const moveEntry = useCallback((from: number, to: number) => {
    if (from === to) return;
    setEntries((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  /** Drag source row index; ref avoids stale reads in drop handler. */
  const dragSourceRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const updateEntryTiming = (
    index: number,
    patch: Partial<
      Pick<
        CueListEntry,
        | "fadeInSeconds"
        | "fadeOutSeconds"
        | "durationSeconds"
        | "repeatIntervalSeconds"
        | "repeatTotalPlays"
      >
    >
  ) => {
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const merged = { ...e, ...patch };
        if ((merged.repeatIntervalSeconds ?? 0) <= 0) {
          merged.repeatTotalPlays = null;
        }
        return merged;
      })
    );
  };

  const applyBulkTimingToAll = () => {
    if (entries.length === 0) return;
    if (
      !bulkApplyFadeIn &&
      !bulkApplyFadeOut &&
      !bulkApplyDuration &&
      !bulkApplyRepeatInterval &&
      !bulkApplyRepeatTotal
    ) {
      return;
    }

    const durationParsed =
      bulkDurationText.trim() === ""
        ? null
        : parseFloat(bulkDurationText.trim()) || 0;

    const repeatTotalParsed =
      bulkRepeatTotalText.trim() === ""
        ? null
        : Math.max(1, parseInt(bulkRepeatTotalText.trim(), 10) || 1);

    setEntries((prev) =>
      prev.map((e) => {
        const next = { ...e };
        if (bulkApplyFadeIn) next.fadeInSeconds = bulkFadeIn;
        if (bulkApplyFadeOut) next.fadeOutSeconds = bulkFadeOut;
        if (bulkApplyDuration) next.durationSeconds = durationParsed;
        if (bulkApplyRepeatInterval) {
          next.repeatIntervalSeconds = bulkRepeatInterval;
          if (bulkRepeatInterval <= 0) next.repeatTotalPlays = null;
        }
        if (bulkApplyRepeatTotal) {
          const iv = bulkApplyRepeatInterval
            ? bulkRepeatInterval
            : (next.repeatIntervalSeconds ?? 0);
          if (iv > 0) {
            next.repeatTotalPlays = repeatTotalParsed;
          }
        }
        return next;
      })
    );
  };

  const title = cueList ? "Edit Cue List" : "Create Cue List";
  const canSave = name.trim().length > 0 && entries.length > 0;

  const cellInputClass =
    "h-8 w-[4.25rem] min-w-0 text-xs bg-zinc-950 border border-zinc-700 rounded px-1.5 text-white tabular-nums focus-visible:ring-1 focus-visible:ring-emerald-500";

  if (cuesLoading) {
    return (
      <div className="bg-zinc-900 rounded-lg">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="border-zinc-700" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" disabled className="bg-emerald-600 opacity-50">
              Save
            </Button>
          </div>
        </div>
        <p className="text-zinc-400">Loading cues...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg flex flex-col gap-4 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="outline" className="border-zinc-700" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950 border border-red-700 rounded text-red-200 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_1fr] gap-4 lg:gap-6 items-start">
        {/* Meta: name, show, description — full width row above split on small screens */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">
              Cue list name <span className="text-red-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Cue List"
              disabled={saving}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">
              Show <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedShowId ?? ""}
              onChange={(e) => {
                const newShowId = parseInt(e.target.value, 10) || null;
                setSelectedShowId(newShowId);
                if (newShowId !== selectedShowId) setEntries([]);
              }}
              disabled={!!cueList && !!cueList.showId}
              className="w-full h-9 px-3 rounded-md bg-zinc-800 text-white border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <option value="">Select a show...</option>
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.name}
                </option>
              ))}
            </select>
            {cueList && cueList.showId && (
              <p className="text-xs text-zinc-500">
                Show is fixed for this list. Duplicate the list to use another show.
              </p>
            )}
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes for this cue list"
              rows={2}
              disabled={saving}
              className="w-full px-3 py-2 bg-zinc-800 text-white rounded-md border border-zinc-700 text-sm resize-y min-h-[2.5rem]"
            />
          </div>
        </div>

        {/* Left: cue library */}
        <aside className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden min-h-[280px] h-[min(65vh,620px)] max-h-[min(75vh,680px)]">
          <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-zinc-200">Cues</span>
            <span className="text-xs text-zinc-500 tabular-nums">
              {selectedShowId ? filteredAvailableCues.length : 0}
            </span>
          </div>
          <div className="p-2 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                value={cueSearch}
                onChange={(e) => setCueSearch(e.target.value)}
                placeholder="Search cues..."
                disabled={saving || !selectedShowId}
                className="pl-8 h-9 bg-zinc-900 border-zinc-700 text-white text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1">
              {!selectedShowId ? (
                <p className="text-zinc-500 text-sm px-1 py-2">Select a show to list cues.</p>
              ) : availableCues.length === 0 ? (
                <p className="text-zinc-500 text-sm px-1 py-2">No cues for this show yet.</p>
              ) : filteredAvailableCues.length === 0 ? (
                <p className="text-zinc-500 text-sm px-1 py-2">No cues match your search.</p>
              ) : (
                filteredAvailableCues.map((cue) => {
                  const count = entries.filter((e) => e.cueId === cue.id).length;
                  return (
                    <button
                      key={cue.id}
                      type="button"
                      onClick={() => handleCueAdd(cue.id)}
                      disabled={saving}
                      className={cn(
                        "w-full rounded-md px-2 py-2 text-left transition-colors",
                        "border border-transparent hover:bg-zinc-800/80 hover:border-zinc-700",
                        "flex gap-2 items-start"
                      )}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-emerald-900/60 bg-emerald-950/40 text-emerald-500">
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-white text-sm leading-tight truncate">
                          {cue.name}
                        </span>
                        {cue.description && (
                          <span className="block text-xs text-zinc-500 line-clamp-2 mt-0.5">
                            {cue.description}
                          </span>
                        )}
                        {count > 0 && (
                          <span className="inline-block mt-1 text-[11px] text-emerald-400/90">
                            In list ×{count}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Right: sequence table */}
        <div className="flex min-h-0 flex-col gap-3 min-w-0 h-[min(65vh,620px)] max-h-[min(75vh,680px)]">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-zinc-200">Cue list sequence</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Add cues from the left. Drag the grip to reorder steps (or use arrows). Edit fade, hold, and repeat per step. Total = fade in + hold + fade out (hold empty → manual advance).
              </p>
            </div>
          </div>

          {entries.length > 0 && (
            <div className="shrink-0 rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950/30">
              <button
                type="button"
                onClick={() => setBulkTimingOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              >
                <span>Bulk timing (apply to all steps)</span>
                <ChevronsDownUp className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>
              {bulkTimingOpen && (
                <div className="border-t border-zinc-800 p-3 space-y-3 bg-zinc-900/40">
                  <p className="text-xs text-zinc-500">
                    Choose fields below, then apply. Each row keeps independent values afterward.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-0.5">Fade in (s)</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={bulkFadeIn}
                        onChange={(e) => setBulkFadeIn(parseFloat(e.target.value) || 0)}
                        disabled={saving}
                        className="h-8 bg-zinc-950 border-zinc-700 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-0.5">Fade out (s)</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={bulkFadeOut}
                        onChange={(e) => setBulkFadeOut(parseFloat(e.target.value) || 0)}
                        disabled={saving}
                        className="h-8 bg-zinc-950 border-zinc-700 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-0.5">Hold (s) — empty = ∞</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        placeholder="∞"
                        value={bulkDurationText}
                        onChange={(e) => setBulkDurationText(e.target.value)}
                        disabled={saving}
                        className="h-8 bg-zinc-950 border-zinc-700 text-white text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-0.5">Repeat every (s)</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={bulkRepeatInterval}
                        onChange={(e) => setBulkRepeatInterval(parseFloat(e.target.value) || 0)}
                        disabled={saving}
                        className="h-8 bg-zinc-950 border-zinc-700 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-0.5">Total plays — empty = ∞</label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="∞"
                        value={bulkRepeatTotalText}
                        onChange={(e) => setBulkRepeatTotalText(e.target.value)}
                        disabled={saving}
                        className="h-8 bg-zinc-950 border-zinc-700 text-white text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bulkApplyFadeIn}
                        onChange={(e) => setBulkApplyFadeIn(e.target.checked)}
                        disabled={saving}
                        className="rounded border-zinc-600 bg-zinc-800 text-emerald-600"
                      />
                      Fade in
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bulkApplyFadeOut}
                        onChange={(e) => setBulkApplyFadeOut(e.target.checked)}
                        disabled={saving}
                        className="rounded border-zinc-600 bg-zinc-800 text-emerald-600"
                      />
                      Fade out
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bulkApplyDuration}
                        onChange={(e) => setBulkApplyDuration(e.target.checked)}
                        disabled={saving}
                        className="rounded border-zinc-600 bg-zinc-800 text-emerald-600"
                      />
                      Hold
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bulkApplyRepeatInterval}
                        onChange={(e) => setBulkApplyRepeatInterval(e.target.checked)}
                        disabled={saving}
                        className="rounded border-zinc-600 bg-zinc-800 text-emerald-600"
                      />
                      Repeat interval
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bulkApplyRepeatTotal}
                        onChange={(e) => setBulkApplyRepeatTotal(e.target.checked)}
                        disabled={saving}
                        className="rounded border-zinc-600 bg-zinc-800 text-emerald-600"
                      />
                      Total plays
                    </label>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyBulkTimingToAll}
                    disabled={
                      saving ||
                      entries.length === 0 ||
                      (!bulkApplyFadeIn &&
                        !bulkApplyFadeOut &&
                        !bulkApplyDuration &&
                        !bulkApplyRepeatInterval &&
                        !bulkApplyRepeatTotal)
                    }
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Apply to all {entries.length} step{entries.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 rounded-lg border border-zinc-800 overflow-hidden flex flex-col min-h-0">
            {entries.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-zinc-500 text-sm">
                No steps yet. Click a cue on the left to add it to this list.
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/90 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                      <th
                        className="sticky top-0 z-10 bg-zinc-900/95 px-1 py-2 w-9"
                        title="Drag to reorder"
                      />
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-1 py-2 w-10">#</th>
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-2 py-2 min-w-[140px]">Cue</th>
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-1 py-2">Fade in</th>
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-1 py-2">Hold</th>
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-1 py-2">Fade out</th>
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-2 py-2 w-[4.5rem]">Total</th>
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-1 py-2">Rpt s</th>
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-1 py-2">Plays</th>
                      <th className="sticky top-0 z-10 bg-zinc-900/95 px-1 py-2 w-[5.5rem] text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => {
                      const cue = cues.find((c) => c.id === entry.cueId);
                      return (
                        <tr
                          key={`${entry.cueId}-${index}`}
                          className={cn(
                            "border-b border-zinc-800/80 transition-colors",
                            index % 2 === 0 ? "bg-zinc-900/25" : "bg-zinc-800/20",
                            draggingIndex === index && "opacity-50",
                            dragOverIndex === index &&
                              draggingIndex !== null &&
                              draggingIndex !== index &&
                              "bg-emerald-950/25 ring-1 ring-inset ring-emerald-500/40"
                          )}
                          onDragOver={(e) => {
                            if (dragSourceRef.current === null) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDragOverIndex(index);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const from = dragSourceRef.current;
                            if (from == null || saving) return;
                            moveEntry(from, index);
                            dragSourceRef.current = null;
                            setDraggingIndex(null);
                            setDragOverIndex(null);
                          }}
                        >
                          <td className="px-1 py-1 align-middle w-9">
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label="Drag to reorder"
                              draggable={!saving}
                              onDragStart={(e) => {
                                dragSourceRef.current = index;
                                setDraggingIndex(index);
                                e.dataTransfer.setData("text/plain", String(index));
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => {
                                dragSourceRef.current = null;
                                setDraggingIndex(null);
                                setDragOverIndex(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp" && index > 0) {
                                  e.preventDefault();
                                  handleMoveUp(index);
                                }
                                if (e.key === "ArrowDown" && index < entries.length - 1) {
                                  e.preventDefault();
                                  handleMoveDown(index);
                                }
                              }}
                              className={cn(
                                "inline-flex h-7 w-7 items-center justify-center rounded text-zinc-500",
                                saving
                                  ? "cursor-not-allowed opacity-40"
                                  : "cursor-grab active:cursor-grabbing hover:bg-zinc-800 hover:text-zinc-300"
                              )}
                            >
                              <GripVertical className="w-4 h-4 shrink-0" />
                            </span>
                          </td>
                          <td className="px-1 py-1.5 align-middle text-zinc-500 tabular-nums text-xs">
                            {index + 1}
                          </td>
                          <td className="px-2 py-1.5 align-middle">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-emerald-900/50 bg-emerald-950/30 text-emerald-500">
                                <LayoutGrid className="w-3 h-3" />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-medium text-white truncate">
                                  {cue?.name || `Cue ${entry.cueId}`}
                                </span>
                                {cue?.description && (
                                  <span className="block text-[11px] text-zinc-500 line-clamp-1">
                                    {cue.description}
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="px-1 py-1 align-middle">
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={entry.fadeInSeconds ?? 0}
                              onChange={(e) =>
                                updateEntryTiming(index, {
                                  fadeInSeconds: parseFloat(e.target.value) || 0,
                                })
                              }
                              disabled={saving}
                              className={cellInputClass}
                            />
                          </td>
                          <td className="px-1 py-1 align-middle">
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              placeholder="∞"
                              value={entry.durationSeconds ?? ""}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                updateEntryTiming(index, {
                                  durationSeconds: v === "" ? null : parseFloat(v) || 0,
                                });
                              }}
                              disabled={saving}
                              className={cellInputClass}
                            />
                          </td>
                          <td className="px-1 py-1 align-middle">
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={entry.fadeOutSeconds ?? 0}
                              onChange={(e) =>
                                updateEntryTiming(index, {
                                  fadeOutSeconds: parseFloat(e.target.value) || 0,
                                })
                              }
                              disabled={saving}
                              className={cellInputClass}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-middle text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                            {stepTotalSecondsDisplay(entry)}
                          </td>
                          <td className="px-1 py-1 align-middle">
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={entry.repeatIntervalSeconds ?? 0}
                              onChange={(e) =>
                                updateEntryTiming(index, {
                                  repeatIntervalSeconds: parseFloat(e.target.value) || 0,
                                })
                              }
                              disabled={saving}
                              className={cellInputClass}
                            />
                          </td>
                          <td className="px-1 py-1 align-middle">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="∞"
                              value={
                                (entry.repeatIntervalSeconds ?? 0) > 0
                                  ? entry.repeatTotalPlays ?? ""
                                  : ""
                              }
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                updateEntryTiming(index, {
                                  repeatTotalPlays:
                                    v === "" ? null : Math.max(1, parseInt(v, 10) || 1),
                                });
                              }}
                              disabled={saving || (entry.repeatIntervalSeconds ?? 0) <= 0}
                              className={cn(cellInputClass, "disabled:opacity-40")}
                            />
                          </td>
                          <td className="px-1 py-1 align-middle text-right">
                            <div className="inline-flex flex-col gap-0.5">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-zinc-400 hover:text-white"
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0 || saving}
                                title="Move up"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-zinc-400 hover:text-white"
                                onClick={() => handleMoveDown(index)}
                                disabled={index === entries.length - 1 || saving}
                                title="Move down"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-400/90 hover:text-red-300 hover:bg-red-950/50"
                                onClick={() => handleRemoveByIndex(index)}
                                disabled={saving}
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

