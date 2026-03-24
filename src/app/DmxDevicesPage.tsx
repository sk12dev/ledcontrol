import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Aperture, Plus, Edit2, Copy, ArrowUp, ArrowDown, ArrowUpDown, Layers, Radio } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { DmxFixtureModal } from "@/app/components/DmxFixtureModal";
import { DuplicateFixtureDialog } from "@/app/components/DuplicateFixtureDialog";
import { DmxFixtureGroupModal } from "@/app/components/DmxFixtureGroupModal";
import { useArtNetNodes } from "@/hooks/useArtNetNodes";
import { useDmxFixtures } from "@/hooks/useDmxFixtures";
import { useFixtureGroups } from "@/hooks/useFixtureGroups";
import { type DmxFixture, type DmxFixtureGroup } from "@/api/backendClient";

type SortKey = "name" | "nodeName" | "startAddress" | "channelCount";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return dir === "asc" ? (
    <ArrowUp className="w-3 h-3 ml-1 text-emerald-400" />
  ) : (
    <ArrowDown className="w-3 h-3 ml-1 text-emerald-400" />
  );
}

const columns: { key: SortKey; label: string; className?: string }[] = [
  { key: "name", label: "Name", className: "min-w-[160px]" },
  { key: "nodeName", label: "Node", className: "min-w-[120px]" },
  { key: "startAddress", label: "Start Address", className: "w-28" },
  { key: "channelCount", label: "Channels", className: "w-24" },
];

type GroupSortKey = "name" | "description" | "fixtureCount";
const groupColumns: { key: GroupSortKey; label: string; className?: string }[] = [
  { key: "name", label: "Name", className: "min-w-[160px]" },
  { key: "description", label: "Description", className: "min-w-[200px]" },
  { key: "fixtureCount", label: "Fixtures", className: "w-24" },
];

