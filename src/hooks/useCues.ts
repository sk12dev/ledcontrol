import { useState, useEffect, useCallback } from "react";
import {
  cuesApi,
  executionApi,
  type Cue,
  type CreateCueRequest,
  type UpdateCueRequest,
  type ExecutionStatus,
} from "../api/backendClient";

interface UseCuesReturn {
  cues: Cue[];
  loading: boolean;
  error: string | null;
  executionStatus: ExecutionStatus | null;
  fetchCues: () => Promise<void>;
  createCue: (cue: CreateCueRequest) => Promise<Cue>;
  updateCue: (id: number, cue: UpdateCueRequest) => Promise<Cue>;
  deleteCue: (id: number) => Promise<void>;
  executeCue: (id: number) => Promise<void>;
  stopExecution: () => Promise<void>;
  fetchExecutionStatus: () => Promise<void>;
  refreshCues: () => Promise<void>;
}

export function useCues(userId?: number): UseCuesReturn {
  const [cues, setCues] = useState<Cue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(null);

  const fetchCues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cuesApi.getAll(userId);
      setCues(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch cues";
      setError(errorMessage);
      console.error("Error fetching cues:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createCue = useCallback(async (cue: CreateCueRequest): Promise<Cue> => {
    try {
      setError(null);
      const newCue = await cuesApi.create(cue);
      await fetchCues(); // Refresh list
      return newCue;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create cue";
      setError(errorMessage);
      console.error("Error creating cue:", err);
      throw err;
    }
  }, [fetchCues]);

  const updateCue = useCallback(
    async (id: number, cue: UpdateCueRequest): Promise<Cue> => {
      try {
        setError(null);
        const updatedCue = await cuesApi.update(id, cue);
        await fetchCues(); // Refresh list
        return updatedCue;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update cue";
        setError(errorMessage);
        console.error("Error updating cue:", err);
        throw err;
      }
    },
    [fetchCues]
  );

  const deleteCue = useCallback(
    async (id: number): Promise<void> => {
      try {
        setError(null);
        await cuesApi.delete(id);
        await fetchCues(); // Refresh list
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete cue";
        setError(errorMessage);
        console.error("Error deleting cue:", err);
        throw err;
      }
    },
    [fetchCues]
  );

  const fetchExecutionStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await executionApi.getStatus();
      setExecutionStatus(status);
    } catch (err) {
      console.error("Error fetching execution status:", err);
      // Don't set error here, just log it
    }
  }, []);

  const executeCue = useCallback(async (id: number): Promise<void> => {
    try {
      setError(null);
      console.log("[Frontend useCues] Executing cue:", id);
      await cuesApi.execute(id);
      console.log("[Frontend useCues] Cue execution API call completed");
      // Wait a moment for the backend to initialize execution
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetchExecutionStatus(); // Update execution status
      console.log("[Frontend useCues] Execution status updated");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to execute cue";
      setError(errorMessage);
      console.error("[Frontend useCues] Error executing cue:", err);
      throw err;
    }
  }, [fetchExecutionStatus]);

  const stopExecution = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await executionApi.stop();
      await fetchExecutionStatus(); // Update execution status
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to stop execution";
      setError(errorMessage);
      console.error("Error stopping execution:", err);
      throw err;
    }
  }, [fetchExecutionStatus]);

  const refreshCues = useCallback(async (): Promise<void> => {
    await fetchCues();
  }, [fetchCues]);

  // Fetch cues on mount and when userId changes
  useEffect(() => {
    fetchCues();
  }, [fetchCues]);

  // Poll execution status while executing
  useEffect(() => {
    if (!executionStatus?.isRunning) {
      return;
    }

    const interval = setInterval(() => {
      fetchExecutionStatus();
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [executionStatus?.isRunning, fetchExecutionStatus]);

  // Initial fetch of execution status
  useEffect(() => {
    fetchExecutionStatus();
  }, [fetchExecutionStatus]);

  return {
    cues,
    loading,
    error,
    executionStatus,
    fetchCues,
    createCue,
    updateCue,
    deleteCue,
    executeCue,
    stopExecution,
    fetchExecutionStatus,
    refreshCues,
  };
}

