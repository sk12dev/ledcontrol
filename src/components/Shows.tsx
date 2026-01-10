import { useShows } from "../hooks/useShows";
import { useState } from "react";

interface ShowsProps {
  onEdit?: (showId: number) => void;
}

export function Shows({ onEdit }: ShowsProps) {
  const {
    shows,
    loading,
    error,
    deleteShow,
  } = useShows();

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (showId: number) => {
    if (!confirm("Are you sure you want to delete this show? This will also delete all cues and cue lists associated with this show.")) {
      return;
    }

    setDeletingId(showId);
    try {
      await deleteShow(showId);
    } catch (error) {
      console.error("Failed to delete show:", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Shows</h2>
        <p className="text-gray-400">Loading shows...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Shows</h2>
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Shows</h2>

      {shows.length === 0 ? (
        <p className="text-gray-400">
          No shows found. Create a new show to get started.
        </p>
      ) : (
        <div className="space-y-6">
          {shows.map((show) => {
            const isDeleting = deletingId === show.id;
            const cueCount = show.cues?.length ?? 0;
            const cueListCount = show.cueLists?.length ?? 0;

            return (
              <div
                key={show.id}
                className="p-4 rounded-lg border bg-gray-700 border-gray-600"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{show.name}</h3>
                    </div>
                    {show.description && (
                      <p className="text-sm text-gray-400 mb-2">
                        {show.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>
                        {cueCount} cue{cueCount !== 1 ? "s" : ""}
                      </span>
                      <span>
                        {cueListCount} cue list{cueListCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(show.id)}
                        disabled={isDeleting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(show.id)}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
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
