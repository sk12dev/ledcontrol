import { useState, useEffect, useCallback } from "react";
import { dmxFixturesApi, type DmxFixture } from "@/api/backendClient";

export function useDmxFixtures() {
  const [fixtures, setFixtures] = useState<DmxFixture[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshFixtures = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dmxFixturesApi.getAll();
      setFixtures(data);
    } catch (err) {
      console.error("Failed to fetch DMX fixtures:", err);
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFixtures();
  }, [refreshFixtures]);

  return { fixtures, loading, refreshFixtures };
}
