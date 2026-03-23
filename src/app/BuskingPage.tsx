import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal, Save, Zap, Aperture, ChevronDown, ChevronRight, Plus, Trash2, Sliders } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Slider } from "@/app/components/ui/slider";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useDmxFixtures } from "@/hooks/useDmxFixtures";
import { useMultiDevice } from "@/hooks/useMultiDevice";
import { useShows } from "@/hooks/useShows";
import {
  executionApi,
  cuesApi,
  buskingPatchApi,
  presetsApi,
  colorPresetsApi,
  type CreateCueRequest,
  type BuskingPatchEntry,
  type BuskingPatchEntryInput,
  type Preset,
  type ColorPreset,
} from "@/api/backendClient";
import { parseBuskingCommand } from "@/app/busking/commandParser";
import {
  DmxChannelsModal,
  buildFixtureChannelValuesFromState,
} from "@/app/components/DmxChannelsModal";
import type { DmxFixture } from "@/api/backendClient";

type Unit = { type: "device"; id: number; name: string } | { type: "fixture"; id: number; name: string };

interface UnitState {
  color: [number, number, number, number];
  brightness: number;
  on: boolean;
}

const DEFAULT_STATE: UnitState = {
  color: [255, 255, 255, 0],
  brightness: 0,
  on: false,
};

function unitKey(unit: Unit): string {
  return unit.type === "device" ? `d-${unit.id}` : `f-${unit.id}`;
}

