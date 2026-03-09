import { useState, useEffect, useCallback } from "react";
import {
  dmxFixtureGroupsApi,
  type DmxFixtureGroup,
  type CreateDmxFixtureGroupRequest,
  type UpdateDmxFixtureGroupRequest,
} from "@/api/backendClient";

export function useFixtureGroups() {
  const [groups, setGroups] = useState<DmxFixtureGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dmxFixtureGroupsApi.getAll();
      setGroups(data);
    } catch (err) {
      console.error("Failed to fetch fixture groups:", err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  const createGroup = useCallback(
    async (data: CreateDmxFixtureGroupRequest): Promise<DmxFixtureGroup> => {
      const created = await dmxFixtureGroupsApi.create(data);
      await refreshGroups();
      return created;
    },
    [refreshGroups]
  );

  const updateGroup = useCallback(
    async (id: number, data: UpdateDmxFixtureGroupRequest): Promise<DmxFixtureGroup> => {
      const updated = await dmxFixtureGroupsApi.update(id, data);
      await refreshGroups();
      return updated;
    },
    [refreshGroups]
  );

  const updateGroupFixtures = useCallback(
    async (id: number, fixtureIds: number[]): Promise<DmxFixtureGroup> => {
      const updated = await dmxFixtureGroupsApi.updateFixtures(id, fixtureIds);
      await refreshGroups();
      return updated;
    },
    [refreshGroups]
  );

  const deleteGroup = useCallback(
    async (id: number): Promise<void> => {
      await dmxFixtureGroupsApi.delete(id);
      await refreshGroups();
    },
    [refreshGroups]
  );

  return {
    groups,
    loading,
    refreshGroups,
    createGroup,
    updateGroup,
    updateGroupFixtures,
    deleteGroup,
  };
}
