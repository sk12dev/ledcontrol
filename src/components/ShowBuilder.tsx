import { useState } from "react";
import {
  type Show,
  type CreateShowRequest,
  type UpdateShowRequest,
} from "../api/backendClient";

interface ShowBuilderProps {
  show?: Show;
  onSave: (show: CreateShowRequest | UpdateShowRequest) => Promise<void>;
  onCancel: () => void;
}

export function ShowBuilder({ show, onSave, onCancel }: ShowBuilderProps) {
  const [name, setName] = useState(show?.name || "");
  const [description, setDescription] = useState(show?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Show name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const showData: CreateShowRequest | UpdateShowRequest = {
        name: name.trim(),
        description: description.trim() || null,
      };

      await onSave(showData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save show"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          {show ? "Edit Show" : "Create Show"}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900 border border-red-500 rounded text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
            placeholder="Enter show name..."
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
            placeholder="Enter show description..."
            rows={3}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  );
}
