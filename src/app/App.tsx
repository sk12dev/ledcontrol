import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Plus, Settings, Save, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
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
import { CueCard } from "@/app/components/CueCard";
import { Timeline } from "@/app/components/Timeline";
import { DeviceModal } from "@/app/components/DeviceModal";
import { useCues } from "@/hooks/useCues";
import { useMultiDevice } from "@/hooks/useMultiDevice";
import { useShows } from "@/hooks/useShows";
import { useCueLists } from "@/hooks/useCueLists";
import { type Device, type Cue, type CreateCueRequest, type UpdateCueRequest } from "@/api/backendClient";
import { setState } from "@/api/wledClient";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { CueBuilder } from "@/components/CueBuilder";

export default function App() {
  const [showName, setShowName] = useState("Untitled Show");
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isBlackoutDialogOpen, setIsBlackoutDialogOpen] = useState(false);
  const [isBlackingOut, setIsBlackingOut] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastExecutedCueId, setLastExecutedCueId] = useState<number | null>(null);
  
  // Cue drawer state
  const [isCueDrawerOpen, setIsCueDrawerOpen] = useState(false);
  const [editingCue, setEditingCue] = useState<Cue | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [deleteCueId, setDeleteCueId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Use real hooks instead of mock data
  const { cues, loading: cuesLoading, executeCue, deleteCue, createCue, updateCue, executionStatus } = useCues();
  const { 
    devices, 
    getDeviceConnectionStatus, 
    getDeviceState,
    getConnectedDevices, 
    loading: devicesLoading, 
    refreshDevices,
    refreshDeviceStates
  } = useMultiDevice();
  const { shows, loading: showsLoading } = useShows();
  const { cueLists, loading: cueListsLoading } = useCueLists();

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
        deviceColor = `#${[r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        }).join("")}`;
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

  // Convert cues to CueCard format
  const cueCards = useMemo(() => {
    return cues.map((cue) => {
      // Extract preview colors from cue steps
      const previewColors: string[] = [];
      if (cue.cueSteps && cue.cueSteps.length > 0) {
        cue.cueSteps.forEach((step) => {
          if (step.targetColor) {
            const [r, g, b] = step.targetColor;
            const hex = `#${[r, g, b].map(x => {
              const hex = x.toString(16);
              return hex.length === 1 ? "0" + hex : hex;
            }).join("")}`;
            if (!previewColors.includes(hex)) {
              previewColors.push(hex);
            }
          }
        });
      }
      
      // Calculate total duration from steps
      const duration = cue.cueSteps && cue.cueSteps.length > 0
        ? Math.max(...cue.cueSteps.map(s => (s.timeOffset || 0) + (s.transitionDuration || 0)))
        : 0;
      
      // Count unique devices
      const deviceCount = cue.cueSteps && cue.cueSteps.length > 0
        ? new Set(cue.cueSteps.flatMap(s => s.cueStepDevices?.map(csd => csd.deviceId) || [])).size
        : 0;

      return {
        id: cue.id.toString(),
        name: cue.name,
        duration: Math.round(duration),
        deviceCount,
        previewColors: previewColors.length > 0 ? previewColors : ["#1a1a1a"],
      };
    });
  }, [cues]);

  // Convert cue lists or shows to timeline format
  const timelineCues = useMemo(() => {
    // If we have cue lists, use the first one to generate timeline
    if (cueLists.length > 0) {
      const firstCueList = cueLists[0];
      // Cue lists have cues in order - convert them to timeline format
      // For now, use a simple sequential layout (could be enhanced with actual timing)
      let currentTime = 0;
      return firstCueList.cueListCues
        ?.sort((a, b) => a.order - b.order)
        .map((cueListItem) => {
          const cue = cues.find(c => c.id === cueListItem.cueId);
          if (!cue) return null;
          
          // Calculate duration from cue steps
          const duration = cue.cueSteps && cue.cueSteps.length > 0
            ? Math.max(...cue.cueSteps.map(s => Number(s.timeOffset) + Number(s.transitionDuration)))
            : 5; // Default 5 seconds
          
          // Use unique key combining cueListId, order, and cueId to avoid duplicates
          const timelineCue = {
            id: `${firstCueList.id}-${cueListItem.order}-${cue.id}`,
            name: cue.name,
            startTime: currentTime,
            duration: Math.max(duration, 1),
            color: "#4A6FA5", // Default color, could extract from cue steps
          };
          
          currentTime += timelineCue.duration;
          return timelineCue;
        })
        .filter((tc): tc is { id: string; name: string; startTime: number; duration: number; color: string } => tc !== null) || [];
    }
    
    // If no cue lists, use cues from the current show (if showName matches a show)
    const currentShow = shows.find(s => s.name === showName);
    if (currentShow && cues.length > 0) {
      const showCues = cues.filter(c => c.showId === currentShow.id);
      let currentTime = 0;
      return showCues.map((cue) => {
        const duration = cue.cueSteps && cue.cueSteps.length > 0
          ? Math.max(...cue.cueSteps.map(s => Number(s.timeOffset) + Number(s.transitionDuration)))
          : 5;
        
        const timelineCue = {
          id: cue.id.toString(),
          name: cue.name,
          startTime: currentTime,
          duration: Math.max(duration, 1),
          color: "#4A6FA5",
        };
        
        currentTime += timelineCue.duration;
        return timelineCue;
      });
    }
    
    // Fallback: use shows as timeline items
    return shows.map((show, idx) => ({
      id: show.id.toString(),
      name: show.name,
      startTime: idx * 30,
      duration: 30,
      color: "#4A6FA5",
    }));
  }, [cueLists, cues, shows, showName]);

  const totalDuration = timelineCues.length > 0
    ? Math.max(...timelineCues.map(tc => tc.startTime + tc.duration))
    : 180;

  const connectedDevices = getConnectedDevices();
  const connectedCount = connectedDevices.length;
  const totalDeviceCount = devices.length;
  const isLoading = cuesLoading || devicesLoading || showsLoading || cueListsLoading;

  // Find running cue name
  const runningCue = useMemo(() => {
    if (executionStatus?.isRunning && executionStatus?.cueId) {
      return cues.find(c => c.id === executionStatus.cueId);
    }
    return null;
  }, [executionStatus, cues]);

  // Find last executed cue (current state)
  const currentStateCue = useMemo(() => {
    if (lastExecutedCueId) {
      return cues.find(c => c.id === lastExecutedCueId);
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
      const elapsed = Math.floor((Date.now() - executionStatus.startTime!) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    // Update immediately
    setElapsedTime(Math.floor((Date.now() - executionStatus.startTime) / 1000));

    return () => clearInterval(interval);
  }, [executionStatus?.isRunning, executionStatus?.startTime]);

  // Track last executed cue when execution finishes
  const prevExecutionStatus = useRef<{ isRunning: boolean; cueId: number | null } | null>(null);
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

  // Cue drawer handlers
  const handleNewCue = () => {
    setEditingCue(null);
    setIsCopyMode(false);
    setIsCueDrawerOpen(true);
  };

  const handleEditCue = (cueId: number) => {
    const cue = cues.find(c => c.id === cueId);
    if (cue) {
      setEditingCue(cue);
      setIsCopyMode(false);
      setIsCueDrawerOpen(true);
    }
  };

  const handleCopyCue = (cueId: number) => {
    const cue = cues.find(c => c.id === cueId);
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

  const handleSaveCue = async (cueData: CreateCueRequest | UpdateCueRequest) => {
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

  // Get current show ID for new cues
  const currentShow = useMemo(() => {
    return shows.find(s => s.name === showName);
  }, [shows, showName]);

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
            console.error(`Failed to turn off device ${device.name} (${device.ipAddress}):`, error);
            // Continue with other devices even if one fails
          }
        })
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white dark">
      {/* Header */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">LightControl Pro</h1>
                  <p className="text-xs text-zinc-500">Theatre Lighting System</p>
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <Input 
                value={showName}
                onChange={(e) => setShowName(e.target.value)}
                className="w-72 bg-zinc-900 border-zinc-800 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Save className="w-4 h-4 mr-2" />
                Save Show
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Devices */}
          <div className="col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Lighting Devices</h2>
              <Button 
                size="sm" 
                variant="outline" 
                className="border-zinc-800 text-zinc-400 hover:text-white"
                onClick={handleAddDevice}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-zinc-500 text-sm">Loading devices...</div>
              ) : lightingDevices.length > 0 ? (
                lightingDevices.map((device) => {
                  const fullDevice = devices.find(d => d.id === device.deviceId);
                  return (
                    <LightingDevice 
                      key={device.id} 
                      {...device}
                      onEdit={fullDevice ? () => handleEditDevice(fullDevice) : undefined}
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
          </div>

          {/* Device Modal */}
          <DeviceModal
            device={editingDevice}
            isOpen={isDeviceModalOpen}
            onClose={handleCloseDeviceModal}
            onSave={handleDeviceSave}
            onDelete={handleDeviceDelete}
          />

          {/* Center Panel - Timeline & Controls */}
          <div className="col-span-6 space-y-6">
            <Timeline cues={timelineCues} totalDuration={totalDuration} />
            
            <Tabs defaultValue="cues" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
                <TabsTrigger value="cues">Cues</TabsTrigger>
                <TabsTrigger value="effects">Effects</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
              </TabsList>
              <TabsContent value="cues" className="mt-4 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-zinc-400">{cueCards.length} cues available</p>
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
                  <div className="text-center py-12 text-zinc-500">Loading cues...</div>
                ) : cueCards.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {cueCards.map((cue) => (
                      <CueCard 
                        key={cue.id} 
                        {...cue}
                        onPlay={async () => {
                          try {
                            await executeCue(parseInt(cue.id));
                            // Refresh device states after cue execution
                            // Wait a bit for the cue to start executing
                            setTimeout(() => {
                              refreshDeviceStates();
                            }, 500);
                          } catch (err) {
                            console.error("Failed to execute cue:", err);
                          }
                        }}
                        onEdit={() => handleEditCue(parseInt(cue.id))}
                        onCopy={() => handleCopyCue(parseInt(cue.id))}
                        onDelete={() => handleDeleteCueClick(parseInt(cue.id))}
                      />
                    ))}
                  </div>
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

          {/* Right Panel - Properties */}
          <div className="col-span-3">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 backdrop-blur-sm">
              <h2 className="text-lg font-semibold mb-4">Quick Controls</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Master Brightness</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      defaultValue="100"
                      className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer 
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                               [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-500 
                               [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <span className="text-sm text-zinc-400 w-12 text-right">100%</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <h3 className="text-sm font-medium mb-3">Running Cue</h3>
                  <div className="bg-zinc-950/50 rounded-lg p-3 border border-zinc-800">
                    {runningCue && executionStatus?.isRunning ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">{runningCue.name}</span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {elapsedTime}s elapsed
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">No running cue</span>
                        </div>
                        <p className="text-xs text-zinc-400">Select a cue to activate</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <h3 className="text-sm font-medium mb-3">Current State</h3>
                  <div className="bg-zinc-950/50 rounded-lg p-3 border border-zinc-800">
                    {currentStateCue ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">{currentStateCue.name}</span>
                        </div>
                        <p className="text-xs text-zinc-400">Last executed cue</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">No state set</span>
                        </div>
                        <p className="text-xs text-zinc-400">Execute a cue to set state</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <h3 className="text-sm font-medium mb-3">System Status</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Connected Devices</span>
                      <span className={connectedCount === totalDeviceCount && totalDeviceCount > 0 ? "text-emerald-400" : "text-yellow-400"}>
                        {connectedCount} / {totalDeviceCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">DMX Universe</span>
                      <span className="text-white">Universe 1</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Frame Rate</span>
                      <span className="text-white">44 FPS</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Status</span>
                      <span className={`flex items-center gap-1 ${connectedCount > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
                        <div className={`w-2 h-2 rounded-full ${connectedCount > 0 ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"}`} />
                        {connectedCount > 0 ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={handleEmergencyBlackout}
                    disabled={connectedCount === 0 || isBlackingOut}
                  >
                    {isBlackingOut ? "Turning Off..." : "Emergency Blackout"}
                  </Button>
                </div>

                {/* Emergency Blackout Confirmation Dialog */}
                <AlertDialog open={isBlackoutDialogOpen} onOpenChange={setIsBlackoutDialogOpen}>
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
                            This will immediately power off all {connectedCount} connected lighting device{connectedCount !== 1 ? 's' : ''}.
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
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
                              <>Are you sure you want to delete "{cues.find(c => c.id === deleteCueId)?.name || 'this cue'}"? This action cannot be undone.</>
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
          </div>
        </div>
      </div>

      {/* Cue Drawer */}
      <Sheet open={isCueDrawerOpen} onOpenChange={setIsCueDrawerOpen}>
        <SheetContent 
          side="right" 
          className="w-[50vw] min-w-[50vw] max-w-[50vw] sm:w-[50vw] sm:min-w-[50vw] sm:max-w-[50vw] bg-zinc-900 border-zinc-800 p-0 flex flex-col"
          style={{ 
            height: '100vh',
            maxHeight: '100vh',
            minHeight: '100vh',
            top: 0,
            bottom: 0
          }}
        >
          <ScrollArea 
            className="flex-1 min-h-0" 
            style={{ 
              height: '100%',
              flex: '1 1 0%'
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
    </div>
  );
}
