import { useState, useEffect, useCallback } from "react";
import { artnetNodesApi, type ArtNetNode } from "@/api/backendClient";

export function useArtNetNodes() {
  const [nodes, setNodes] = useState<ArtNetNode[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshNodes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await artnetNodesApi.getAll();
      setNodes(data);
    } catch (err) {
      console.error("Failed to fetch Art-Net nodes:", err);
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshNodes();
  }, [refreshNodes]);

  return { nodes, loading, refreshNodes };
}
