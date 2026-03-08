import { useState, useCallback, useRef } from "react";
import { useMultiDevice } from "../hooks/useMultiDevice";
import { useDmxFixtures } from "../hooks/useDmxFixtures";
import { useShows } from "../hooks/useShows";
import {
  type Cue,
  type CreateCueRequest,
  type UpdateCueRequest,
  devicesApi,
} from "../api/backendClient";
import { ColorPicker } from "./ColorPicker";
import { ColorPresetSelector } from "./ColorPresetSelector";

interface CueStep {
  id?: number;
  order: number;
  timeOffset: number;
  transitionDuration: number;
  targetColor: [number, number, number, number] | null;
  targetBrightness: number | null;
  startColor: [number, number, number, number] | null | []; // Empty array or null means use current
  startBrightness: number | null;
  turnOff: boolean;
  useWledEffect: boolean;
  wledEffectId: number | null;
  wledEffectSpeed: number | null;
  wledEffectIntensity: number | null;
  wledPaletteId: number | null;
  deviceIds: number[];
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
  const { shows } = useShows();
  const [name, setName] = useState(cue?.name || "");
  const [description, setDescription] = useState(cue?.description || "");
  const [selectedShowId, setSelectedShowId] = useState<number | null>(
    propShowId ?? cue?.showId ?? null
  );
  const [steps, setSteps] = useState<CueStep[]>(() => {
    if (cue?.cueSteps) {
      return cue.cueSteps.map((step) => ({
        id: step.id,
        order: step.order,
        timeOffset: step.timeOffset,
        transitionDuration: step.transitionDuration,
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
        deviceIds: step.cueStepDevices.map((csd) => csd.deviceId),
        fixtureIds: (step.cueStepFixtures ?? []).map((csf) => csf.fixtureId),
      }));
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
      timeOffset: steps.length > 0 ? steps[steps.length - 1].timeOffset + 1 : 0,
      transitionDuration: 1,
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
      fixtureIds: [],
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      order: i,
    }));
    setSteps(newSteps);
  };

  const duplicateStep = (index: number) => {
    const stepToDuplicate = steps[index];
    const duplicatedStep: CueStep = {
      order: stepToDuplicate.order + 1,
      timeOffset: stepToDuplicate.timeOffset + stepToDuplicate.transitionDuration,
      transitionDuration: stepToDuplicate.transitionDuration,
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
      setError("At least one step is required");
      return;
    }

    // Validate steps
    for (const step of steps) {
      const hasDevices = (step.deviceIds ?? []).length > 0;
      const hasFixtures = (step.fixtureIds ?? []).length > 0;
      if (!hasDevices && !hasFixtures) {
        setError(`Step ${step.order + 1} must have at least one device or fixture selected`);
        return;
      }
      const hasColorOrBrightness = step.targetColor != null || step.targetBrightness != null;
      const hasEffect = step.useWledEffect && step.wledEffectId != null;
      if (!step.turnOff && !hasColorOrBrightness && !hasEffect) {
        setError(
          `Step ${step.order + 1} must have turn off, color/brightness, or a WLED effect`
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
          timeOffset: step.timeOffset,
          transitionDuration: step.transitionDuration,
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
          deviceIds: step.deviceIds,
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
      setError("At least one step is required");
      return;
    }

    // Validate steps
    for (const step of steps) {
      const hasDevices = (step.deviceIds ?? []).length > 0;
      const hasFixtures = (step.fixtureIds ?? []).length > 0;
      if (!hasDevices && !hasFixtures) {
        setError(`Step ${step.order + 1} must have at least one device or fixture selected`);
        return;
      }
      const hasColorOrBrightness = step.targetColor != null || step.targetBrightness != null;
      const hasEffect = step.useWledEffect && step.wledEffectId != null;
      if (!step.turnOff && !hasColorOrBrightness && !hasEffect) {
        setError(
          `Step ${step.order + 1} must have turn off, color/brightness, or a WLED effect`
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
          timeOffset: step.timeOffset,
          transitionDuration: step.transitionDuration,
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

  const maxTime =
    steps.length > 0
      ? Math.max(
          ...steps.map(
            (step) => step.timeOffset + step.transitionDuration
          )
        )
      : 0;

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

      {/* Steps */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-white">Steps</h3>
          <button
            onClick={addStep}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white"
          >
            Add Step
          </button>
        </div>

        {steps.length === 0 ? (
          <p className="text-zinc-400 text-center py-8">
            No steps yet. Click "Add Step" to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className="p-4 bg-zinc-800 rounded-lg border border-zinc-700"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-semibold text-white">Step {step.order + 1}</h4>
                  <div className="flex gap-2">
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

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-300">
                      Start Delay (seconds)
                    </label>
                    <input
                      type="number"
                      value={step.timeOffset}
                      onChange={(e) =>
                        updateStep(index, {
                          timeOffset: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="0.1"
                      className="w-full px-3 py-2 bg-zinc-900 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-300">
                      Transition Duration (seconds)
                    </label>
                    <input
                      type="number"
                      value={step.transitionDuration}
                      onChange={(e) =>
                        updateStep(index, {
                          transitionDuration: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="0.1"
                      className="w-full px-3 py-2 bg-zinc-900 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

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
                        <div className="mt-2">
                          <ColorPresetSelector
                            selectedColor={step.targetColor}
                            onColorSelect={(color) =>
                              updateStep(index, { targetColor: color })
                            }
                            disabled={step.turnOff}
                          />
                        </div>
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
                        <div className="mt-2">
                          <ColorPresetSelector
                            selectedColor={null}
                            onColorSelect={(color) =>
                              updateStep(index, { targetColor: color })
                            }
                            disabled={step.turnOff}
                          />
                        </div>
                      </div>
                    )}
                  </div>
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
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-zinc-300">
                    Target Devices (WLED)
                  </label>
                  {devices.length === 0 ? (
                    <p className="text-zinc-400 text-sm">
                      No WLED devices. Add devices or use fixtures below.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {devices.map((device) => {
                        const isConnected = getDeviceConnectionStatus(device.id)?.isConnected ?? false;
                        const devIds = step.deviceIds ?? [];
                        return (
                          <label
                            key={device.id}
                            className={`px-3 py-2 rounded cursor-pointer border ${
                              devIds.includes(device.id)
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "bg-zinc-800 border-zinc-700 text-zinc-300"
                            } ${!isConnected ? "opacity-90" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={devIds.includes(device.id)}
                              onChange={() => handleDeviceToggle(index, device.id)}
                              className="sr-only"
                            />
                            {device.name}
                            {!isConnected && (
                              <span className="ml-1.5 text-xs opacity-80">(offline)</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-zinc-300">
                    Target Fixtures (DMX)
                  </label>
                  {fixtures.length === 0 ? (
                    <p className="text-zinc-400 text-sm">
                      No DMX fixtures. Add fixtures in the left panel.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {fixtures.map((fixture) => {
                        const fids = step.fixtureIds ?? [];
                        return (
                          <label
                            key={fixture.id}
                            className={`px-3 py-2 rounded cursor-pointer border ${
                              fids.includes(fixture.id)
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : "bg-zinc-800 border-zinc-700 text-zinc-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={fids.includes(fixture.id)}
                              onChange={() => handleFixtureToggle(index, fixture.id)}
                              className="sr-only"
                            />
                            {fixture.name} (Ch{fixture.startAddress})
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Visualization */}
      {steps.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4 text-white">Timeline</h3>
          <div className="relative bg-zinc-800 border border-zinc-700 rounded p-4 h-32 overflow-x-auto">
            <div className="relative" style={{ width: `${Math.max(maxTime * 100, 600)}px` }}>
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="absolute top-4 h-24 border-l-2 border-blue-500"
                  style={{
                    left: `${(step.timeOffset / maxTime) * 100}%`,
                    width: `${((step.timeOffset + step.transitionDuration) / maxTime) * 100}%`,
                  }}
                >
                  <div className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                    Step {step.order + 1}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {step.timeOffset}s - {step.timeOffset + step.transitionDuration}s
                  </div>
                </div>
              ))}
              {/* Time markers */}
              {Array.from({ length: Math.ceil(maxTime) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 border-l border-zinc-700 text-xs text-zinc-400"
                  style={{ left: `${(i / maxTime) * 100}%` }}
                >
                  <span className="ml-1">{i}s</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

