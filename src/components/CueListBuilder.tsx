import { useState, useMemo } from "react";
import { useCues } from "../hooks/useCues";
import { useShows } from "../hooks/useShows";
import {
  type CueList,
  type CueListEntry,
  type CreateCueListRequest,
  type UpdateCueListRequest,
} from "../api/backendClient";

interface CueListBuilderProps {
  cueList?: CueList;
  showId?: number; // Optional - if not provided, will use cueList's showId or require selection
  onSave: (cueList: CreateCueListRequest | UpdateCueListRequest) => Promise<void>;
  onCancel: () => void;
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

  if (cuesLoading) {
    return (
      <div className="bg-zinc-900 rounded-lg">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <div className="flex gap-2 mr-10">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled
              className="px-4 py-2 bg-blue-600 rounded text-white opacity-50 cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
        <p className="text-zinc-400">Loading cues...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <div className="flex gap-2 mr-10">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed rounded text-white"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-950 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-300">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter cue list name"
            className="w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={saving}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter cue list description (optional)"
            rows={3}
            className="w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={saving}
          />
        </div>

        {/* Show Selection */}
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-300">
            Show <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedShowId ?? ""}
            onChange={(e) => {
              const newShowId = parseInt(e.target.value) || null;
              setSelectedShowId(newShowId);
              // Clear selected cues when show changes
              if (newShowId !== selectedShowId) {
                setEntries([]);
              }
            }}
            disabled={!!cueList && !!cueList.showId} // Disable if editing existing cueList with showId
            className="w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          >
            <option value="">Select a show...</option>
            {shows.map((show) => (
              <option key={show.id} value={show.id}>
                {show.name}
              </option>
            ))}
          </select>
          {cueList && cueList.showId && (
            <p className="text-xs text-zinc-400 mt-1">
              Cue list is associated with this show. To change the show, create a new cue list.
            </p>
          )}
        </div>

        {/* Cue Selection */}
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-300">
            Select Cues <span className="text-red-400">*</span>
          </label>
          {!selectedShowId ? (
            <p className="text-zinc-400 text-sm">
              Please select a show first to see available cues.
            </p>
          ) : availableCues.length === 0 ? (
            <p className="text-zinc-400 text-sm">
              No cues available for the selected show. Create cues for this show first.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
              {availableCues.map((cue) => {
                const count = entries.filter((e) => e.cueId === cue.id).length;
                return (
                  <button
                    key={cue.id}
                    type="button"
                    onClick={() => handleCueAdd(cue.id)}
                    className="w-full p-3 rounded text-left transition-colors bg-zinc-700 hover:bg-zinc-600"
                    disabled={saving}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center border-2 border-zinc-500 rounded">
                        <span className="text-xs text-zinc-300">+</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{cue.name}</div>
                        {cue.description && (
                          <div className="text-xs text-zinc-300 mt-1">
                            {cue.description}
                          </div>
                        )}
                        {count > 0 && (
                          <div className="text-xs text-blue-400 mt-1">
                            {count} time{count !== 1 ? "s" : ""} in list
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Cues Order + Per-cue timing */}
        {entries.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-300">
              Cue Order & Timing
            </label>
            <div className="space-y-3 border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
              <div className="rounded-md border border-zinc-600 bg-zinc-900/40 p-3 space-y-3">
                <div className="text-xs font-medium text-zinc-300">
                  Apply timing to all cues
                </div>
                <p className="text-xs text-zinc-500">
                  Choose which values to copy, then apply. Each cue keeps its own values afterward—you can still edit them individually.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-0.5">Fade in (s)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={bulkFadeIn}
                      onChange={(e) => setBulkFadeIn(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-0.5">Fade out (s)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={bulkFadeOut}
                      onChange={(e) => setBulkFadeOut(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-0.5">Duration (s) — empty = ∞</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="∞"
                      value={bulkDurationText}
                      onChange={(e) => setBulkDurationText(e.target.value)}
                      className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-0.5">
                      Repeat every (s) — 0 = no repeat
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={bulkRepeatInterval}
                      onChange={(e) => setBulkRepeatInterval(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-0.5">
                      Total plays when repeating — empty = ∞
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="∞"
                      value={bulkRepeatTotalText}
                      onChange={(e) => setBulkRepeatTotalText(e.target.value)}
                      className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                      disabled={saving}
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
                      className="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
                    />
                    Fade in
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkApplyFadeOut}
                      onChange={(e) => setBulkApplyFadeOut(e.target.checked)}
                      disabled={saving}
                      className="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
                    />
                    Fade out
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkApplyDuration}
                      onChange={(e) => setBulkApplyDuration(e.target.checked)}
                      disabled={saving}
                      className="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
                    />
                    Duration
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkApplyRepeatInterval}
                      onChange={(e) => setBulkApplyRepeatInterval(e.target.checked)}
                      disabled={saving}
                      className="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
                    />
                    Repeat interval
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkApplyRepeatTotal}
                      onChange={(e) => setBulkApplyRepeatTotal(e.target.checked)}
                      disabled={saving}
                      className="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
                    />
                    Total plays
                  </label>
                </div>
                <button
                  type="button"
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
                  className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white"
                >
                  Apply to all {entries.length} cue{entries.length !== 1 ? "s" : ""}
                </button>
              </div>

              {entries.map((entry, index) => {
                const cue = cues.find((c) => c.id === entry.cueId);
                return (
                  <div
                    key={`${entry.cueId}-${index}`}
                    className="p-3 bg-zinc-700 rounded space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0 || saving}
                        className="px-2 py-1 bg-zinc-600 hover:bg-zinc-500 disabled:bg-zinc-800 disabled:cursor-not-allowed rounded text-white text-xs"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === entries.length - 1 || saving}
                        className="px-2 py-1 bg-zinc-600 hover:bg-zinc-500 disabled:bg-zinc-800 disabled:cursor-not-allowed rounded text-white text-xs"
                      >
                        ↓
                      </button>
                      <span className="text-xs text-zinc-400">#{index + 1}</span>
                      <span className="font-medium text-white flex-1">
                        {cue?.name || `Cue ${entry.cueId}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveByIndex(index)}
                        disabled={saving}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-0.5">Fade in (s)</label>
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
                          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-0.5">Fade out (s)</label>
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
                          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-0.5">
                          Hold (s) after fade — empty = stay until step
                        </label>
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
                          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                          disabled={saving}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm pt-2 border-t border-zinc-600">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-0.5">
                          Repeat every (s)
                        </label>
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
                          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                          disabled={saving}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-zinc-400 mb-0.5">
                          Total plays (with repeat) — empty = ∞
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          placeholder={
                            (entry.repeatIntervalSeconds ?? 0) > 0 ? "∞" : "—"
                          }
                          value={
                            (entry.repeatIntervalSeconds ?? 0) > 0
                              ? entry.repeatTotalPlays ?? ""
                              : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            updateEntryTiming(index, {
                              repeatTotalPlays:
                                v === ""
                                  ? null
                                  : Math.max(1, parseInt(v, 10) || 1),
                            });
                          }}
                          disabled={saving || (entry.repeatIntervalSeconds ?? 0) <= 0}
                          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-xs disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

