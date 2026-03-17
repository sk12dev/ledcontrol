import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus,
  Settings,
  Zap,
  AlertTriangle,
  ArrowLeft,
  Edit2,
  Network,
  Aperture,
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Palette,
  Trash2,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { LightingDevice } from "@/app/components/LightingDevice";
import { CueTable, type CueRow } from "@/app/components/CueTable";
import { DeviceModal } from "@/app/components/DeviceModal";
import { ArtNetNodeModal } from "@/app/components/ArtNetNodeModal";
import { DmxFixtureModal } from "@/app/components/DmxFixtureModal";
import { useCues } from "@/hooks/useCues";
import { useMultiDevice } from "@/hooks/useMultiDevice";
import { useShows } from "@/hooks/useShows";
import { useCueLists } from "@/hooks/useCueLists";
import { useArtNetNodes } from "@/hooks/useArtNetNodes";
import { useDmxFixtures } from "@/hooks/useDmxFixtures";
import {
  type Device,
  type Cue,
  type ArtNetNode,
  type DmxFixture,
  type CreateCueRequest,
  type UpdateCueRequest,
} from "@/api/backendClient";
import { setState } from "@/api/wledClient";
import { Sheet, SheetContent } from "@/app/components/ui/sheet";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { CueBuilder } from "@/components/CueBuilder";
import { presetsApi, type Preset } from "@/api/backendClient";

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [255, 255, 255];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