function hexToRgb(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [255, 255, 255, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    0,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const LIVE_DEBOUNCE_MS = 120;

function colorToHex(color: [number, number, number, number]): string {
  const [r, g, b] = color;
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function namedColorToRgba(name: string): [number, number, number, number] | null {
  const n = name.trim().toLowerCase();
  const table: Record<string, [number, number, number, number]> = {
    red: [255, 0, 0, 0],
    green: [0, 255, 0, 0],
    blue: [0, 0, 255, 0],
    white: [255, 255, 255, 0],
    yellow: [255, 255, 0, 0],
    cyan: [0, 255, 255, 0],
    magenta: [255, 0, 255, 0],
    orange: [255, 165, 0, 0],
    purple: [128, 0, 128, 0],
  };
  return table[n] ?? null;
}

export default function BuskingPage() {
  const navigate = useNavigate();
  const { fixtures, loading: fixturesLoading } = useDmxFixtures();
  const { devices, loading: devicesLoading } = useMultiDevice();
  const { shows } = useShows();

  const [liveMode, setLiveMode] = useState(false);
  const [unitStates, setUnitStates] = useState<Record<string, UnitState>>({});
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [cueName, setCueName] = useState("");
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const liveDebounceByUnit = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Patch
  const [patchEntries, setPatchEntries] = useState<BuskingPatchEntry[]>([]);
  const [patchLoading, setPatchLoading] = useState(true);
  const [patchSaving, setPatchSaving] = useState(false);
  const [patchSectionOpen, setPatchSectionOpen] = useState(false);
  const [patchDraft, setPatchDraft] = useState<BuskingPatchEntryInput[]>([]);
  const [patchDraftDirty, setPatchDraftDirty] = useState(false);

  // Command bar (fixed at bottom)
  const [commandLine, setCommandLine] = useState("");
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Command drawer color presets
  type UnifiedPreset =
    | { key: `p-${number}`; source: "preset"; id: number; name: string; color: [number, number, number, number]; brightness: number }
    | { key: `c-${number}`; source: "colorPreset"; id: number; name: string; color: [number, number, number, number] };
  const [commandPresetsLoading, setCommandPresetsLoading] = useState(true);
  const [commandColorPresets, setCommandColorPresets] = useState<ColorPreset[]>([]);
  const [commandPresets, setCommandPresets] = useState<Preset[]>([]);

  const units: Unit[] = useMemo(() => {
    const devs: Unit[] = devices.map((d) => ({ type: "device", id: d.id, name: d.name }));
    const fixs: Unit[] = fixtures.map((f) => ({ type: "fixture", id: f.id, name: f.name }));
    return [...devs, ...fixs];
  }, [devices, fixtures]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setCommandPresetsLoading(true);
        const [presetList, colorList] = await Promise.all([
          presetsApi.getAll().catch(() => []),
          colorPresetsApi.getAll().catch(() => []),
        ]);
        if (cancelled) return;
        setCommandPresets(presetList);
        setCommandColorPresets(colorList);
      } finally {
        if (!cancelled) setCommandPresetsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const unifiedColorPresets: UnifiedPreset[] = useMemo(() => {
    const unified: UnifiedPreset[] = [
      ...commandPresets.map((p) => ({
        key: `p-${p.id}` as const,
        source: "preset" as const,
        id: p.id,
        name: p.name,
        color: p.color,
        brightness: p.brightness,
      })),
      ...commandColorPresets.map((p) => ({
        key: `c-${p.id}` as const,
        source: "colorPreset" as const,
        id: p.id,
        name: p.name,
        color: p.color,
      })),
    ];
    unified.sort((a, b) => a.name.localeCompare(b.name));
    return unified;
  }, [commandPresets, commandColorPresets]);

  const patchMapByFixtureNumber = useMemo(() => {
    const map = new Map<number, BuskingPatchEntry>();
    patchEntries.forEach((e) => map.set(e.fixtureNumber, e));
    return map;
  }, [patchEntries]);

  const getUnitByPatchEntry = useCallback(
    (entry: BuskingPatchEntry): Unit | null => {
      if (entry.deviceId != null) {
        const u = units.find((x) => x.type === "device" && x.id === entry.deviceId);
        return u ?? null;
      }
      if (entry.dmxFixtureId != null) {
        const u = units.find((x) => x.type === "fixture" && x.id === entry.dmxFixtureId);
        return u ?? null;
      }
      return null;
    },
    [units]
  );

  const patchNumbersByUnitKey = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const entry of patchEntries) {
      const unit = getUnitByPatchEntry(entry);
      if (!unit) continue;
      const key = unitKey(unit);
      if (!map[key]) map[key] = [];
      map[key].push(entry.fixtureNumber);
    }
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a - b));
    return map;
  }, [patchEntries, getUnitByPatchEntry]);

  const patchedUnitsOrdered = useMemo(() => {
    const keyToUnit = new Map<string, Unit>();
    for (const u of units) keyToUnit.set(unitKey(u), u);
    const withMinPatch = Object.entries(patchNumbersByUnitKey)
      .map(([key, nums]) => ({ unit: keyToUnit.get(key), minPatch: nums[0] }))
      .filter((x): x is { unit: Unit; minPatch: number } => x.unit != null);
    withMinPatch.sort((a, b) => a.minPatch - b.minPatch);
    return withMinPatch.map((x) => x.unit);
  }, [units, patchNumbersByUnitKey]);

  const fetchPatch = useCallback(async () => {
    setPatchLoading(true);
    try {
      const list = await buskingPatchApi.getAll();
      setPatchEntries(list);
      setPatchDraft(
        list.map((e) => ({
          fixtureNumber: e.fixtureNumber,
          ...(e.deviceId != null ? { deviceId: e.deviceId } : { dmxFixtureId: e.dmxFixtureId! }),
        }))
      );
      setPatchDraftDirty(false);
    } catch (e) {
      console.error("Failed to fetch busking patch:", e);
    } finally {
      setPatchLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatch();
  }, [fetchPatch]);

  const savePatch = useCallback(async () => {
    const valid = patchDraft.filter((e) => e.deviceId != null || e.dmxFixtureId != null);
    if (valid.some((e) => (e.deviceId != null ? 1 : 0) + (e.dmxFixtureId != null ? 1 : 0) !== 1)) return;
    setPatchSaving(true);
    try {
      const list = await buskingPatchApi.setPatch(valid);
      setPatchEntries(list);
      setPatchDraft(
        list.map((e) => ({
          fixtureNumber: e.fixtureNumber,
          ...(e.deviceId != null ? { deviceId: e.deviceId } : { dmxFixtureId: e.dmxFixtureId! }),
        }))
      );
      setPatchDraftDirty(false);
    } catch (e) {
      console.error("Failed to save patch:", e);
    } finally {
      setPatchSaving(false);
    }
  }, [patchDraft]);

  const addPatchRow = useCallback(() => {
    const nextNum =
      patchDraft.length === 0 ? 1 : Math.max(...patchDraft.map((e) => e.fixtureNumber), 0) + 1;
    setPatchDraft((prev) => [...prev, { fixtureNumber: nextNum }]);
    setPatchDraftDirty(true);
  }, [patchDraft]);

  const removePatchRow = useCallback((fixtureNumber: number) => {
    setPatchDraft((prev) => prev.filter((e) => e.fixtureNumber !== fixtureNumber));
    setPatchDraftDirty(true);
  }, []);

  const updatePatchRow = useCallback((fixtureNumber: number, value: "none" | { deviceId: number } | { dmxFixtureId: number }) => {
    setPatchDraft((prev) =>
      prev.map((e) => {
        if (e.fixtureNumber !== fixtureNumber) return e;
        if (value === "none") return { fixtureNumber };
        return { fixtureNumber, ...value };
      })
    );
    setPatchDraftDirty(true);
  }, []);

  const getState = useCallback((unit: Unit): UnitState => {
    return unitStates[unitKey(unit)] ?? DEFAULT_STATE;
  }, [unitStates]);

  const setState = useCallback((unit: Unit, patch: Partial<UnitState>) => {
    const key = unitKey(unit);
    setUnitStates((prev) => {
      const next = { ...prev };
      next[key] = { ...(prev[key] ?? DEFAULT_STATE), ...patch };
      return next;
    });
  }, []);

  const applyLive = useCallback(
    (unit: Unit, state: UnitState) => {
      if (unit.type === "device") {
        executionApi
          .setDevice(unit.id, {
            color: state.color,
            brightness: state.brightness,
            on: state.on,
          })
          .catch((e) => console.error("setDevice failed:", e));
      } else {
        executionApi
          .setFixture(unit.id, {
            color: state.color,
            brightness: state.brightness,
            turnOff: !state.on,
          })
          .catch((e) => console.error("setFixture failed:", e));
      }
    },
    []
  );

  const updateUnitState = useCallback(
    (unit: Unit, patch: Partial<UnitState>) => {
      const key = unitKey(unit);
      const current = unitStates[key] ?? DEFAULT_STATE;
      const nextState = { ...current, ...patch };
      setState(unit, patch);
      if (liveMode) {
        const existing = liveDebounceByUnit.current.get(key);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          liveDebounceByUnit.current.delete(key);
          applyLive(unit, nextState);
        }, LIVE_DEBOUNCE_MS);
        liveDebounceByUnit.current.set(key, t);
      }
    },
    [liveMode, unitStates, setState, applyLive]
  );

  useEffect(() => {
    return () => {
      liveDebounceByUnit.current.forEach((t) => clearTimeout(t));
      liveDebounceByUnit.current.clear();
    };
  }, []);

  const handleSaveAsCue = useCallback(async () => {
    if (!cueName.trim()) {
      setSaveError("Enter a cue name");
      return;
    }
    const showId = selectedShowId ? parseInt(selectedShowId, 10) : null;
    if (!showId || isNaN(showId)) {
      setSaveError("Select a show");
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const steps: CreateCueRequest["steps"] = [];
      let order = 0;
      for (const unit of patchedUnitsOrdered) {
        const state = getState(unit);
        const turnOff = !state.on;
        const targetBrightness =
          turnOff ? null : Math.max(1, state.brightness);
        if (unit.type === "device") {
          steps.push({
            order: order++,
            deviceIds: [unit.id],
            targetColor: state.color,
            targetBrightness,
            turnOff,
          });
        } else {
          steps.push({
            order: order++,
            fixtureIds: [unit.id],
            targetColor: state.color,
            targetBrightness,
            turnOff,
          });
        }
      }
      if (steps.length === 0) {
        setSaveError("Patch at least one fixture to save as cue");
        setSaving(false);
        return;
      }
      await cuesApi.create({ name: cueName.trim(), showId, steps });
      setSaveSuccess(true);
      setCueName("");
      setSelectedShowId("");
      setTimeout(() => {
        setSaveModalOpen(false);
        setSaveSuccess(false);
      }, 800);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save cue");
    } finally {
      setSaving(false);
    }
  }, [patchedUnitsOrdered, getState, cueName, selectedShowId]);

  const handleCommandSubmit = useCallback(() => {
    const line = commandLine.trim();
    if (!line) return;
    const parsed = parseBuskingCommand(line);
    if (!parsed) {
      setCommandMessage(
        "Unknown command. Try: 1 @ 50, 1 On, 1 Thru 5 Full, 1-5 Full, 1,2,5 Full, 1 Off, 1 @ 50 color Red"
      );
      return;
    }
    if (parsed.error) {
      setCommandMessage(parsed.error);
      return;
    }

    const resolvedColor =
      parsed.colorName != null
        ? (() => {
            const match = unifiedColorPresets.find(
              (p) => p.name.toLowerCase() === parsed.colorName!.trim().toLowerCase()
            );
            if (match) return match.color;
            return namedColorToRgba(parsed.colorName!);
          })()
        : null;
    if (parsed.colorName && !resolvedColor) {
      setCommandMessage(`Unknown color '${parsed.colorName}'. Pick one from the dropdown or save it as a preset.`);
      return;
    }

    const brightness = parsed.off ? 0 : Math.round(((parsed.level ?? 100) / 100) * 255);
    const on = !parsed.off;
    const targets: Unit[] = [];
    const missing: number[] = [];
    for (const fn of parsed.fixtureNumbers) {
      const entry = patchMapByFixtureNumber.get(fn);
      if (!entry) {
        missing.push(fn);
        continue;
      }
      const unit = getUnitByPatchEntry(entry);
      if (unit) targets.push(unit);
      else missing.push(fn);
    }
    if (missing.length > 0) {
      setCommandMessage(`Fixture(s) ${missing.join(", ")} not patched or not found`);
      return;
    }
    const bri = on ? Math.max(1, brightness) : 0;
    for (const unit of targets) {
      updateUnitState(unit, { brightness: bri, on, ...(on && resolvedColor ? { color: resolvedColor } : {}) });
    }
    setCommandMessage(`OK: ${targets.length} fixture(s)`);
    setCommandLine("");
  }, [
    commandLine,
    patchMapByFixtureNumber,
    getUnitByPatchEntry,
    updateUnitState,
    unifiedColorPresets,
  ]);

  const isLoading = devicesLoading || fixturesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="border-b border-zinc-900 bg-zinc-950/95 sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white"
              onClick={() => navigate("/shows")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Shows
            </Button>
          </div>
        </div>
        <div className="container mx-auto px-6 py-12 text-center">
          <SlidersHorizontal className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No fixtures or devices</h2>
          <p className="text-zinc-400 mb-6">
            Add WLED devices or DMX fixtures to use the busking page.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              className="border-zinc-700"
              onClick={() => navigate("/devices/wled")}
            >
              <Zap className="w-4 h-4 mr-2" />
              WLED Devices
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700"
              onClick={() => navigate("/devices/dmx")}
            >
              <Aperture className="w-4 h-4 mr-2" />
              DMX Fixtures
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
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
                <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-violet-500 rounded-lg flex items-center justify-center">
                  <SlidersHorizontal className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">Busking</h1>
                  <p className="text-xs text-zinc-500">
                    Adjust fixtures live or save as cue. Command line is always at the bottom.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="live-mode" className="text-zinc-400 text-sm">
                  Live
                </Label>
                <Switch
                  id="live-mode"
                  checked={liveMode}
                  onCheckedChange={setLiveMode}
                />
              </div>
              <Button
                variant="outline"
                className="border-zinc-700"
                onClick={() => setSaveModalOpen(true)}
              >
                <Save className="w-4 h-4 mr-2" />
                Save as cue
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-48">
      {/* Patch section - collapsible */}
      <div className="container mx-auto px-6 pt-2">
        <button
          type="button"
          onClick={() => setPatchSectionOpen((o) => !o)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium"
        >
          {patchSectionOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          Patch (fixture numbers for command line)
        </button>
        {patchSectionOpen && (
          <div className="mt-3 p-4 rounded-lg bg-zinc-900/80 border border-zinc-800">
            {patchLoading ? (
              <p className="text-zinc-500 text-sm">Loading patch...</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 items-center mb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-zinc-700"
                    onClick={addPatchRow}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                  {patchDraftDirty && (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={savePatch}
                      disabled={patchSaving}
                    >
                      {patchSaving ? "Saving..." : "Save patch"}
                    </Button>
                  )}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {patchDraft.map((row) => (
                    <div key={row.fixtureNumber} className="flex items-center gap-2 flex-wrap">
                      <span className="text-zinc-400 w-8">#{row.fixtureNumber}</span>
                      <Select
                        value={
                          row.deviceId != null
                            ? `d-${row.deviceId}`
                            : row.dmxFixtureId != null
                              ? `f-${row.dmxFixtureId}`
                              : "none"
                        }
                        onValueChange={(v) => {
                          if (v === "none") updatePatchRow(row.fixtureNumber, "none");
                          else if (v.startsWith("d-"))
                            updatePatchRow(row.fixtureNumber, { deviceId: parseInt(v.slice(2), 10) });
                          else if (v.startsWith("f-"))
                            updatePatchRow(row.fixtureNumber, { dmxFixtureId: parseInt(v.slice(2), 10) });
                        }}
                      >
                        <SelectTrigger className="w-[220px] bg-zinc-800 border-zinc-700 text-white text-sm">
                          <SelectValue placeholder="Select device or fixture" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                          <SelectItem value="none" className="text-zinc-400 focus:bg-zinc-700 focus:text-white">
                            —
                          </SelectItem>
                          {devices.map((d) => (
                            <SelectItem key={`d-${d.id}`} value={`d-${d.id}`} className="text-white focus:bg-zinc-700 focus:text-white">
                              [WLED] {d.name}
                            </SelectItem>
                          ))}
                          {fixtures.map((f) => (
                            <SelectItem key={`f-${f.id}`} value={`f-${f.id}`} className="text-white focus:bg-zinc-700 focus:text-white">
                              [DMX] {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-zinc-500 hover:text-red-400"
                        onClick={() => removePatchRow(row.fixtureNumber)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-wrap gap-4 pb-4">
          {patchedUnitsOrdered.map((unit) => (
            <BuskingTile
              key={unitKey(unit)}
              unit={unit}
              fixture={unit.type === "fixture" ? fixtures.find((f) => f.id === unit.id) ?? null : null}
              patchNumbers={patchNumbersByUnitKey[unitKey(unit)] ?? []}
              state={getState(unit)}
              onUpdate={(patch) => updateUnitState(unit, patch)}
              liveMode={liveMode}
            />
          ))}
        </div>
      </div>
      </div>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Save as cue</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Save current busking state as a new cue. Choose a show to add it to.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cue-name" className="text-zinc-300">
                Cue name
              </Label>
              <Input
                id="cue-name"
                value={cueName}
                onChange={(e) => setCueName(e.target.value)}
                placeholder="e.g. Busk 1"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-zinc-300">Show</Label>
              <Select
                value={selectedShowId || undefined}
                onValueChange={setSelectedShowId}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select a show" />
                </SelectTrigger>
                <SelectContent>
                  {shows.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={String(s.id)}
                      className="text-white focus:bg-zinc-700"
                    >
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {saveError && (
              <p className="text-sm text-red-400">{saveError}</p>
            )}
            {saveSuccess && (
              <p className="text-sm text-emerald-400">Cue saved.</p>
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              className="border-zinc-700"
              onClick={() => setSaveModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSaveAsCue}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save cue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Command line — fixed bottom bar, always visible */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
        <div className="container mx-auto px-6 py-3 max-w-screen-2xl">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-800/80 pb-2 mb-1">
              <h2 className="text-sm font-medium text-white">Command line</h2>
              <p className="text-xs text-zinc-500">
                1 @ 50 · 1 On · 1 Thru 5 Full · 1-5 Full · 1,2,5 Full · 1 Off · 1 @ 50 color Red
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                ref={commandInputRef}
                value={commandLine}
                onChange={(e) => setCommandLine(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCommandSubmit();
                  }
                }}
                placeholder="1 @ 50"
                className="bg-zinc-800 border-zinc-700 text-white font-mono flex-1 min-w-[240px]"
              />
              <Select
                value=""
                disabled={commandPresetsLoading || unifiedColorPresets.length === 0}
                onValueChange={(value) => {
                  const preset = unifiedColorPresets.find((p) => p.key === value);
                  if (!preset) return;
                  setCommandLine((prev) => {
                    const base = prev.replace(/\s+color\s+.+$/i, "").trimEnd();
                    return (base ? `${base} ` : "") + `color ${preset.name}`;
                  });
                }}
              >
                <SelectTrigger className="w-[220px] bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue
                    placeholder={
                      commandPresetsLoading
                        ? "Loading colors..."
                        : unifiedColorPresets.length === 0
                          ? "No presets"
                          : "Preset color..."
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {unifiedColorPresets.map((p) => (
                    <SelectItem key={p.key} value={p.key} className="text-white focus:bg-zinc-700 focus:text-white">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded border border-zinc-600 flex-shrink-0"
                          style={{ backgroundColor: colorToHex(p.color) }}
                        />
                        <span className="truncate">{p.name}</span>
                        <span className="text-zinc-500 text-xs truncate">{colorToHex(p.color)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                className="bg-violet-600 hover:bg-violet-700"
                onClick={handleCommandSubmit}
              >
                Go
              </Button>
            </div>
            {commandMessage != null && (
              <p className="text-sm text-zinc-400">{commandMessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BuskingTile({
  unit,
  fixture,
  patchNumbers,
  state,
  onUpdate,
  liveMode,
}: {
  unit: Unit;
  fixture: DmxFixture | null;
  patchNumbers: number[];
  state: UnitState;
  onUpdate: (patch: Partial<UnitState>) => void;
  liveMode: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [r, g, b] = state.color;
  const hex = rgbToHex(r, g, b);

  const getInitialChannels = useCallback(() => {
    if (!fixture) return [];
    const purposes =
      Array.isArray(fixture.channelPurposes) && fixture.channelPurposes.length === fixture.channelCount
        ? (fixture.channelPurposes as string[])
        : Array(fixture.channelCount).fill("dimmer");
    return buildFixtureChannelValuesFromState(
      purposes,
      state.color,
      state.brightness,
      state.on
    );
  }, [fixture, state.color, state.brightness, state.on]);

  const initialChannels = fixture && advancedOpen ? getInitialChannels() : [];

  return (
    <div className="flex-shrink-0 w-[200px] bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase">
            {unit.type === "device" ? "WLED" : "DMX"}
          </span>
          <span className="font-medium text-white truncate" title={unit.name}>
            {unit.name}
          </span>
        </div>
        {patchNumbers.length > 0 && (
          <span className="text-xs text-violet-400 font-mono" title="Use in command line">
            Fixture #{patchNumbers.join(", #")}
          </span>
        )}
      </div>
      <div
        className="h-12 rounded-md border border-zinc-700 transition-colors"
        style={{ backgroundColor: state.on ? hex : "#1a1a1a" }}
      />
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onUpdate({ color: hexToRgb(e.target.value) })}
          className="w-8 h-8 rounded border border-zinc-700 cursor-pointer bg-transparent"
        />
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-zinc-500">Brightness</Label>
          <Slider
            value={[state.brightness]}
            onValueChange={([v]) => onUpdate({ brightness: v ?? 0 })}
            min={0}
            max={255}
            step={1}
            className="mt-1 [&_[data-slot=slider-track]]:bg-gradient-to-r [&_[data-slot=slider-track]]:from-black [&_[data-slot=slider-track]]:to-white [&_[data-slot=slider-range]]:bg-transparent"
          />
        </div>
      </div>
      {unit.type === "fixture" && fixture && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-0 bg-violet-600 text-white hover:bg-white hover:text-violet-600"
          onClick={() => setAdvancedOpen(true)}
        >
          <Sliders className="w-3.5 h-3.5 mr-1.5" />
          Channels
        </Button>
      )}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-zinc-500">On</Label>
        <Switch
          checked={state.on}
          onCheckedChange={(on) => onUpdate({ on })}
        />
      </div>
      {fixture && (
        <DmxChannelsModal
          fixture={fixture}
          initialChannels={initialChannels}
          isOpen={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          liveMode={liveMode}
        />
      )}
    </div>
  );
}
