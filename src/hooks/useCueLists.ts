import { useState, useEffect, useCallback } from "react";
import {
  cueListsApi,
  type CueList,
  type CreateCueListRequest,
  type UpdateCueListRequest,
} from "../api/backendClient";

interface UseCueListsReturn {
  cueLists: CueList[];
  loading: boolean;
  error: string | null;
  fetchCueLists: () => Promise<void>;
  createCueList: (cueList: CreateCueListRequest) => Promise<CueList>;
  updateCueList: (id: number, cueList: UpdateCueListRequest) => Promise<CueList>;
  deleteCueList: (id: number) => Promise<void>;
  stepForward: (id: number) => Promise<CueList>;
  stepBackward: (id: number) => Promise<CueList>;
  goTo: (id: number, position: number) => Promise<CueList>;
  refreshCueLists: () => Promise<void>;
}

export function useCueLists(userId?: number, showId?: number): UseCueListsReturn {
  const [cueLists, setCueLists] = useState<CueList[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCueLists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: { userId?: number; showId?: number } = {};
      if (userId !== undefined) filters.userId = userId;
      if (showId !== undefined) filters.showId = showId;
      const data = await cueListsApi.getAll(Object.keys(filters).length > 0 ? filters : undefined);
      setCueLists(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch cue lists";
      setError(errorMessage);
      console.error("Error fetching cue lists:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, showId]);

  const createCueList = useCallback(
    async (cueList: CreateCueListRequest): Promise<CueList> => {
      try {
        setError(null);
        const newCueList = await cueListsApi.create(cueList);
        await fetchCueLists(); // Refresh list
        return newCueList;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create cue list";
        setError(errorMessage);
        console.error("Error creating cue list:", err);
        throw err;
      }
    },
    [fetchCueLists]
  );

  const updateCueList = useCallback(
    async (id: number, cueList: UpdateCueListRequest): Promise<CueList> => {
      try {
        setError(null);
        const updatedCueList = await cueListsApi.update(id, cueList);
        await fetchCueLists(); // Refresh list
        return updatedCueList;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update cue list";
        setError(errorMessage);
        console.error("Error updating cue list:", err);
        throw err;
      }
    },
    [fetchCueLists]
  );

  const deleteCueList = useCallback(
    async (id: number): Promise<void> => {
      try {
        setError(null);
        await cueListsApi.delete(id);
        await fetchCueLists(); // Refresh list
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete cue list";
        setError(errorMessage);
        console.error("Error deleting cue list:", err);
        throw err;
      }
    },
    [fetchCueLists]
  );

  const stepForward = useCallback(
    async (id: number): Promise<CueList> => {
      try {
        setError(null);
        const updatedCueList = await cueListsApi.stepForward(id);
        // Update the specific cue list in the state
        setCueLists((prev) =>
          prev.map((list) => (list.id === id ? updatedCueList : list))
        );
        return updatedCueList;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to step forward";
        setError(errorMessage);
        console.error("Error stepping forward:", err);
        throw err;
      }
    },
    []
  );

  const stepBackward = useCallback(
    async (id: number): Promise<CueList> => {
      try {
        setError(null);
        const updatedCueList = await cueListsApi.stepBackward(id);
        // Update the specific cue list in the state
        setCueLists((prev) =>
          prev.map((list) => (list.id === id ? updatedCueList : list))
        );
        return updatedCueList;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to step backward";
        setError(errorMessage);
        console.error("Error stepping backward:", err);
        throw err;
      }
    },
    []
  );

  const goTo = useCallback(
    async (id: number, position: number): Promise<CueList> => {
      try {
        setError(null);
        const updatedCueList = await cueListsApi.goTo(id, position);
        // Update the specific cue list in the state
        setCueLists((prev) =>
          prev.map((list) => (list.id === id ? updatedCueList : list))
        );
        return updatedCueList;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to go to position";
        setError(errorMessage);
        console.error("Error going to position:", err);
        throw err;
      }
    },
    []
  );

  const refreshCueLists = useCallback(async (): Promise<void> => {
    await fetchCueLists();
  }, [fetchCueLists]);

  // Fetch cue lists on mount and when userId changes
  useEffect(() => {
    fetchCueLists();
  }, [fetchCueLists]);

  return {
    cueLists,
    loading,
    error,
    fetchCueLists,
    createCueList,
    updateCueList,
    deleteCueList,
    stepForward,
    stepBackward,
    goTo,
    refreshCueLists,
  };
}

