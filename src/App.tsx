import { useState } from "react";
import { useWLED } from "./hooks/useWLED";
import { IPConfig } from "./components/IPConfig";
import { PowerToggle } from "./components/PowerToggle";
import { ColorPicker } from "./components/ColorPicker";
import { BrightnessSlider } from "./components/BrightnessSlider";
import { PaletteSelector } from "./components/PaletteSelector";
import { PresetSelector } from "./components/PresetSelector";
import { CustomPresets } from "./components/CustomPresets";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { MigrationPrompt } from "./components/MigrationPrompt";
import { MultiDeviceManager } from "./components/MultiDeviceManager";
import { CueList as CueListComponent } from "./components/CueList";
import { CueBuilder } from "./components/CueBuilder";
import { CueExecutor } from "./components/CueExecutor";
import { CueLists } from "./components/CueLists";
import { CueListBuilder } from "./components/CueListBuilder";
import { Shows } from "./components/Shows";
import { ShowBuilder } from "./components/ShowBuilder";
import { Sidebar } from "./components/Sidebar";
import { useCues } from "./hooks/useCues";
import { useCueLists } from "./hooks/useCueLists";
import { useShows } from "./hooks/useShows";
import type { WLEDColor } from "./types/wled";
import type { Cue, CreateCueRequest, UpdateCueRequest } from "./api/backendClient";
import type { CueList, CreateCueListRequest, UpdateCueListRequest } from "./api/backendClient";
import type { Show, CreateShowRequest, UpdateShowRequest } from "./api/backendClient";

type ViewMode = "control" | "devices" | "cues" | "cue-builder" | "cue-lists" | "cue-list-builder" | "shows" | "show-builder";