export default function DmxDevicesPage() {
  const navigate = useNavigate();
  const { nodes, loading: nodesLoading } = useArtNetNodes();
  const { fixtures, loading: fixturesLoading, refreshFixtures } = useDmxFixtures();
  const {
    groups,
    loading: groupsLoading,
    createGroup,
    updateGroup,
    updateGroupFixtures,
    deleteGroup,
  } = useFixtureGroups();

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [groupSortKey, setGroupSortKey] = useState<GroupSortKey>("name");
  const [groupSortDir, setGroupSortDir] = useState<SortDir>("asc");
  const [isFixtureModalOpen, setIsFixtureModalOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<DmxFixture | null>(null);
  const [duplicatingFixture, setDuplicatingFixture] = useState<DmxFixture | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DmxFixtureGroup | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedFixtures = useMemo(() => {
    const withNode = fixtures.map((f) => {
      const node = nodes.find((n) => n.id === f.artNetNodeId);
      return { ...f, nodeName: node?.name ?? "—" };
    });
    withNode.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "nodeName":
          cmp = a.nodeName.localeCompare(b.nodeName);
          break;
        case "startAddress":
          cmp = a.startAddress - b.startAddress;
          break;
        case "channelCount":
          cmp = a.channelCount - b.channelCount;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return withNode;
  }, [fixtures, nodes, sortKey, sortDir]);

  const handleAddFixture = () => {
    setEditingFixture(null);
    setIsFixtureModalOpen(true);
  };

  const handleEditFixture = (fixture: DmxFixture) => {
    setEditingFixture(fixture);
    setIsFixtureModalOpen(true);
  };

  const handleCloseFixtureModal = () => {
    setIsFixtureModalOpen(false);
    setEditingFixture(null);
  };

  const handleDuplicateFixture = (fixture: DmxFixture) => {
    setDuplicatingFixture(fixture);
  };

  const handleCloseDuplicateDialog = () => {
    setDuplicatingFixture(null);
  };

  const handleAddGroup = () => {
    setEditingGroup(null);
    setIsGroupModalOpen(true);
  };

  const handleEditGroup = (group: DmxFixtureGroup) => {
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  const handleCloseGroupModal = () => {
    setIsGroupModalOpen(false);
    setEditingGroup(null);
  };

  const handleGroupSort = (key: GroupSortKey) => {
    if (groupSortKey === key) {
      setGroupSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setGroupSortKey(key);
      setGroupSortDir("asc");
    }
  };

  const handleSaveGroup = async (
    name: string,
    description: string | null,
    fixtureIds: number[]
  ) => {
    if (editingGroup) {
      await updateGroup(editingGroup.id, { name, description });
      await updateGroupFixtures(editingGroup.id, fixtureIds);
    } else {
      await createGroup({ name, description, fixtureIds });
    }
  };

  const handleDeleteGroup = async () => {
    if (editingGroup) {
      await deleteGroup(editingGroup.id);
    }
  };

  const sortedGroups = useMemo(() => {
    const copy = groups.map((g) => ({
      ...g,
      description: g.description ?? "",
      fixtureCount: g.fixtures.length,
    }));
    copy.sort((a, b) => {
      let cmp = 0;
      switch (groupSortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "description":
          cmp = (a.description ?? "").localeCompare(b.description ?? "");
          break;
        case "fixtureCount":
          cmp = a.fixtureCount - b.fixtureCount;
          break;
      }
      return groupSortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [groups, groupSortKey, groupSortDir]);

  const isLoading = nodesLoading || fixturesLoading || groupsLoading;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white"
                onClick={() => navigate("/shows")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Shows
              </Button>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-500 rounded-lg flex items-center justify-center">
                  <Aperture className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">DMX Fixtures</h1>
                  <p className="text-xs text-zinc-500">Manage fixtures and channel mappings</p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 shrink-0"
              onClick={() => navigate("/devices/dmx/monitor")}
            >
              <Radio className="w-4 h-4 mr-2" />
              Live monitor
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <p className="text-zinc-400 mb-6 max-w-3xl">
          Add fixtures with channel mappings. Group fixtures to select them together in cues. Requires at least one Art-Net node.
        </p>

        <Tabs defaultValue="fixtures" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-zinc-900 border border-zinc-800 mb-6">
            <TabsTrigger
              value="fixtures"
              className="text-zinc-300 data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:border-zinc-600"
            >
              <Aperture className="w-4 h-4 mr-2" />
              Fixtures
            </TabsTrigger>
            <TabsTrigger
              value="groups"
              className="text-zinc-300 data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:border-zinc-600"
            >
              <Layers className="w-4 h-4 mr-2" />
              Fixture Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fixtures" className="mt-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Fixtures</h2>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleAddFixture}
                disabled={nodes.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Fixture
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-zinc-500 text-sm">Loading...</div>
            ) : nodes.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <Aperture className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Add an Art-Net node first</p>
                <p className="text-xs mt-1">Fixtures require a node to output DMX data</p>
              </div>
            ) : fixtures.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <Aperture className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No DMX fixtures configured</p>
                <p className="text-xs mt-1">Add fixtures with channel mappings</p>
                <Button variant="outline" size="sm" className="mt-4 border-zinc-700" onClick={handleAddFixture}>
                  Add your first fixture
                </Button>
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-22rem)]">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900/90 sticky top-0 z-10">
                      <tr className="border-b border-zinc-800">
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className={`text-left px-3 py-2.5 font-medium text-zinc-400 select-none cursor-pointer hover:text-white transition-colors ${col.className ?? ""}`}
                            onClick={() => handleSort(col.key)}
                          >
                            <span className="inline-flex items-center">
                              {col.label}
                              <SortIcon active={sortKey === col.key} dir={sortDir} />
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 font-medium text-zinc-400 w-28 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {sortedFixtures.map((fixture) => (
                        <tr key={fixture.id} className="bg-zinc-950 hover:bg-zinc-900/60 transition-colors group">
                          <td className="px-3 py-2">
                            <span className="text-white font-medium">{fixture.name}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-300">{fixture.nodeName}</td>
                          <td className="px-3 py-2 text-zinc-300 tabular-nums">{fixture.startAddress}</td>
                          <td className="px-3 py-2 text-zinc-300 tabular-nums">{fixture.channelCount}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                                onClick={() => handleDuplicateFixture(fixture)}
                                title="Duplicate"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                                onClick={() => handleEditFixture(fixture)}
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="mt-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Fixture Groups</h2>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleAddGroup}
                disabled={fixtures.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Group
              </Button>
            </div>

            {fixtures.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Add fixtures first</p>
                <p className="text-xs mt-1">Groups require at least one fixture</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No fixture groups</p>
                <p className="text-xs mt-1">Create groups to select fixtures together in cues</p>
                <Button variant="outline" size="sm" className="mt-4 border-zinc-700" onClick={handleAddGroup}>
                  Add your first group
                </Button>
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-22rem)]">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900/90 sticky top-0 z-10">
                      <tr className="border-b border-zinc-800">
                        {groupColumns.map((col) => (
                          <th
                            key={col.key}
                            className={`text-left px-3 py-2.5 font-medium text-zinc-400 select-none cursor-pointer hover:text-white transition-colors ${col.className ?? ""}`}
                            onClick={() => handleGroupSort(col.key)}
                          >
                            <span className="inline-flex items-center">
                              {col.label}
                              <SortIcon active={groupSortKey === col.key} dir={groupSortDir} />
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 font-medium text-zinc-400 w-20 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {sortedGroups.map((group) => (
                        <tr key={group.id} className="bg-zinc-950 hover:bg-zinc-900/60 transition-colors group">
                          <td className="px-3 py-2">
                            <span className="text-white font-medium">{group.name}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-400 max-w-[300px] truncate">
                            {group.description || "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-300 tabular-nums">{group.fixtureCount}</td>
                          <td className="px-3 py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleEditGroup(group)}
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <DmxFixtureModal
        fixture={editingFixture}
        nodes={nodes}
        isOpen={isFixtureModalOpen}
        onClose={handleCloseFixtureModal}
        onSave={refreshFixtures}
        onDelete={refreshFixtures}
      />
      {duplicatingFixture && (
        <DuplicateFixtureDialog
          fixture={duplicatingFixture}
          allFixtures={fixtures}
          isOpen={!!duplicatingFixture}
          onClose={handleCloseDuplicateDialog}
          onSuccess={refreshFixtures}
        />
      )}
      <DmxFixtureGroupModal
        group={editingGroup}
        fixtures={fixtures}
        isOpen={isGroupModalOpen}
        onClose={handleCloseGroupModal}
        onSave={handleSaveGroup}
        onDelete={editingGroup ? handleDeleteGroup : undefined}
      />
    </div>
  );
}
