import { useState } from "react";
import { Box, Container, Heading, Text, VStack, Flex, Button } from "@chakra-ui/react";
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

  const handleTestCue = async (cueData: CreateCueRequest | UpdateCueRequest) => {
    // Validate required fields
    if (!('name' in cueData) || !cueData.name?.trim()) {
      throw new Error("Cue name is required");
    }

    let cueId: number;
    
    // Save or update the cue first (execution requires a saved cue)
    if (editingCue) {
      const updatedCue = await updateCue(editingCue.id, cueData as UpdateCueRequest);
      cueId = updatedCue.id;
      // Update the editing cue state with the latest data
      setEditingCue(updatedCue);
    } else {
      // For creation, ensure required fields are present
      if ('name' in cueData && cueData.name) {
        const newCue = await createCue(cueData as CreateCueRequest);
        cueId = newCue.id;
        // Set the newly created cue as editing so we can test it
        setEditingCue(newCue);
      } else {
        throw new Error("Cue name is required");
      }
    }

    // Execute the cue
    await handleExecuteCue(cueId);
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
    <Box minH="100vh" bg="gray.900" color="white">
      <MigrationPrompt />
      <Sidebar 
        viewMode={viewMode} 
        onViewModeChange={setViewMode}
        onExpandedChange={setSidebarExpanded}
      />
      <Box
        minH="100vh"
        transition="all 0.3s"
        ml={{ base: 0, md: sidebarExpanded ? "256px" : "64px" }}
      >
        <Container maxW="container.xl" px={4} py={8}>
          {/* Header */}
          <Box as="header" mb={8}>
            <Heading as="h1" size="2xl" textAlign="center" mb={2}>
              WLED Theatre Controller
            </Heading>
            <Text textAlign="center" color="gray.400">
              Control your programmable LED strips for theatre shows
            </Text>
          </Box>

          {/* Execution Status */}
          {executionStatus?.isRunning && (
            <Box mb={8}>
              <CueExecutor cueId={executingCueId || executionStatus.cueId} />
            </Box>
          )}

          {/* View Content */}
          {viewMode === "control" && (
            <>
              {/* IP Configuration */}
              <Box mb={8}>
                <IPConfig onIPChange={handleIPChange} currentIP={ip} />
              </Box>

              {/* Main Control Area */}
              {connectionStatus === "connected" && (
                <VStack gap={8} mb={8}>
                  {/* Power Toggle */}
                  <Flex justify="center">
                    <PowerToggle
                      power={power}
                      onToggle={togglePower}
                      disabled={connectionStatus !== "connected"}
                    />
                  </Flex>

                  {/* Color Picker */}
                  <Flex justify="center">
                    <ColorPicker
                      color={color}
                      onColorChange={setColor}
                      disabled={connectionStatus !== "connected"}
                    />
                  </Flex>

                  {/* Brightness Slider */}
                  <Flex justify="center">
                    <BrightnessSlider
                      brightness={brightness}
                      onBrightnessChange={setBrightness}
                      disabled={connectionStatus !== "connected"}
                    />
                  </Flex>

                  {/* Custom Presets */}
                  <Flex justify="center">
                    <CustomPresets
                      color={color}
                      brightness={brightness}
                      onApplyPreset={handleApplyPreset}
                      disabled={connectionStatus !== "connected"}
                    />
                  </Flex>

                  {/* Palette Selector */}
                  <Flex justify="center">
                    <PaletteSelector
                      palettes={palettes}
                      currentPalette={currentPalette}
                      onPaletteChange={setPalette}
                      disabled={connectionStatus !== "connected"}
                    />
                  </Flex>

                  {/* Preset Selector */}
                  <Flex justify="center">
                    <PresetSelector
                      currentPreset={currentPreset}
                      onPresetChange={setPreset}
                      disabled={connectionStatus !== "connected"}
                    />
                  </Flex>
                </VStack>
              )}

              {/* Connection Status */}
              <Box mt={8}>
                <ConnectionStatus
                  status={connectionStatus}
                  deviceInfo={deviceInfo}
                  error={error}
                  onRefresh={refresh}
                />
              </Box>
            </>
          )}

          {viewMode === "devices" && (
            <Box mb={8}>
              <MultiDeviceManager />
            </Box>
          )}

          {viewMode === "cues" && (
            <Box mb={8}>
              <Box mb={6}>
                <Button colorScheme="green" onClick={handleCreateCue}>
                  Create New Cue
                </Button>
              </Box>
              <CueListComponent onEdit={handleEditCue} onExecute={handleExecuteCue} />
            </Box>
          )}

          {viewMode === "cue-builder" && (
            <Box mb={8}>
              <CueBuilder
                cue={editingCue || undefined}
                onSave={handleSaveCue}
                onCancel={handleCancelCue}
                onTest={handleTestCue}
              />
            </Box>
          )}

          {viewMode === "cue-lists" && (
            <Box mb={8}>
              <Box mb={6}>
                <Button colorScheme="green" onClick={handleCreateCueList}>
                  Create New Cue List
                </Button>
              </Box>
              <CueLists onEdit={handleEditCueList} />
            </Box>
          )}

          {viewMode === "cue-list-builder" && (
            <Box mb={8}>
              <CueListBuilder
                cueList={editingCueList || undefined}
                onSave={handleSaveCueList}
                onCancel={handleCancelCueList}
              />
            </Box>
          )}

          {viewMode === "shows" && (
            <Box mb={8}>
              <Box mb={6}>
                <Button colorScheme="green" onClick={handleCreateShow}>
                  Create New Show
                </Button>
              </Box>
              <Shows onEdit={handleEditShow} />
            </Box>
          )}

          {viewMode === "show-builder" && (
            <Box mb={8}>
              <ShowBuilder
                show={editingShow || undefined}
                onSave={handleSaveShow}
                onCancel={handleCancelShow}
              />
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  );
}

export default App;
