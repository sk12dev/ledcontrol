import { useState, useCallback, useRef, useEffect } from "react";
import { useMultiDevice } from "../hooks/useMultiDevice";
import { useDmxFixtures } from "../hooks/useDmxFixtures";
import { useFixtureGroups } from "../hooks/useFixtureGroups";
import { useShows } from "../hooks/useShows";
import {
  type Cue,
  type CreateCueRequest,
  type UpdateCueRequest,
  devicesApi,
  wledSegmentsApi,
  type WledSegment,
} from "../api/backendClient";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import { ColorPresetSelector } from "./ColorPresetSelector";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";

interface CueStep {
  id?: number;
  order: number;
  targetColor: [number, number, number, number] | null;
  targetBrightness: number | null;
  startColor: [number, number, number, number] | null | [];
  startBrightness: number | null;
  turnOff: boolean;
  useWledEffect: boolean;
  wledEffectId: number | null;
  wledEffectSpeed: number | null;
  wledEffectIntensity: number | null;
  wledPaletteId: number | null;
  deviceIds: number[];
  segmentTargets: number[];
  fixtureIds: number[];
}

interface CueBuilderProps {
  cue?: Cue;
  showId?: number; // Optional - if not provided, will use cue's showId or require selection
  onSave: (cue: CreateCueRequest | UpdateCueRequest) => Promise<void>;
  onCancel: () => void;
  onTest?: (cue: CreateCueRequest | UpdateCueRequest) => Promise<void>;
}

