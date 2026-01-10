import { useState, useMemo } from "react";
import { useCues } from "../hooks/useCues";
import { useShows } from "../hooks/useShows";
import {
  type CueList,
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
  const [selectedCueIds, setSelectedCueIds] = useState<number[]>(() => {
    if (cueList?.cueListCues) {
      return cueList.cueListCues
        .sort((a, b) => a.order - b.order)
        .map((item) => item.cueId);
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

    if (selectedCueIds.length === 0) {
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
        cueIds: selectedCueIds,
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

  const handleCueToggle = (cueId: number) => {
    if (selectedCueIds.includes(cueId)) {
      setSelectedCueIds(selectedCueIds.filter((id) => id !== cueId));
    } else {
      setSelectedCueIds([...selectedCueIds, cueId]);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newIds = [...selectedCueIds];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    setSelectedCueIds(newIds);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedCueIds.length - 1) return;
    const newIds = [...selectedCueIds];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    setSelectedCueIds(newIds);
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
                setSelectedCueIds([]);
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
                const isSelected = selectedCueIds.includes(cue.id);
                return (
                  <button
                    key={cue.id}
                    onClick={() => handleCueToggle(cue.id)}
                    className={`w-full p-3 rounded text-left transition-colors ${
                      isSelected
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-600 hover:bg-gray-500"
                    }`}
                    disabled={saving}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleCueToggle(cue.id)}
                        className="w-4 h-4"
                        disabled={saving}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">{cue.name}</div>
                        {cue.description && (
                          <div className="text-xs text-gray-300 mt-1">
                            {cue.description}
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

        {/* Selected Cues Order */}
        {selectedCueIds.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cue Order (Drag to reorder or use buttons)
            </label>
            <div className="space-y-2 border border-gray-600 rounded-lg p-3 bg-gray-700/50">
              {selectedCueIds.map((cueId, index) => {
                const cue = cues.find((c) => c.id === cueId);
                return (
                  <div
                    key={cueId}
                    className="flex items-center gap-2 p-2 bg-gray-600 rounded"
                  >
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || saving}
                      className="px-2 py-1 bg-gray-500 hover:bg-gray-400 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === selectedCueIds.length - 1 || saving}
                      className="px-2 py-1 bg-gray-500 hover:bg-gray-400 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs"
                    >
                      ↓
                    </button>
                    <div className="flex-1 text-white">
                      <span className="text-xs text-gray-400 mr-2">
                        #{index + 1}
                      </span>
                      {cue?.name || `Cue ${cueId}`}
                    </div>
                    <button
                      onClick={() => handleCueToggle(cueId)}
                      disabled={saving}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs"
                    >
                      Remove
                    </button>
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
            disabled={saving || !name.trim() || selectedCueIds.length === 0}
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

