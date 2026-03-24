import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Network, Plus, Edit2, Radio } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { ArtNetNodeModal } from "@/app/components/ArtNetNodeModal";
import { useArtNetNodes } from "@/hooks/useArtNetNodes";
import { type ArtNetNode } from "@/api/backendClient";

export default function ArtNetNodesPage() {
  const navigate = useNavigate();
  const { nodes, loading, refreshNodes } = useArtNetNodes();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ArtNetNode | null>(null);

  const handleAddNode = () => {
    setEditingNode(null);
    setIsModalOpen(true);
  };

  const handleEditNode = (node: ArtNetNode) => {
    setEditingNode(node);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingNode(null);
  };

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
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-500 rounded-lg flex items-center justify-center">
                  <Network className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">Art-Net Nodes</h1>
                  <p className="text-xs text-zinc-500">Manage DMX output nodes</p>
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
        <p className="text-zinc-400 mb-8 max-w-3xl">
          Add Art-Net nodes to receive DMX output. You can also add nodes from the workspace when working on a show.
        </p>

        <div className="max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Nodes</h2>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddNode}>
              <Plus className="w-4 h-4 mr-2" />
              Add Node
            </Button>
          </div>
          {loading ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Loading...</div>
          ) : nodes.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/50">
              <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No Art-Net nodes configured</p>
              <p className="text-xs mt-1">Add a node to receive DMX data</p>
              <Button variant="outline" size="sm" className="mt-4 border-zinc-700" onClick={handleAddNode}>
                Add your first node
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <Network className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">{node.name}</p>
                      <p className="text-sm text-zinc-500">
                        {node.ipAddress} · Subnet {node.subnet ?? 0} / Universe {node.universe ?? 0}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => handleEditNode(node)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ArtNetNodeModal
        node={editingNode}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={refreshNodes}
        onDelete={refreshNodes}
      />
    </div>
  );
}