export function CueBuilder({ cue, showId: propShowId, onSave, onCancel, onTest }: CueBuilderProps) {
  const { devices, getDeviceConnectionStatus } = useMultiDevice();
  const { fixtures } = useDmxFixtures();
  const { groups } = useFixtureGroups();
  const { shows } = useShows();
  const [name, setName] = useState(cue?.name || "");
  const [description, setDescription] = useState(cue?.description || "");
  const [selectedShowId, setSelectedShowId] = useState<number | null>(
    propShowId ?? cue?.showId ?? null
  );
  const [steps, setSteps] = useState<CueStep[]>(() => {
    if (cue?.cueSteps) {
      return cue.cueSteps.map((step) => {
        const deviceIds: number[] = [];
        const segmentTargets: number[] = [];
        for (const csd of step.cueStepDevices) {
          if (csd.wledSegmentId == null) {
            deviceIds.push(csd.deviceId);
          } else {
            segmentTargets.push(csd.wledSegmentId);
          }
        }
        return {
          id: step.id,
          order: step.order,
          targetColor: step.targetColor,
          targetBrightness: step.targetBrightness,
          startColor: step.startColor || null,
          startBrightness: step.startBrightness,
          turnOff: step.turnOff ?? false,
          useWledEffect: step.useWledEffect ?? false,
          wledEffectId: step.wledEffectId ?? null,
          wledEffectSpeed: step.wledEffectSpeed ?? 128,
          wledEffectIntensity: step.wledEffectIntensity ?? 128,
          wledPaletteId: step.wledPaletteId ?? 0,
          deviceIds,
          segmentTargets,
          fixtureIds: (step.cueStepFixtures ?? []).map((csf) => csf.fixtureId),
        };
      });
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wledDataByDevice, setWledDataByDevice] = useState<
    Map<number, { effects: string[]; palettes: string[] }>
  >(new Map());
  const [wledLoading, setWledLoading] = useState(false);
  const wledLoadingRef = useRef<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [segmentsByDevice, setSegmentsByDevice] = useState<Record<number, WledSegment[]>>({});

  useEffect(() => {
    if (devices.length === 0) return;
    const load = async () => {
      const next: Record<number, WledSegment[]> = {};
      await Promise.all(
        devices.map(async (d) => {
          try {
            const list = await wledSegmentsApi.list(d.id);
            next[d.id] = list;
          } catch {
            next[d.id] = [];
          }
        })
      );
      setSegmentsByDevice((prev) => ({ ...prev, ...next }));
    };
    load();
  }, [devices]);

  const loadWledData = useCallback(async (deviceId: number) => {
    if (wledLoadingRef.current.has(deviceId)) return;
    wledLoadingRef.current.add(deviceId);
    setWledLoading(true);
    try {
      const json = await devicesApi.getWledJson(deviceId);
      const effects = (json.effects ?? []).filter(
        (name) => name !== "RSVD" && name !== "-"
      );
      const palettes = json.palettes ?? [];
      setWledDataByDevice((prev) => {
        const next = new Map(prev);
        next.set(deviceId, { effects, palettes });
        return next;
      });
    } catch (err) {
      console.error("Failed to load WLED effects:", err);
      setError(err instanceof Error ? err.message : "Failed to load effects from device");
    } finally {
      wledLoadingRef.current.delete(deviceId);
      setWledLoading(false);
    }
  }, []);

  const addStep = () => {
    const newStep: CueStep = {
      order: steps.length,
      targetColor: [255, 255, 255, 0],
      targetBrightness: 128,
      startColor: null,
      startBrightness: null,
      turnOff: false,
      useWledEffect: false,
      wledEffectId: null,
      wledEffectSpeed: 128,
      wledEffectIntensity: 128,
      wledPaletteId: 0,
      deviceIds: [],
      segmentTargets: [],
      fixtureIds: [],
    };
    const newIndex = steps.length;
    setSteps([...steps, newStep]);
    setExpandedIndices((prev) => new Set(prev).add(newIndex));
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      order: i,
    }));
    setSteps(newSteps);
    setExpandedIndices((prev) =>
      new Set(
        [...prev]
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i))
      )
    );
  };

  const duplicateStep = (index: number) => {
    const stepToDuplicate = steps[index];
    const duplicatedStep: CueStep = {
      order: stepToDuplicate.order + 1,
      targetColor: stepToDuplicate.targetColor 
        ? [...stepToDuplicate.targetColor] as [number, number, number, number]
        : null,
      targetBrightness: stepToDuplicate.targetBrightness,
      startColor: stepToDuplicate.startColor
        ? (Array.isArray(stepToDuplicate.startColor) && stepToDuplicate.startColor.length === 4
          ? [...stepToDuplicate.startColor] as [number, number, number, number]
          : null)
        : null,
      startBrightness: stepToDuplicate.startBrightness,
      turnOff: stepToDuplicate.turnOff,
      useWledEffect: stepToDuplicate.useWledEffect,
      wledEffectId: stepToDuplicate.wledEffectId,
      wledEffectSpeed: stepToDuplicate.wledEffectSpeed,
      wledEffectIntensity: stepToDuplicate.wledEffectIntensity,
      wledPaletteId: stepToDuplicate.wledPaletteId,
      deviceIds: [...(stepToDuplicate.deviceIds ?? [])],
      segmentTargets: [...(stepToDuplicate.segmentTargets ?? [])],
      fixtureIds: [...(stepToDuplicate.fixtureIds ?? [])],
    };
    
    // Insert the duplicated step right after the original
    const newSteps = [...steps];
    newSteps.splice(index + 1, 0, duplicatedStep);
    
    // Update order for all steps after the insertion
    const updatedSteps = newSteps.map((step, i) => ({
      ...step,
      order: i,
    }));
    
    setSteps(updatedSteps);
    setExpandedIndices((prev) =>
      new Set([...[...prev].map((i) => (i > index ? i + 1 : i)), index + 1])
    );
  };

  const updateStep = (index: number, updates: Partial<CueStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  const handleDeviceToggle = (stepIndex: number, deviceId: number) => {
    const step = steps[stepIndex];
    if (step.deviceIds.includes(deviceId)) {
      updateStep(stepIndex, {
        deviceIds: step.deviceIds.filter((id) => id !== deviceId),
      });
    } else {
      updateStep(stepIndex, {
        deviceIds: [...step.deviceIds, deviceId],
      });
    }
  };

  const handleSegmentToggle = (stepIndex: number, segmentId: number) => {
    const step = steps[stepIndex];
    const segIds = step.segmentTargets ?? [];
    if (segIds.includes(segmentId)) {
      updateStep(stepIndex, {
        segmentTargets: segIds.filter((id) => id !== segmentId),
      });
    } else {
      updateStep(stepIndex, {
        segmentTargets: [...segIds, segmentId],
      });
    }
  };

  const handleFixtureToggle = (stepIndex: number, fixtureId: number) => {
    const step = steps[stepIndex];
    const fids = step.fixtureIds ?? [];
    if (fids.includes(fixtureId)) {
      updateStep(stepIndex, {
        fixtureIds: fids.filter((id) => id !== fixtureId),
      });
    } else {
      updateStep(stepIndex, {
        fixtureIds: [...fids, fixtureId],
      });
    }
  };

  const handleGroupToggle = (stepIndex: number, groupFixtureIds: number[]) => {
    const step = steps[stepIndex];
    const fids = step.fixtureIds ?? [];
    const allInStep = groupFixtureIds.every((id) => fids.includes(id));
    if (allInStep) {
      updateStep(stepIndex, {
        fixtureIds: fids.filter((id) => !groupFixtureIds.includes(id)),
      });
    } else {
      const merged = new Set([...fids, ...groupFixtureIds]);
      updateStep(stepIndex, {
        fixtureIds: Array.from(merged),
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Cue name is required");
      return;
    }

    if (!selectedShowId) {
      setError("Show selection is required");
      return;
    }

    if (steps.length === 0) {
      setError("At least one target is required");
      return;
    }

    // Validate steps
    for (const step of steps) {
      const hasDevices = (step.deviceIds ?? []).length > 0;
      const hasSegments = (step.segmentTargets ?? []).length > 0;
      const hasFixtures = (step.fixtureIds ?? []).length > 0;
      if (!hasDevices && !hasSegments && !hasFixtures) {
        setError(`Target ${step.order + 1} must have at least one device, segment, or fixture selected`);
        return;
      }
      const hasColorOrBrightness = step.targetColor != null || step.targetBrightness != null;
      const hasEffect = step.useWledEffect && step.wledEffectId != null;
      if (!step.turnOff && !hasColorOrBrightness && !hasEffect) {
        setError(
          `Target ${step.order + 1} must have turn off, color/brightness, or a WLED effect`
        );
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const cueData: CreateCueRequest | UpdateCueRequest = {
        name: name.trim(),
        description: description.trim() || null,
        ...(cue 
          ? (selectedShowId !== cue.showId ? { showId: selectedShowId! } : {}) // Update if show changed
          : { showId: selectedShowId! } // Required for new cues
        ),
        steps: steps.map((step) => ({
          ...(step.id ? { id: step.id } : {}),
          order: step.order,
          targetColor: step.targetColor,
          targetBrightness: step.targetBrightness,
          startColor: step.startColor && step.startColor.length === 4 
            ? (step.startColor as [number, number, number, number])
            : undefined,
          startBrightness: step.startBrightness,
          turnOff: step.turnOff,
          useWledEffect: step.useWledEffect,
          wledEffectId: step.wledEffectId,
          wledEffectSpeed: step.wledEffectSpeed,
          wledEffectIntensity: step.wledEffectIntensity,
          wledPaletteId: step.wledPaletteId,
          deviceIds: step.deviceIds ?? [],
          segmentTargets: step.segmentTargets ?? [],
          fixtureIds: step.fixtureIds ?? [],
        })),
      };

      await onSave(cueData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save cue";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) {
      return;
    }

    // Validate the same way as save
    if (!name.trim()) {
      setError("Cue name is required");
      return;
    }

    if (!selectedShowId) {
      setError("Show selection is required");
      return;
    }

    if (steps.length === 0) {
      setError("At least one target is required");
      return;
    }

    // Validate steps
    for (const step of steps) {
      const hasDevices = (step.deviceIds ?? []).length > 0;
      const hasSegments = (step.segmentTargets ?? []).length > 0;
      const hasFixtures = (step.fixtureIds ?? []).length > 0;
      if (!hasDevices && !hasSegments && !hasFixtures) {
        setError(`Target ${step.order + 1} must have at least one device, segment, or fixture selected`);
        return;
      }
      const hasColorOrBrightness = step.targetColor != null || step.targetBrightness != null;
      const hasEffect = step.useWledEffect && step.wledEffectId != null;
      if (!step.turnOff && !hasColorOrBrightness && !hasEffect) {
        setError(
          `Target ${step.order + 1} must have turn off, color/brightness, or a WLED effect`
        );
        return;
      }
    }

    setTesting(true);
    setError(null);

    try {
      const cueData: CreateCueRequest | UpdateCueRequest = {
        name: name.trim(),
        description: description.trim() || null,
        ...(cue 
          ? (selectedShowId !== cue.showId ? { showId: selectedShowId! } : {}) // Update if show changed
          : { showId: selectedShowId! } // Required for new cues
        ),
        steps: steps.map((step) => ({
          ...(step.id ? { id: step.id } : {}),
          order: step.order,
          targetColor: step.targetColor,
          targetBrightness: step.targetBrightness,
          startColor: step.startColor && step.startColor.length === 4 
            ? (step.startColor as [number, number, number, number])
            : undefined,
          startBrightness: step.startBrightness,
          turnOff: step.turnOff,
          useWledEffect: step.useWledEffect,
          wledEffectId: step.wledEffectId,
          wledEffectSpeed: step.wledEffectSpeed,
          wledEffectIntensity: step.wledEffectIntensity,
          wledPaletteId: step.wledPaletteId,
          deviceIds: step.deviceIds ?? [],
          segmentTargets: step.segmentTargets ?? [],
          fixtureIds: step.fixtureIds ?? [],
        })),
      };

      await onTest(cueData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to test cue";
      setError(errorMessage);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          {cue ? "Edit Cue" : "Create Cue"}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-white"
          >
            Cancel
          </button>
          {onTest && (
            <button
              onClick={handleTest}
              disabled={testing || saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-600 disabled:cursor-not-allowed rounded text-white"
            >
              {testing ? "Testing..." : "Test Cue"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed rounded text-white"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-950 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}

      {/* Cue Metadata */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-300">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Enter cue name..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-300">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Enter cue description..."
            rows={2}
          />
        </div>
        {/* Show selector - hide if showId is provided via props (already in show context) */}
        {!propShowId && (
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-300">Show *</label>
            <select
              value={selectedShowId ?? ""}
              onChange={(e) => setSelectedShowId(parseInt(e.target.value) || null)}
              disabled={!!cue && !!cue.showId} // Disable if editing existing cue with showId
              className="w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">Select a show...</option>
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.name}
                </option>
              ))}
            </select>
            {cue && cue.showId && (
              <p className="text-xs text-zinc-400 mt-1">
                Cue is associated with this show. To change the show, create a new cue.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Targets */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-white">Targets</h3>
          <button
            onClick={addStep}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white"
          >
            Add Target
          </button>
        </div>

        {steps.length === 0 ? (
          <p className="text-zinc-400 text-center py-8">
            No targets yet. Click &quot;Add Target&quot; to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <Collapsible
                key={index}
                open={expandedIndices.has(index)}
                onOpenChange={(open) => {
                  setExpandedIndices((prev) => {
                    const next = new Set(prev);
                    if (open) next.add(index);
                    else next.delete(index);
                    return next;
                  });
                }}
              >
                <div className="bg-zinc-800 rounded-lg border border-zinc-700">
                  <CollapsibleTrigger asChild>
                    <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-750 rounded-t-lg">
                      <div className="flex items-center gap-2">
                        {expandedIndices.has(index) ? (
                          <ChevronDown className="w-5 h-5 text-zinc-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                        )}
                        <h4 className="text-lg font-semibold text-white">Target {step.order + 1}</h4>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => duplicateStep(index)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => removeStep(index)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 border-t border-zinc-700">
                {/* Turn Off Option */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.turnOff}
                      onChange={(e) =>
                        updateStep(index, {
                          turnOff: e.target.checked,
                          useWledEffect: e.target.checked ? false : step.useWledEffect,
                        })
                      }
                      className="w-4 h-4 text-red-600 bg-zinc-800 border-zinc-700 rounded focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-red-400">
                      Turn Device Off
                    </span>
                  </label>
                  <p className="text-xs text-zinc-400 mt-1 ml-6">
                    When enabled, the device will be turned off instead of setting color/brightness
                  </p>
                </div>

                {/* Use WLED Effect Option */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.useWledEffect}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked && (step.deviceIds ?? []).length > 0) {
                          loadWledData((step.deviceIds ?? [])[0]);
                        }
                        updateStep(index, {
                          useWledEffect: checked,
                          turnOff: checked ? false : step.turnOff,
                          wledEffectId: checked && step.wledEffectId == null ? 0 : step.wledEffectId,
                        });
                      }}
                      disabled={step.turnOff}
                      className="w-4 h-4 text-emerald-600 bg-zinc-800 border-zinc-700 rounded focus:ring-emerald-500 disabled:opacity-50"
                    />
                    <span className="text-sm font-medium text-emerald-400">
                      Use WLED Effect
                    </span>
                  </label>
                  <p className="text-xs text-zinc-400 mt-1 ml-6">
                    When enabled, use a WLED built-in effect instead of solid color (loads from first selected device)
                  </p>
                </div>

                {/* WLED Effect Controls - shown when useWledEffect is true */}
                {step.useWledEffect && !step.turnOff && (
                  <div className="mb-4 p-4 bg-zinc-900 rounded-lg border border-zinc-700 space-y-4">
                    <h5 className="text-sm font-medium text-zinc-300">Effect Settings</h5>
                    {(step.deviceIds ?? []).length === 0 ? (
                      <p className="text-zinc-400 text-sm">
                        Select at least one WLED device to load effects
                      </p>
                    ) : (
                      <>
                        {(() => {
                          const deviceId = (step.deviceIds ?? [])[0];
                          const wledData = wledDataByDevice.get(deviceId);
                          if (!wledData && !wledLoading) {
                            loadWledData(deviceId);
                          }
                          return (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1 text-zinc-300">
                                  Effect
                                </label>
                                <select
                                  value={step.wledEffectId ?? 0}
                                  onChange={(e) =>
                                    updateStep(index, {
                                      wledEffectId: parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  disabled={wledLoading}
                                >
                                  {wledLoading ? (
                                    <option>Loading effects...</option>
                                  ) : wledData ? (
                                    wledData.effects.map((name, idx) => (
                                      <option key={idx} value={idx}>
                                        {name}
                                      </option>
                                    ))
                                  ) : (
                                    <option value={0}>Select effect</option>
                                  )}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1 text-zinc-300">
                                  Speed (sx) 0-255
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="255"
                                  value={step.wledEffectSpeed ?? 128}
                                  onChange={(e) =>
                                    updateStep(index, {
                                      wledEffectSpeed: parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="w-full"
                                />
                                <span className="text-sm text-zinc-400">
                                  {step.wledEffectSpeed ?? 128}
                                </span>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1 text-zinc-300">
                                  Intensity (ix) 0-255
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="255"
                                  value={step.wledEffectIntensity ?? 128}
                                  onChange={(e) =>
                                    updateStep(index, {
                                      wledEffectIntensity: parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="w-full"
                                />
                                <span className="text-sm text-zinc-400">
                                  {step.wledEffectIntensity ?? 128}
                                </span>
                              </div>
                              {wledData && wledData.palettes.length > 0 && (
                                <div>
                                  <label className="block text-sm font-medium mb-1 text-zinc-300">
                                    Palette
                                  </label>
                                  <select
                                    value={step.wledPaletteId ?? 0}
                                    onChange={(e) =>
                                      updateStep(index, {
                                        wledPaletteId: parseInt(e.target.value, 10),
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  >
                                    {wledData.palettes.map((name, idx) => (
                                      <option key={idx} value={idx}>
                                        {name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Left column: Brightness then Color */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-300">
                        Target Brightness (1-255)
                      </label>
                      {step.targetBrightness !== null ? (
                        <div className="space-y-2">
                          <input
                            type="range"
                            min="1"
                            max="255"
                            value={step.targetBrightness}
                            onChange={(e) =>
                              updateStep(index, {
                                targetBrightness: parseInt(e.target.value),
                              })
                            }
                            disabled={step.turnOff}
                            className="w-full disabled:opacity-50"
                          />
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-zinc-400">
                              {step.targetBrightness}
                            </span>
                            <button
                              onClick={() =>
                                updateStep(index, { targetBrightness: null })
                              }
                              disabled={step.turnOff}
                              className="text-sm text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Clear (color only)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            updateStep(index, { targetBrightness: 128 })
                          }
                          disabled={step.turnOff}
                          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Set Brightness
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-300">
                        Target Color
                      </label>
                      {step.targetColor ? (
                        <div className="space-y-2">
                          <ColorPicker
                            color={step.targetColor}
                            onColorChange={async (color) =>
                              updateStep(index, { targetColor: color })
                            }
                            disabled={step.turnOff}
                          />
                          <ColorPresetSelector
                            selectedColor={step.targetColor}
                            onColorSelect={(color) =>
                              updateStep(index, { targetColor: color })
                            }
                            disabled={step.turnOff}
                          />
                          <button
                            onClick={() => updateStep(index, { targetColor: null })}
                            className="text-sm text-zinc-400 hover:text-zinc-300"
                            disabled={step.turnOff}
                          >
                            Clear (brightness only)
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={() =>
                              updateStep(index, {
                                targetColor: [255, 255, 255, 0],
                              })
                            }
                            disabled={step.turnOff}
                            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Set Color
                          </button>
                          <ColorPresetSelector
                            selectedColor={null}
                            onColorSelect={(color) =>
                              updateStep(index, { targetColor: color })
                            }
                            disabled={step.turnOff}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right column: Devices and Fixtures */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-300">
                        Target Devices & Segments (WLED)
                      </label>
                      {devices.length === 0 ? (
                        <p className="text-zinc-400 text-sm">
                          No WLED devices. Add devices or use fixtures below.
                        </p>
                      ) : (
                        <ScrollArea className="h-40 w-full rounded-md border border-zinc-700 bg-zinc-800/50">
                          <div className="flex flex-col gap-0.5 p-1.5">
                            {devices.map((device) => {
                              const isConnected = getDeviceConnectionStatus(device.id)?.isConnected ?? false;
                              const devIds = step.deviceIds ?? [];
                              const segIds = step.segmentTargets ?? [];
                              const wholeChecked = devIds.includes(device.id);
                              const deviceSegments = segmentsByDevice[device.id] ?? [];
                              return (
                                <div key={device.id} className="flex flex-col gap-0.5">
                                  <label
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border ${
                                      wholeChecked
                                        ? "bg-blue-600 border-blue-500 text-white"
                                        : "bg-transparent border-transparent text-zinc-300 hover:bg-zinc-700/50"
                                    } ${!isConnected ? "opacity-90" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={wholeChecked}
                                      onChange={() => handleDeviceToggle(index, device.id)}
                                      className="h-4 w-4 rounded border-zinc-600"
                                    />
                                    <span className="truncate text-sm">
                                      {device.name} (whole device)
                                      {!isConnected && (
                                        <span className="ml-1 text-xs opacity-80">(offline)</span>
                                      )}
                                    </span>
                                  </label>
                                  {deviceSegments.map((seg) => {
                                    const segChecked = segIds.includes(seg.id);
                                    return (
                                      <label
                                        key={seg.id}
                                        className={`flex items-center gap-2 pl-6 pr-2 py-1 rounded cursor-pointer border text-sm ${
                                          segChecked
                                            ? "bg-blue-600/80 border-blue-500/80 text-white"
                                            : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-700/50"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={segChecked}
                                          onChange={() => handleSegmentToggle(index, seg.id)}
                                          className="h-4 w-4 rounded border-zinc-600"
                                        />
                                        <span className="truncate">
                                          {seg.name} (segment {seg.wledSegmentIndex})
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-300">
                        Target Fixtures (DMX)
                      </label>
                      {groups.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-zinc-500 block mb-1">Groups</span>
                          <ScrollArea className="h-24 w-full rounded-md border border-zinc-700 bg-zinc-800/50">
                            <div className="flex flex-col gap-0.5 p-1.5">
                              {groups.map((group) => {
                                const fids = step.fixtureIds ?? [];
                                const groupFixtureIds = group.fixtures.map((f) => f.id);
                                const allSelected = groupFixtureIds.length > 0 && groupFixtureIds.every((id) => fids.includes(id));
                                const someSelected = groupFixtureIds.some((id) => fids.includes(id));
                                return (
                                  <label
                                    key={group.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border text-sm ${
                                      allSelected
                                        ? "bg-emerald-600 border-emerald-500 text-white"
                                        : someSelected
                                          ? "bg-emerald-600/60 border-emerald-500/60 text-emerald-100"
                                          : "bg-transparent border-transparent text-zinc-300 hover:bg-zinc-700/50"
                                    }`}
                                    title={group.description || undefined}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={allSelected}
                                      onChange={() => handleGroupToggle(index, groupFixtureIds)}
                                      className="h-4 w-4 rounded border-zinc-600"
                                    />
                                    <span className="truncate">{group.name} ({group.fixtures.length})</span>
                                  </label>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                      {fixtures.length === 0 ? (
                        <p className="text-zinc-400 text-sm">
                          No DMX fixtures. Add fixtures in the left panel.
                        </p>
                      ) : (
                        <>
                          {groups.length > 0 && (
                            <span className="text-xs text-zinc-500 block mb-1">Individual fixtures</span>
                          )}
                          <ScrollArea className="h-40 w-full rounded-md border border-zinc-700 bg-zinc-800/50">
                            <div className="flex flex-col gap-0.5 p-1.5">
                              {fixtures.map((fixture) => {
                                const fids = step.fixtureIds ?? [];
                                const checked = fids.includes(fixture.id);
                                return (
                                  <label
                                    key={fixture.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border ${
                                      checked
                                        ? "bg-emerald-600 border-emerald-500 text-white"
                                        : "bg-transparent border-transparent text-zinc-300 hover:bg-zinc-700/50"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => handleFixtureToggle(index, fixture.id)}
                                      className="h-4 w-4 rounded border-zinc-600"
                                    />
                                    <span className="truncate text-sm">
                                      {fixture.name} (Ch{fixture.startAddress})
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

