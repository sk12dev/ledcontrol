import { useCues } from "../hooks/useCues";
import { useState } from "react";

interface CueListProps {
  onEdit?: (cueId: number) => void;
  onExecute?: (cueId: number) => void;
}

export function CueList({ onEdit, onExecute }: CueListProps) {
  const {
    cues,
    loading,
    error,
    deleteCue,
    executeCue,
    executionStatus,
  } = useCues();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (cueId: number) => {
    if (!confirm("Are you sure you want to delete this cue?")) {
      return;
    }

    setDeletingId(cueId);
    try {
      await deleteCue(cueId);
    } catch (error) {
      console.error("Failed to delete cue:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExecute = async (cueId: number) => {
    if (onExecute) {
      onExecute(cueId);
    } else {
      try {
        await executeCue(cueId);
      } catch (error) {
        console.error("Failed to execute cue:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Cues</h2>
        <p className="text-gray-400">Loading cues...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Cues</h2>
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Cues</h2>

      {cues.length === 0 ? (
        <p className="text-gray-400">No cues found. Create a new cue to get started.</p>
      ) : (
        <div className="space-y-3">
          {cues.map((cue) => {
            const isExecuting =
              executionStatus?.isRunning && executionStatus?.cueId === cue.id;
            const stepCount = cue.cueSteps.length;
            const deviceCount = new Set(
              cue.cueSteps.flatMap((step) =>
                step.cueStepDevices.map((csd) => csd.deviceId)
              )
            ).size;

            return (
              <div
                key={cue.id}
                className={`p-4 rounded-lg border ${
                  isExecuting
                    ? "bg-green-900 border-green-500"
                    : "bg-gray-700 border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{cue.name}</h3>
                      {isExecuting && (
                        <span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium">
                          Executing...
                        </span>
                      )}
                    </div>
                    {cue.description && (
                      <p className="text-sm text-gray-400 mb-2">{cue.description}</p>
                    )}
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>{stepCount} step{stepCount !== 1 ? "s" : ""}</span>
                      <span>{deviceCount} device{deviceCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExecute(cue.id)}
                      disabled={isExecuting || executionStatus?.isRunning}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
                    >
                      {isExecuting ? "Executing..." : "Execute"}
                    </button>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(cue.id)}
                        disabled={isExecuting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(cue.id)}
                      disabled={isExecuting || deletingId === cue.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
                    >
                      {deletingId === cue.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

