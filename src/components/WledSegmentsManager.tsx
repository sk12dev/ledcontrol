import { useState, useEffect, useCallback } from "react";
import { devicesApi, wledSegmentsApi } from "@/api/backendClient";
import type { Device, WledSegment, CreateWledSegmentRequest } from "@/api/backendClient";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Download } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

export function WledSegmentsManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDeviceId, setExpandedDeviceId] = useState<number | null>(null);
  const [segmentsByDevice, setSegmentsByDevice] = useState<Record<number, WledSegment[]>>({});
  const [loadingSegments, setLoadingSegments] = useState<Record<number, boolean>>({});
  const [editingSegment, setEditingSegment] = useState<{ deviceId: number; segment: WledSegment | null } | null>(null);
  const [form, setForm] = useState<CreateWledSegmentRequest>({
    name: "",
    wledSegmentIndex: 0,
    start: null,
    stop: null,
    pushToWled: false,
  });
  const [saving, setSaving] = useState(false);
  const [importingDeviceId, setImportingDeviceId] = useState<number | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const list = await devicesApi.getAll();
      setDevices(list);
    } catch (e) {
      console.error("Failed to load devices:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSegments = useCallback(async (deviceId: number) => {
    setLoadingSegments((prev) => ({ ...prev, [deviceId]: true }));
    try {
      const list = await wledSegmentsApi.list(deviceId);
      setSegmentsByDevice((prev) => ({ ...prev, [deviceId]: list }));
    } catch (e) {
      console.error("Failed to load segments:", e);
    } finally {
      setLoadingSegments((prev) => ({ ...prev, [deviceId]: false }));
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (expandedDeviceId != null) {
      loadSegments(expandedDeviceId);
    }
  }, [expandedDeviceId, loadSegments]);

  const handleToggleExpand = (deviceId: number) => {
    setExpandedDeviceId((prev) => (prev === deviceId ? null : deviceId));
  };

  const handleAddSegment = (deviceId: number) => {
    setEditingSegment({ deviceId, segment: null });
    setForm({
      name: "",
      wledSegmentIndex: 0,
      start: null,
      stop: null,
      pushToWled: false,
    });
  };

  const handleEditSegment = (deviceId: number, segment: WledSegment) => {
    setEditingSegment({ deviceId, segment });
    setForm({
      name: segment.name,
      wledSegmentIndex: segment.wledSegmentIndex,
      start: segment.start ?? null,
      stop: segment.stop ?? null,
      pushToWled: false,
    });
  };

  const handleSaveSegment = async () => {
    if (!editingSegment) return;
    const { deviceId, segment } = editingSegment;
    setSaving(true);
    try {
      if (segment) {
        await wledSegmentsApi.update(deviceId, segment.id, {
          name: form.name,
          start: form.start ?? undefined,
          stop: form.stop ?? undefined,
        });
      } else {
        await wledSegmentsApi.create(deviceId, {
          name: form.name,
          wledSegmentIndex: form.wledSegmentIndex,
          start: form.start ?? undefined,
          stop: form.stop ?? undefined,
          pushToWled: form.pushToWled,
        });
      }
      setEditingSegment(null);
      await loadSegments(deviceId);
    } catch (e) {
      console.error("Failed to save segment:", e);
      alert(e instanceof Error ? e.message : "Failed to save segment");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSegment = async (deviceId: number, segmentId: number) => {
    if (!window.confirm("Delete this segment? It will be removed from any cues that use it.")) return;
    try {
      await wledSegmentsApi.delete(deviceId, segmentId);
      await loadSegments(deviceId);
    } catch (e) {
      console.error("Failed to delete segment:", e);
      alert(e instanceof Error ? e.message : "Failed to delete segment");
    }
  };

  const handleImportFromWled = async (deviceId: number) => {
    setImportingDeviceId(deviceId);
    try {
      const rawSegs = await wledSegmentsApi.getFromWled(deviceId);
      const segs = Array.isArray(rawSegs) ? rawSegs : [];
      if (segs.length === 0) {
        alert("No segments reported by device (or device unreachable).");
        return;
      }
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i] as { id?: number; start?: number; stop?: number; len?: number };
        const id = s.id ?? i;
        const name = `Segment ${id}`;
        try {
          await wledSegmentsApi.create(deviceId, {
            name,
            wledSegmentIndex: id,
            start: s.start ?? undefined,
            stop: s.stop ?? undefined,
            pushToWled: false,
          });
        } catch {
          // may already exist (unique deviceId + index)
        }
      }
      await loadSegments(deviceId);
    } catch (e) {
      console.error("Failed to import from WLED:", e);
      alert(e instanceof Error ? e.message : "Failed to fetch segments from device");
    } finally {
      setImportingDeviceId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6">
        <p className="text-zinc-400">Loading devices...</p>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6">
        <h3 className="text-lg font-semibold mb-2 text-zinc-200">WLED Segments</h3>
        <p className="text-zinc-400">Add WLED devices above first, then create segments to use as cue targets.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6">
      <h3 className="text-lg font-semibold mb-2 text-zinc-200">WLED Segments</h3>
      <p className="text-zinc-400 text-sm mb-4">
        Create named segments per device to use as targets in cues. Expand a device to manage its segments.
      </p>
      <div className="space-y-2">
        {devices.map((device) => (
          <div key={device.id} className="rounded-md border border-zinc-700 bg-zinc-900/50 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50"
              onClick={() => handleToggleExpand(device.id)}
            >
              <span className="flex items-center gap-2">
                {expandedDeviceId === device.id ? (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
                <span className="font-medium text-zinc-200">{device.name}</span>
                <span className="text-xs text-zinc-500">{device.ipAddress}</span>
              </span>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-white"
                  onClick={() => handleImportFromWled(device.id)}
                  disabled={importingDeviceId === device.id}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Import from WLED
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-white"
                  onClick={() => handleAddSegment(device.id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add segment
                </Button>
              </div>
            </button>
            {expandedDeviceId === device.id && (
              <div className="border-t border-zinc-700 px-4 py-3 bg-zinc-900/30">
                {loadingSegments[device.id] ? (
                  <p className="text-zinc-500 text-sm">Loading segments...</p>
                ) : (
                  <div className="space-y-2">
                    {(segmentsByDevice[device.id] ?? []).length === 0 ? (
                      <p className="text-zinc-500 text-sm">No segments. Add one or import from WLED.</p>
                    ) : (
                      (segmentsByDevice[device.id] ?? []).map((seg) => (
                        <div
                          key={seg.id}
                          className="flex items-center justify-between py-2 px-3 rounded bg-zinc-800/50"
                        >
                          <div>
                            <span className="font-medium text-zinc-200">{seg.name}</span>
                            <span className="text-xs text-zinc-500 ml-2">
                              index {seg.wledSegmentIndex}
                              {seg.start != null && seg.stop != null && ` · LEDs ${seg.start}-${seg.stop}`}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-zinc-400 hover:text-white h-8 w-8 p-0"
                              onClick={() => handleEditSegment(device.id, seg)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-zinc-400 hover:text-red-400 h-8 w-8 p-0"
                              onClick={() => handleDeleteSegment(device.id, seg.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {editingSegment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingSegment(null)}>
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-semibold text-zinc-200 mb-4">
              {editingSegment.segment ? "Edit segment" : "New segment"}
            </h4>
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-400">Name</Label>
                <Input
                  className="mt-1 bg-zinc-800 border-zinc-600"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Left strip"
                />
              </div>
              {!editingSegment.segment && (
                <>
                  <div>
                    <Label className="text-zinc-400">Segment index (0-based on device)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="mt-1 bg-zinc-800 border-zinc-600"
                      value={form.wledSegmentIndex}
                      onChange={(e) => setForm((f) => ({ ...f, wledSegmentIndex: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label className="text-zinc-400">Start LED (optional)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="mt-1 bg-zinc-800 border-zinc-600"
                        value={form.start ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, start: e.target.value === "" ? null : parseInt(e.target.value, 10) }))
                        }
                        placeholder="—"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-zinc-400">Stop LED (optional)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="mt-1 bg-zinc-800 border-zinc-600"
                        value={form.stop ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, stop: e.target.value === "" ? null : parseInt(e.target.value, 10) }))
                        }
                        placeholder="—"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={form.pushToWled}
                      onChange={(e) => setForm((f) => ({ ...f, pushToWled: e.target.checked }))}
                      className="rounded border-zinc-600"
                    />
                    Push segment to device on create (if start/stop set)
                  </label>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" className="border-zinc-600" onClick={() => setEditingSegment(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSegment} disabled={saving || !form.name.trim()}>
                {saving ? "Saving..." : editingSegment.segment ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
