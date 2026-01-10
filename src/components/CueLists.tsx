import { useCueLists } from "../hooks/useCueLists";
import { useCues } from "../hooks/useCues";
import { useState } from "react";
import type { CueList } from "../api/backendClient";

interface CueListsProps {
  onEdit?: (cueListId: number) => void;
}

export function CueLists({ onEdit }: CueListsProps) {
  const {
    cueLists,
    loading,
    error,
    deleteCueList,
    stepForward,
    stepBackward,
    goTo,
  } = useCueLists();

  const { cues } = useCues();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [steppingId, setSteppingId] = useState<number | null>(null);

  const handleDelete = async (cueListId: number) => {
    if (!confirm("Are you sure you want to delete this cue list?")) {
      return;
    }

    setDeletingId(cueListId);
    try {
      await deleteCueList(cueListId);
    } catch (error) {
      console.error("Failed to delete cue list:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStepForward = async (cueListId: number) => {
    setSteppingId(cueListId);
    try {
      await stepForward(cueListId);
    } catch (error) {
      console.error("Failed to step forward:", error);
    } finally {
      setSteppingId(null);
    }
  };

  const handleStepBackward = async (cueListId: number) => {
    setSteppingId(cueListId);
    try {
      await stepBackward(cueListId);
    } catch (error) {
      console.error("Failed to step backward:", error);
    } finally {
      setSteppingId(null);
    }
  };

  const handleGoTo = async (cueListId: number, position: number) => {
    setSteppingId(cueListId);
    try {
      await goTo(cueListId, position);
    } catch (error) {
      console.error("Failed to go to position:", error);
    } finally {
      setSteppingId(null);
    }
  };

  const getCurrentCue = (cueList: CueList) => {
    if (cueList.cueListCues.length === 0) return null;
    const currentCueItem = cueList.cueListCues[cueList.currentPosition];
    return currentCueItem?.cue ?? null;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Cue Lists</h2>
        <p className="text-gray-400">Loading cue lists...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Cue Lists</h2>
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Cue Lists</h2>

      {cueLists.length === 0 ? (
        <p className="text-gray-400">
          No cue lists found. Create a new cue list to get started.
        </p>
      ) : (
        <div className="space-y-6">
          {cueLists.map((cueList) => {
            const currentCue = getCurrentCue(cueList);
            const isStepping = steppingId === cueList.id;
            const canGoForward = cueList.currentPosition < cueList.cueListCues.length - 1;
            const canGoBackward = cueList.currentPosition > 0;
            const isDeleting = deletingId === cueList.id;

            return (
              <div
                key={cueList.id}
                className="p-4 rounded-lg border bg-gray-700 border-gray-600"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{cueList.name}</h3>
                      {currentCue && (
                        <span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium">
                          Active: {currentCue.name}
                        </span>
                      )}
                    </div>
                    {cueList.description && (
                      <p className="text-sm text-gray-400 mb-2">
                        {cueList.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>
                        {cueList.cueListCues.length} cue
                        {cueList.cueListCues.length !== 1 ? "s" : ""}
                      </span>
                      <span>
                        Position: {cueList.currentPosition + 1} /{" "}
                        {cueList.cueListCues.length || 1}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(cueList.id)}
                        disabled={isStepping || isDeleting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(cueList.id)}
                      disabled={isStepping || isDeleting}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                {/* Navigation Controls */}
                {cueList.cueListCues.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleStepBackward(cueList.id)}
                        disabled={!canGoBackward || isStepping || isDeleting}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 rounded text-white font-medium"
                      >
                        ← Previous
                      </button>
                      <div className="flex-1 flex items-center justify-center gap-2">
                        <span className="text-sm text-gray-400">
                          Step through:
                        </span>
                      </div>
                      <button
                        onClick={() => handleStepForward(cueList.id)}
                        disabled={!canGoForward || isStepping || isDeleting}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 rounded text-white font-medium"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {/* Cue List Items */}
                {cueList.cueListCues.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      Cues in list:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {cueList.cueListCues.map((cueItem, index) => {
                        const isActive = index === cueList.currentPosition;
                        const cue = cues.find((c) => c.id === cueItem.cueId);

                        return (
                          <button
                            key={cueItem.id}
                            onClick={() => handleGoTo(cueList.id, index)}
                            disabled={isStepping || isDeleting}
                            className={`p-3 rounded text-left transition-colors ${
                              isActive
                                ? "bg-green-700 border-2 border-green-500"
                                : "bg-gray-600 hover:bg-gray-500 border-2 border-transparent"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-400">
                                #{index + 1}
                              </span>
                              {isActive && (
                                <span className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs font-medium">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-medium text-white">
                              {cueItem.cue.name || cue?.name || `Cue ${cueItem.cueId}`}
                            </div>
                            {cueItem.cue.description && (
                              <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                {cueItem.cue.description}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {cueList.cueListCues.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    No cues in this list. Edit the list to add cues.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

