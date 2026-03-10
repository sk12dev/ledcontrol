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
        }));
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        cues: entries.map((e) => ({
          cueId: e.cueId,
          fadeInSeconds: e.fadeInSeconds ?? 0,
          fadeOutSeconds: e.fadeOutSeconds ?? 0,
          durationSeconds: e.durationSeconds ?? null,
        })),
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

  const updateEntryTiming = (index: number, patch: Partial<Pick<CueListEntry, "fadeInSeconds" | "fadeOutSeconds" | "durationSeconds">>) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e))
    );
  };

  if (cuesLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">
          {cueList ? "Edit Cue List" : "Create Cue List"}
        </h2>
        <p className="text-gray-400">Loading cues...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">
        {cueList ? "Edit Cue List" : "Create Cue List"}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter cue list name"
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={saving}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter cue list description (optional)"
            rows={3}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={saving}
          />
        </div>

        {/* Show Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
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
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-xs text-gray-400 mt-1">
              Cue list is associated with this show. To change the show, create a new cue list.
            </p>
          )}
        </div>

        {/* Cue Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Cues <span className="text-red-400">*</span>
          </label>
          {!selectedShowId ? (
            <p className="text-gray-400 text-sm">
              Please select a show first to see available cues.
            </p>
          ) : availableCues.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No cues available for the selected show. Create cues for this show first.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-600 rounded-lg p-3 bg-gray-700/50">
              {availableCues.map((cue) => {
                const count = entries.filter((e) => e.cueId === cue.id).length;
                return (
                  <button
                    key={cue.id}
                    onClick={() => handleCueAdd(cue.id)}
                    className="w-full p-3 rounded text-left transition-colors bg-gray-600 hover:bg-gray-500"
                    disabled={saving}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center border-2 border-gray-400 rounded">
                        <span className="text-xs text-gray-300">+</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{cue.name}</div>
                        {cue.description && (
                          <div className="text-xs text-gray-300 mt-1">
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cue Order & Timing
            </label>
            <div className="space-y-3 border border-gray-600 rounded-lg p-3 bg-gray-700/50">
              {entries.map((entry, index) => {
                const cue = cues.find((c) => c.id === entry.cueId);
                return (
                  <div
                    key={`${entry.cueId}-${index}`}
                    className="p-3 bg-gray-600 rounded space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0 || saving}
                        className="px-2 py-1 bg-gray-500 hover:bg-gray-400 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === entries.length - 1 || saving}
                        className="px-2 py-1 bg-gray-500 hover:bg-gray-400 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs"
                      >
                        ↓
                      </button>
                      <span className="text-xs text-gray-400">#{index + 1}</span>
                      <span className="font-medium text-white flex-1">
                        {cue?.name || `Cue ${entry.cueId}`}
                      </span>
                      <button
                        onClick={() => handleRemoveByIndex(index)}
                        disabled={saving}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Fade in (s)</label>
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
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Fade out (s)</label>
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
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Duration (s) — empty = ∞</label>
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
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || entries.length === 0}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white font-medium"
          >
            {saving ? "Saving..." : cueList ? "Update" : "Create"}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