export default function App() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showId = id ? parseInt(id, 10) : undefined;

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ArtNetNode | null>(null);
  const [isFixtureModalOpen, setIsFixtureModalOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<DmxFixture | null>(null);
  const [isBlackoutDialogOpen, setIsBlackoutDialogOpen] = useState(false);
  const [isBlackingOut, setIsBlackingOut] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastExecutedCueId, setLastExecutedCueId] = useState<number | null>(
    null,
  );

  // Left panel collapsible sections
  const [wledOpen, setWledOpen] = useState(true);
  const [artnetOpen, setArtnetOpen] = useState(true);
  const [dmxOpen, setDmxOpen] = useState(true);
  const [presetColorsOpen, setPresetColorsOpen] = useState(true);

  // Preset colors (color + brightness)
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [presetForm, setPresetForm] = useState<{
    name: string;
    colorHex: string;
    brightness: number;
  }>({
    name: "",
    colorHex: "#FFFFFF",
    brightness: 128,
  });

  // Cue drawer state
  const [isCueDrawerOpen, setIsCueDrawerOpen] = useState(false);
  const [editingCue, setEditingCue] = useState<Cue | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [deleteCueId, setDeleteCueId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Use real hooks instead of mock data
  const {
    cues,
    loading: cuesLoading,
    executeCue,
    deleteCue,
    createCue,
    updateCue,
    executionStatus,
  } = useCues(undefined, showId);
  const {
    devices,
    getDeviceConnectionStatus,
    getDeviceState,
    getConnectedDevices,
    loading: devicesLoading,
    refreshDevices,
    refreshDeviceStates,
  } = useMultiDevice();
  const { shows, loading: showsLoading } = useShows();
  const { loading: cueListsLoading } = useCueLists(undefined, showId);
  const { nodes, refreshNodes } = useArtNetNodes();
  const { fixtures, refreshFixtures } = useDmxFixtures();

  const refreshPresets = useCallback(async () => {
    setPresetsLoading(true);
    setPresetsError(null);
    try {
      const list = await presetsApi.getAll();
      setPresets(list);
    } catch (e) {
      console.error("Failed to load presets:", e);
      setPresetsError(
        e instanceof Error ? e.message : "Failed to load presets",
      );
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  // Get current show data
  const currentShow = useMemo(() => {
    return showId ? shows.find((s) => s.id === showId) : null;
  }, [shows, showId]);

  // Redirect to shows list if showId is invalid or not found
  useEffect(() => {
    if (!showsLoading && showId !== undefined) {
      if (isNaN(showId) || !currentShow) {
        // Invalid showId or show not found, redirect to shows list
        navigate("/shows", { replace: true });
      } else {
        // Save to localStorage when valid show is loaded
        localStorage.setItem("selectedShowId", showId.toString());
      }
    }
  }, [showsLoading, showId, currentShow, navigate]);

  // Convert devices to LightingDevice format
  const lightingDevices = useMemo(() => {
    return devices.map((device) => {
      const status = getDeviceConnectionStatus(device.id);
      const isConnected = status?.isConnected ?? false;
      const deviceState = getDeviceState(device.id);

      // Convert brightness from 0-255 to 0-100 percentage
      let deviceIntensity = 0;
      if (deviceState && isConnected) {
        deviceIntensity = Math.round((deviceState.brightness / 255) * 100);
      }

      // Convert color from [R, G, B, W] to hex string
      let deviceColor = "#FF6B35"; // Default orange
      if (deviceState && isConnected && deviceState.color) {
        const [r, g, b] = deviceState.color;
        deviceColor = `#${[r, g, b]
          .map((x) => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
          })
          .join("")}`;
      }

      return {
        id: device.id.toString(),
        deviceId: device.id,
        ipAddress: device.ipAddress,
        name: device.name,
        type: "WLED Device", // Could be enhanced with device type
        intensity: deviceIntensity,
        color: deviceColor,
        isActive: isConnected && deviceState?.isOn === true,
      };
    });
  }, [devices, getDeviceConnectionStatus, getDeviceState]);

  // Convert cues to table row format
  const cueRows: CueRow[] = useMemo(() => {
    return cues.map((cue) => {
      const previewColors: string[] = [];
      if (cue.cueSteps && cue.cueSteps.length > 0) {
        cue.cueSteps.forEach((step) => {
          if (step.targetColor) {
            const [r, g, b] = step.targetColor;
            const hex = `#${[r, g, b]
              .map((x) => {
                const h = x.toString(16);
                return h.length === 1 ? "0" + h : h;
              })
              .join("")}`;
            if (!previewColors.includes(hex)) {
              previewColors.push(hex);
            }
          }
        });
      }

      const duration = 0;

      const deviceIds =
        cue.cueSteps?.flatMap(
          (s) => s.cueStepDevices?.map((csd) => `d:${csd.deviceId}`) || [],
        ) ?? [];
      const fixtureIds =
        cue.cueSteps?.flatMap(
          (s) => s.cueStepFixtures?.map((csf) => `f:${csf.fixtureId}`) || [],
        ) ?? [];
      const deviceCount = new Set([...deviceIds, ...fixtureIds]).size;

      return {
        id: cue.id.toString(),
        name: cue.name,
        description: cue.description || "",
        stepsCount: cue.cueSteps?.length ?? 0,
        duration: Math.round(duration),
        deviceCount,
        previewColors: previewColors.length > 0 ? previewColors : ["#1a1a1a"],
        createdAt: cue.createdAt ?? "",
      };
    });
  }, [cues]);

  const connectedDevices = getConnectedDevices();
  const connectedCount = connectedDevices.length;
  const isLoading =
    cuesLoading || devicesLoading || showsLoading || cueListsLoading;

  // Find running cue name
  const runningCue = useMemo(() => {
    if (executionStatus?.isRunning && executionStatus?.cueId) {
      return cues.find((c) => c.id === executionStatus.cueId);
    }
    return null;
  }, [executionStatus, cues]);

  // Find last executed cue (current state)
  const currentStateCue = useMemo(() => {
    if (lastExecutedCueId) {
      return cues.find((c) => c.id === lastExecutedCueId);
    }
    return null;
  }, [lastExecutedCueId, cues]);

  // Update elapsed time every second when a cue is running
  useEffect(() => {
    if (!executionStatus?.isRunning || !executionStatus?.startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - executionStatus.startTime!) / 1000,
      );
      setElapsedTime(elapsed);
    }, 1000);

    // Update immediately
    setElapsedTime(Math.floor((Date.now() - executionStatus.startTime) / 1000));

    return () => clearInterval(interval);
  }, [executionStatus?.isRunning, executionStatus?.startTime]);

  // Track last executed cue when execution finishes
  const prevExecutionStatus = useRef<{
    isRunning: boolean;
    cueId: number | null;
  } | null>(null);
  useEffect(() => {
    const currentIsRunning = executionStatus?.isRunning ?? false;
    const currentCueId = executionStatus?.cueId ?? null;
    const prevIsRunning = prevExecutionStatus.current?.isRunning ?? false;
    const prevCueId = prevExecutionStatus.current?.cueId ?? null;

    // Detect transition from running to not running
    if (prevIsRunning && !currentIsRunning && prevCueId) {
      // Cue just finished executing, save it as the last executed
      setLastExecutedCueId(prevCueId);
    }

    // Update ref for next comparison
    prevExecutionStatus.current = {
      isRunning: currentIsRunning,
      cueId: currentCueId,
    };
  }, [executionStatus?.isRunning, executionStatus?.cueId]);

  const handleAddDevice = () => {
    setEditingDevice(null);
    setIsDeviceModalOpen(true);
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setIsDeviceModalOpen(true);
  };

  const handleCloseDeviceModal = () => {
    setIsDeviceModalOpen(false);
    setEditingDevice(null);
  };

  const handleDeviceSave = async () => {
    await refreshDevices();
  };

  const handleDeviceDelete = async () => {
    await refreshDevices();
  };

  const handleAddNode = () => {
    setEditingNode(null);
    setIsNodeModalOpen(true);
  };
  const handleEditNode = (node: ArtNetNode) => {
    setEditingNode(node);
    setIsNodeModalOpen(true);
  };
  const handleCloseNodeModal = () => {
    setIsNodeModalOpen(false);
    setEditingNode(null);
  };

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

  const openNewPresetModal = () => {
    setEditingPreset(null);
    setPresetForm({
      name: "",
      colorHex: "#FFFFFF",
      brightness: 128,
    });
    setPresetModalOpen(true);
  };

  const openEditPresetModal = (preset: Preset) => {
    setEditingPreset(preset);
    const [r, g, b] = preset.color;
    setPresetForm({
      name: preset.name,
      colorHex: rgbToHex(r, g, b),
      brightness: preset.brightness,
    });
    setPresetModalOpen(true);
  };

  const savePreset = async () => {
    const name = presetForm.name.trim();
    if (!name) return;
    const [r, g, b] = hexToRgb(presetForm.colorHex);
    const brightness = Math.max(
      1,
      Math.min(255, Math.round(presetForm.brightness || 0)),
    );

    try {
      if (editingPreset) {
        await presetsApi.update(editingPreset.id, {
          name,
          color: [r, g, b, 0],
          brightness,
        });
      } else {
        await presetsApi.create({
          name,
          color: [r, g, b, 0],
          brightness,
        });
      }
      setPresetModalOpen(false);
      setEditingPreset(null);
      await refreshPresets();
    } catch (e) {
      console.error("Failed to save preset:", e);
      alert(e instanceof Error ? e.message : "Failed to save preset");
    }
  };

  const deletePreset = async (preset: Preset) => {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
    try {
      await presetsApi.delete(preset.id);
      await refreshPresets();
    } catch (e) {
      console.error("Failed to delete preset:", e);
      alert(e instanceof Error ? e.message : "Failed to delete preset");
    }
  };

  // Cue drawer handlers
  const handleNewCue = () => {
    setEditingCue(null);
    setIsCopyMode(false);
    setIsCueDrawerOpen(true);
  };

  const handleEditCue = (cueId: number) => {
    const cue = cues.find((c) => c.id === cueId);
    if (cue) {
      setEditingCue(cue);
      setIsCopyMode(false);
      setIsCueDrawerOpen(true);
    }
  };

  const handleCopyCue = (cueId: number) => {
    const cue = cues.find((c) => c.id === cueId);
    if (cue) {
      setEditingCue(cue);
      setIsCopyMode(true);
      setIsCueDrawerOpen(true);
    }
  };

  const handleDeleteCueClick = (cueId: number) => {
    setDeleteCueId(cueId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCue = async () => {
    if (deleteCueId !== null) {
      try {
        await deleteCue(deleteCueId);
        setIsDeleteDialogOpen(false);
        setDeleteCueId(null);
      } catch (err) {
        console.error("Failed to delete cue:", err);
      }
    }
  };

  const handleSaveCue = async (
    cueData: CreateCueRequest | UpdateCueRequest,
  ) => {
    try {
      if (editingCue && !isCopyMode) {
        // Update existing cue
        await updateCue(editingCue.id, cueData as UpdateCueRequest);
      } else {
        // Create new cue (either from scratch or as a copy)
        await createCue(cueData as CreateCueRequest);
      }
      setIsCueDrawerOpen(false);
      setEditingCue(null);
      setIsCopyMode(false);
    } catch (err) {
      console.error("Failed to save cue:", err);
      throw err; // Re-throw so CueBuilder can handle the error
    }
  };

  const handleCancelCue = () => {
    setIsCueDrawerOpen(false);
    setEditingCue(null);
    setIsCopyMode(false);
  };

  // Prepare cue for CueBuilder (handles copy mode)
  // For copy mode, we need to modify the name and remove step IDs so they're treated as new steps
  const cueForBuilder = useMemo(() => {
    if (!editingCue) return undefined;

    if (isCopyMode) {
      // Create a copy of the cue with modified name and step IDs removed
      // The handleSaveCue will treat this as a new cue (not an update)
      // CueBuilder will map cueSteps and if id is undefined, it won't be included in save
      return {
        ...editingCue,
        name: `${editingCue.name} (Copy)`,
        cueSteps: editingCue.cueSteps.map(({ id, ...step }) => ({
          ...step,
          // Remove id so CueBuilder treats these as new steps
        })) as any,
      } as Cue;
    }

    return editingCue;
  }, [editingCue, isCopyMode]);

  const handleEmergencyBlackout = async () => {
    const connectedDevices = getConnectedDevices();

    if (connectedDevices.length === 0) {
      alert("No connected devices to turn off.");
      return;
    }

    setIsBlackoutDialogOpen(true);
  };

  const confirmBlackout = async () => {
    setIsBlackingOut(true);
    const connectedDevices = getConnectedDevices();

    try {
      // Turn off all connected devices in parallel
      await Promise.all(
        connectedDevices.map(async (device) => {
          try {
            await setState(device.ipAddress, { on: false });
          } catch (error) {
            console.error(
              `Failed to turn off device ${device.name} (${device.ipAddress}):`,
              error,
            );
            // Continue with other devices even if one fails
          }
        }),
      );

      // Refresh device states after blackout
      setTimeout(() => {
        refreshDeviceStates();
      }, 500);

      setIsBlackoutDialogOpen(false);
    } catch (error) {
      console.error("Error during emergency blackout:", error);
      // Keep dialog open on error so user can see what happened
      // The error is logged to console for debugging
    } finally {
      setIsBlackingOut(false);
    }
  };

  // Show loading or error state if show is not found
  if (!showsLoading && showId !== undefined && !currentShow) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Show not found. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white dark">
      {/* Header */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white"
                onClick={() => navigate("/shows", { state: { from: "/show" } })}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Shows
              </Button>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">
                    {currentShow?.name || "Loading..."}
                  </h1>
                  <p className="text-xs text-zinc-500">
                    Theatre Lighting System
                  </p>
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <nav className="flex items-center gap-1">
                <span className="text-white font-medium text-sm px-2">
                  Workspace
                </span>
                <span className="text-zinc-600 px-1">|</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-white"
                  onClick={() =>
                    showId && navigate(`/show/${showId}/cue-lists`)
                  }
                >
                  Cue Lists
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-white"
                  onClick={() => navigate("/busking")}
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Busking
                </Button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-zinc-500 mr-1">Running:</span>
                  <span className="text-white font-medium">
                    {runningCue && executionStatus?.isRunning
                      ? `${runningCue.name}${elapsedTime > 0 ? ` (${elapsedTime}s)` : ""}`
                      : "None"}
                  </span>
                </div>
                <div className="h-4 w-px bg-zinc-700" />
                <div>
                  <span className="text-zinc-500 mr-1">State:</span>
                  <span className="text-white font-medium">
                    {currentStateCue ? currentStateCue.name : "None"}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-900/50 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                onClick={handleEmergencyBlackout}
                disabled={connectedCount === 0 || isBlackingOut}
              >
                {isBlackingOut ? "..." : "Blackout"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Devices & DMX */}
          <div className="col-span-3 space-y-6">
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-6 pr-4">
                {/* Preset Colors (color + brightness) */}
                <Collapsible
                  open={presetColorsOpen}
                  onOpenChange={setPresetColorsOpen}
                  className="pt-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <CollapsibleTrigger className="flex items-center gap-2 text-left hover:text-white group cursor-pointer bg-transparent border-none p-0">
                      {presetColorsOpen ? (
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                      )}
                      <h2 className="text-lg font-semibold">Color Presets</h2>
                    </CollapsibleTrigger>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-800 text-zinc-400 hover:text-white"
                        onClick={openNewPresetModal}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="space-y-2">
                      {presetsError && (
                        <div className="text-center py-3 text-red-400 text-sm">
                          {presetsError}
                        </div>
                      )}
                      {presetsLoading ? (
                        <div className="text-center py-6 text-zinc-500 text-sm">
                          Loading presets...
                        </div>
                      ) : presets.length === 0 ? (
                        <div className="text-center py-6 text-zinc-500 text-sm">
                          No presets yet. Click + to create one.
                        </div>
                      ) : (
                        presets
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((preset) => {
                            const [r, g, b] = preset.color;
                            const hex = rgbToHex(r, g, b);
                            return (
                              <div
                                key={preset.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-8 h-8 rounded-md border border-zinc-700 flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: hex }}
                                    title={hex}
                                  >
                                    <Palette className="w-4 h-4 text-black/40" />
                                  </div>
                                  <div className="min-w-0">
                                    <p
                                      className="text-sm font-medium truncate"
                                      title={preset.name}
                                    >
                                      {preset.name}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                      {hex} · bri {preset.brightness}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                                    onClick={() => openEditPresetModal(preset)}
                                    title="Edit preset"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                                    onClick={() => deletePreset(preset)}
                                    title="Delete preset"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={wledOpen} onOpenChange={setWledOpen}>
                  <div className="flex items-center justify-between mb-4">
                    <CollapsibleTrigger className="flex items-center gap-2 text-left hover:text-white group cursor-pointer bg-transparent border-none p-0">
                      {wledOpen ? (
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                      )}
                      <h2 className="text-lg font-semibold">WLED Devices</h2>
                    </CollapsibleTrigger>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-zinc-500 hover:text-white"
                        onClick={() => navigate("/devices/wled")}
                        title="Manage WLED devices"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-800 text-zinc-400 hover:text-white"
                        onClick={handleAddDevice}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="space-y-3">
                      {isLoading ? (
                        <div className="text-center py-8 text-zinc-500 text-sm">
                          Loading devices...
                        </div>
                      ) : lightingDevices.length > 0 ? (
                        lightingDevices.map((device) => {
                          const fullDevice = devices.find(
                            (d) => d.id === device.deviceId,
                          );
                          return (
                            <LightingDevice
                              key={device.id}
                              {...device}
                              onEdit={
                                fullDevice
                                  ? () => handleEditDevice(fullDevice)
                                  : undefined
                              }
                              onStateChange={() => refreshDeviceStates()}
                            />
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-zinc-500 text-sm">
                          No devices configured. Click + to add a device.
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible
                  open={artnetOpen}
                  onOpenChange={setArtnetOpen}
                  className="pt-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <CollapsibleTrigger className="flex items-center gap-2 text-left hover:text-white group cursor-pointer bg-transparent border-none p-0">
                      {artnetOpen ? (
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                      )}
                      <h2 className="text-lg font-semibold">Art-Net Nodes</h2>
                    </CollapsibleTrigger>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-zinc-500 hover:text-white"
                        onClick={() => navigate("/devices/artnet")}
                        title="Manage Art-Net nodes"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-800 text-zinc-400 hover:text-white"
                        onClick={handleAddNode}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="space-y-2">
                      {nodes.length === 0 ? (
                        <div className="text-center py-6 text-zinc-500 text-sm">
                          No Art-Net nodes. Click + to add.
                        </div>
                      ) : (
                        nodes.map((node) => (
                          <div
                            key={node.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-md bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                                <Network className="w-4 h-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {node.name}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  {node.ipAddress} (S{node.subnet}/U
                                  {node.universe})
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-zinc-400 hover:text-white"
                              onClick={() => handleEditNode(node)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible
                  open={dmxOpen}
                  onOpenChange={setDmxOpen}
                  className="pt-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <CollapsibleTrigger className="flex items-center gap-2 text-left hover:text-white group cursor-pointer bg-transparent border-none p-0">
                      {dmxOpen ? (
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                      )}
                      <h2 className="text-lg font-semibold">DMX Fixtures</h2>
                    </CollapsibleTrigger>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-zinc-500 hover:text-white"
                        onClick={() => navigate("/devices/dmx")}
                        title="Manage DMX fixtures"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-800 text-zinc-400 hover:text-white"
                        onClick={handleAddFixture}
                        disabled={nodes.length === 0}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="space-y-2">
                      {fixtures.length === 0 ? (
                        <div className="text-center py-6 text-zinc-500 text-sm">
                          {nodes.length === 0
                            ? "Add an Art-Net node first."
                            : "No fixtures. Click + to add."}
                        </div>
                      ) : (
                        fixtures.map((fixture) => (
                          <div
                            key={fixture.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-md bg-amber-600/20 flex items-center justify-center flex-shrink-0">
                                <Aperture className="w-4 h-4 text-amber-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {fixture.name}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  Ch {fixture.startAddress}+
                                  {fixture.channelCount}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-zinc-400 hover:text-white"
                              onClick={() => handleEditFixture(fixture)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>
          </div>

          {/* Device Modal */}
          <DeviceModal
            device={editingDevice}
            isOpen={isDeviceModalOpen}
            onClose={handleCloseDeviceModal}
            onSave={handleDeviceSave}
            onDelete={handleDeviceDelete}
          />
          <ArtNetNodeModal
            node={editingNode}
            isOpen={isNodeModalOpen}
            onClose={handleCloseNodeModal}
            onSave={refreshNodes}
            onDelete={refreshNodes}
          />
          <DmxFixtureModal
            fixture={editingFixture}
            nodes={nodes}
            isOpen={isFixtureModalOpen}
            onClose={handleCloseFixtureModal}
            onSave={refreshFixtures}
            onDelete={refreshFixtures}
          />

          {/* Center Panel - Controls */}
          <div className="col-span-9 space-y-6">
            <Tabs defaultValue="cues" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
                <TabsTrigger value="cues">Cues</TabsTrigger>
                <TabsTrigger value="effects">Effects</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
              </TabsList>
              <TabsContent value="cues" className="mt-4 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-zinc-400">
                    {cueRows.length} cues available
                  </p>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleNewCue}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Cue
                  </Button>
                </div>
                {isLoading ? (
                  <div className="text-center py-12 text-zinc-500">
                    Loading cues...
                  </div>
                ) : cueRows.length > 0 ? (
                  <CueTable
                    rows={cueRows}
                    onPlay={async (id) => {
                      try {
                        await executeCue(id);
                        setTimeout(() => {
                          refreshDeviceStates();
                        }, 500);
                      } catch (err) {
                        console.error("Failed to execute cue:", err);
                      }
                    }}
                    onEdit={handleEditCue}
                    onCopy={handleCopyCue}
                    onDelete={handleDeleteCueClick}
                  />
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    No cues available. Create a new cue to get started.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="effects" className="mt-4">
                <div className="text-center py-12 text-zinc-500">
                  <p>Effects panel - Coming soon</p>
                </div>
              </TabsContent>
              <TabsContent value="groups" className="mt-4">
                <div className="text-center py-12 text-zinc-500">
                  <p>Groups panel - Coming soon</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Emergency Blackout Confirmation Dialog */}
          <AlertDialog
            open={isBlackoutDialogOpen}
            onOpenChange={setIsBlackoutDialogOpen}
          >
            <AlertDialogContent className="bg-zinc-900 border-zinc-800">
              <AlertDialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <AlertDialogTitle className="text-white">
                      Emergency Blackout
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400 mt-1">
                      This will immediately power off all {connectedCount}{" "}
                      connected lighting device{connectedCount !== 1 ? "s" : ""}
                      .
                    </AlertDialogDescription>
                  </div>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel
                  disabled={isBlackingOut}
                  className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmBlackout}
                  disabled={isBlackingOut}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isBlackingOut ? "Turning Off..." : "Turn Off All Devices"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Cue Confirmation Dialog */}
          <AlertDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <AlertDialogContent className="bg-zinc-900 border-zinc-800">
              <AlertDialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <AlertDialogTitle className="text-white">
                      Delete Cue
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400 mt-1">
                      {deleteCueId !== null && (
                        <>
                          Are you sure you want to delete "
                          {cues.find((c) => c.id === deleteCueId)?.name ||
                            "this cue"}
                          "? This action cannot be undone.
                        </>
                      )}
                    </AlertDialogDescription>
                  </div>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel
                  onClick={() => {
                    setIsDeleteDialogOpen(false);
                    setDeleteCueId(null);
                  }}
                  className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteCue}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Cue Drawer */}
      <Sheet open={isCueDrawerOpen} onOpenChange={setIsCueDrawerOpen}>
        <SheetContent
          side="right"
          className="w-screen max-w-none sm:max-w-none bg-zinc-900 border-zinc-800 p-0 flex flex-col"
          style={{
            height: "100vh",
            maxHeight: "100vh",
            minHeight: "100vh",
            top: 0,
            bottom: 0,
          }}
        >
          <ScrollArea
            className="flex-1 min-h-0"
            style={{
              height: "100%",
              flex: "1 1 0%",
            }}
          >
            <div className="p-6">
              <CueBuilder
                cue={cueForBuilder}
                showId={currentShow?.id}
                onSave={handleSaveCue}
                onCancel={handleCancelCue}
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Preset modal */}
      <Dialog open={presetModalOpen} onOpenChange={setPresetModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingPreset ? "Edit preset" : "New preset"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-zinc-300">Name</Label>
              <Input
                value={presetForm.name}
                onChange={(e) =>
                  setPresetForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Warm Wash"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-zinc-300">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={presetForm.colorHex}
                    onChange={(e) =>
                      setPresetForm((p) => ({ ...p, colorHex: e.target.value }))
                    }
                    className="h-10 w-14 p-1 bg-zinc-800 border-zinc-700"
                  />
                  <Input
                    value={presetForm.colorHex.toUpperCase()}
                    onChange={(e) =>
                      setPresetForm((p) => ({ ...p, colorHex: e.target.value }))
                    }
                    className="bg-zinc-800 border-zinc-700 text-white font-mono"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-zinc-300">Brightness (1-255)</Label>
                <Input
                  type="number"
                  min={1}
                  max={255}
                  value={presetForm.brightness}
                  onChange={(e) =>
                    setPresetForm((p) => ({
                      ...p,
                      brightness: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              className="border-zinc-700"
              onClick={() => setPresetModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={savePreset}
              disabled={!presetForm.name.trim()}
            >
              {editingPreset ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