function App() {
  const {
    power,
    color,
    brightness,
    connectionStatus,
    deviceInfo,
    error,
    ip,
    palettes,
    currentPalette,
    currentPreset,
    togglePower,
    setColor,
    setBrightness,
    setPalette,
    setPreset,
    connect,
    refresh,
  } = useWLED();

  const { cues, createCue, updateCue, executionStatus, executeCue } = useCues();
  const { cueLists, createCueList, updateCueList } = useCueLists();
  const { shows, createShow, updateShow } = useShows();
  const [viewMode, setViewMode] = useState<ViewMode>("control");
  const [editingCue, setEditingCue] = useState<Cue | null>(null);
  const [editingCueList, setEditingCueList] = useState<CueList | null>(null);
  const [editingShow, setEditingShow] = useState<Show | null>(null);
  const [executingCueId, setExecutingCueId] = useState<number | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const handleIPChange = (newIP: string) => {
    connect(newIP);
  };

  const handleApplyPreset = async (presetColor: WLEDColor, presetBrightness: number) => {
    // Apply color and brightness from preset
    await Promise.all([
      setColor(presetColor),
      setBrightness(presetBrightness),
    ]);
  };

  const handleCreateCue = async () => {
    setEditingCue(null);
    setViewMode("cue-builder");
  };

  const handleEditCue = (cueId: number) => {
    const cue = cues.find((c) => c.id === cueId);
    if (cue) {
      setEditingCue(cue);
      setViewMode("cue-builder");
    }
  };

  const handleSaveCue = async (cueData: CreateCueRequest | UpdateCueRequest) => {
    if (editingCue) {
      await updateCue(editingCue.id, cueData as UpdateCueRequest);
    } else {
      // For creation, ensure required fields are present
      if ('name' in cueData && cueData.name) {
        await createCue(cueData as CreateCueRequest);
      } else {
        throw new Error("Cue name is required");
      }
    }
    setEditingCue(null);
    setViewMode("cues");
  };

  const handleCancelCue = () => {
    setEditingCue(null);
    setViewMode("cues");
  };

  const handleExecuteCue = async (cueId: number) => {
    try {
      setExecutingCueId(cueId);
      await executeCue(cueId); // Actually execute the cue
    } catch (error) {
      console.error("Failed to execute cue:", error);
    }
  };

  const handleCreateCueList = async () => {
    setEditingCueList(null);
    setViewMode("cue-list-builder");
  };

  const handleEditCueList = (cueListId: number) => {
    const cueList = cueLists.find((cl) => cl.id === cueListId);
    if (cueList) {
      setEditingCueList(cueList);
      setViewMode("cue-list-builder");
    }
  };

  const handleSaveCueList = async (cueListData: CreateCueListRequest | UpdateCueListRequest) => {
    if (editingCueList) {
      await updateCueList(editingCueList.id, cueListData as UpdateCueListRequest);
    } else {
      // For creation, ensure required fields are present
      if ('name' in cueListData && cueListData.name) {
        await createCueList(cueListData as CreateCueListRequest);
      } else {
        throw new Error("Cue list name is required");
      }
    }
    setEditingCueList(null);
    setViewMode("cue-lists");
  };

  const handleCancelCueList = () => {
    setEditingCueList(null);
    setViewMode("cue-lists");
  };

  const handleCreateShow = async () => {
    setEditingShow(null);
    setViewMode("show-builder");
  };

  const handleEditShow = (showId: number) => {
    const show = shows.find((s) => s.id === showId);
    if (show) {
      setEditingShow(show);
      setViewMode("show-builder");
    }
  };

  const handleSaveShow = async (showData: CreateShowRequest | UpdateShowRequest) => {
    if (editingShow) {
      await updateShow(editingShow.id, showData as UpdateShowRequest);
    } else {
      // For creation, ensure required fields are present
      if ('name' in showData && showData.name) {
        await createShow(showData as CreateShowRequest);
      } else {
        throw new Error("Show name is required");
      }
    }
    setEditingShow(null);
    setViewMode("shows");
  };

  const handleCancelShow = () => {
    setEditingShow(null);
    setViewMode("shows");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <MigrationPrompt />
      <Sidebar 
        viewMode={viewMode} 
        onViewModeChange={setViewMode}
        onExpandedChange={setSidebarExpanded}
      />
      <div className={`min-h-screen transition-all duration-300 ${sidebarExpanded ? "md:ml-64" : "md:ml-16"}`}>
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-center mb-2">WLED Theatre Controller</h1>
            <p className="text-center text-gray-400">
              Control your programmable LED strips for theatre shows
            </p>
          </header>

        {/* Execution Status */}
        {executionStatus?.isRunning && (
          <div className="mb-8">
            <CueExecutor cueId={executingCueId || executionStatus.cueId} />
          </div>
        )}

        {/* View Content */}
        {viewMode === "control" && (
          <>
            {/* IP Configuration */}
            <div className="mb-8">
              <IPConfig onIPChange={handleIPChange} currentIP={ip} />
            </div>

            {/* Main Control Area */}
            {connectionStatus === "connected" && (
              <div className="mb-8 space-y-8">
                {/* Power Toggle */}
                <div className="flex justify-center">
                  <PowerToggle
                    power={power}
                    onToggle={togglePower}
                    disabled={connectionStatus !== "connected"}
                  />
                </div>

                {/* Color Picker */}
                <div className="flex justify-center">
                  <ColorPicker
                    color={color}
                    onColorChange={setColor}
                    disabled={connectionStatus !== "connected"}
                  />
                </div>

                {/* Brightness Slider */}
                <div className="flex justify-center">
                  <BrightnessSlider
                    brightness={brightness}
                    onBrightnessChange={setBrightness}
                    disabled={connectionStatus !== "connected"}
                  />
                </div>

                {/* Custom Presets */}
                <div className="flex justify-center">
                  <CustomPresets
                    color={color}
                    brightness={brightness}
                    onApplyPreset={handleApplyPreset}
                    disabled={connectionStatus !== "connected"}
                  />
                </div>

                {/* Palette Selector */}
                <div className="flex justify-center">
                  <PaletteSelector
                    palettes={palettes}
                    currentPalette={currentPalette}
                    onPaletteChange={setPalette}
                    disabled={connectionStatus !== "connected"}
                  />
                </div>

                {/* Preset Selector */}
                <div className="flex justify-center">
                  <PresetSelector
                    currentPreset={currentPreset}
                    onPresetChange={setPreset}
                    disabled={connectionStatus !== "connected"}
                  />
                </div>
              </div>
            )}

            {/* Connection Status */}
            <div className="mt-8">
              <ConnectionStatus
                status={connectionStatus}
                deviceInfo={deviceInfo}
                error={error}
                onRefresh={refresh}
              />
            </div>
          </>
        )}

        {viewMode === "devices" && (
          <div className="mb-8">
            <MultiDeviceManager />
          </div>
        )}

        {viewMode === "cues" && (
          <div className="mb-8">
            <div className="mb-6">
              <button
                onClick={handleCreateCue}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
              >
                Create New Cue
              </button>
            </div>
            <CueListComponent onEdit={handleEditCue} onExecute={handleExecuteCue} />
          </div>
        )}

        {viewMode === "cue-builder" && (
          <div className="mb-8">
            <CueBuilder
              cue={editingCue || undefined}
              onSave={handleSaveCue}
              onCancel={handleCancelCue}
            />
          </div>
        )}

        {viewMode === "cue-lists" && (
          <div className="mb-8">
            <div className="mb-6">
              <button
                onClick={handleCreateCueList}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
              >
                Create New Cue List
              </button>
            </div>
            <CueLists onEdit={handleEditCueList} />
          </div>
        )}

        {viewMode === "cue-list-builder" && (
          <div className="mb-8">
            <CueListBuilder
              cueList={editingCueList || undefined}
              onSave={handleSaveCueList}
              onCancel={handleCancelCueList}
            />
          </div>
        )}

        {viewMode === "shows" && (
          <div className="mb-8">
            <div className="mb-6">
              <button
                onClick={handleCreateShow}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
              >
                Create New Show
              </button>
            </div>
            <Shows onEdit={handleEditShow} />
          </div>
        )}

        {viewMode === "show-builder" && (
          <div className="mb-8">
            <ShowBuilder
              show={editingShow || undefined}
              onSave={handleSaveShow}
              onCancel={handleCancelShow}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default App;
