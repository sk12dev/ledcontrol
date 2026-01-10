import { useState, useEffect, useCallback } from "react";
import {
  showsApi,
  type Show,
  type CreateShowRequest,
  type UpdateShowRequest,
} from "../api/backendClient";

interface UseShowsReturn {
  shows: Show[];
  loading: boolean;
  error: string | null;
  fetchShows: () => Promise<void>;
  createShow: (show: CreateShowRequest) => Promise<Show>;
  updateShow: (id: number, show: UpdateShowRequest) => Promise<Show>;
  deleteShow: (id: number) => Promise<void>;
  refreshShows: () => Promise<void>;
}

export function useShows(userId?: number): UseShowsReturn {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await showsApi.getAll(userId);
      setShows(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch shows";
      setError(errorMessage);
      console.error("Error fetching shows:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createShow = useCallback(
    async (show: CreateShowRequest): Promise<Show> => {
      try {
        setError(null);
        const newShow = await showsApi.create(show);
        await fetchShows(); // Refresh list
        return newShow;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create show";
        setError(errorMessage);
        console.error("Error creating show:", err);
        throw err;
      }
    },
    [fetchShows]
  );

  const updateShow = useCallback(
    async (id: number, show: UpdateShowRequest): Promise<Show> => {
      try {
        setError(null);
        const updatedShow = await showsApi.update(id, show);
        await fetchShows(); // Refresh list
        return updatedShow;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update show";
        setError(errorMessage);
        console.error("Error updating show:", err);
        throw err;
      }
    },
    [fetchShows]
  );

  const deleteShow = useCallback(
    async (id: number): Promise<void> => {
      try {
        setError(null);
        await showsApi.delete(id);
        await fetchShows(); // Refresh list
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete show";
        setError(errorMessage);
        console.error("Error deleting show:", err);
        throw err;
      }
    },
    [fetchShows]
  );

  const refreshShows = useCallback(async (): Promise<void> => {
    await fetchShows();
  }, [fetchShows]);

  // Fetch shows on mount and when userId changes
  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  return {
    shows,
    loading,
    error,
    fetchShows,
    createShow,
    updateShow,
    deleteShow,
    refreshShows,
  };
}
