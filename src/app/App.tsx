import { useState, useMemo } from "react";
import { Plus, Settings, Save, Zap } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { LightingDevice } from "@/app/components/LightingDevice";
import { CueCard } from "@/app/components/CueCard";
import { Timeline } from "@/app/components/Timeline";
import { useCues } from "@/hooks/useCues";
import { useMultiDevice } from "@/hooks/useMultiDevice";
import { useShows } from "@/hooks/useShows";
import { useCueLists } from "@/hooks/useCueLists";

export default function App() {
  const [showName, setShowName] = useState("Untitled Show");
  
  // Use real hooks instead of mock data
  const { cues, loading: cuesLoading, executeCue, deleteCue, createCue } = useCues();
  const { devices, getDeviceConnectionStatus, getConnectedDevices, loading: devicesLoading } = useMultiDevice();
  const { shows, loading: showsLoading } = useShows();
  const { cueLists, loading: cueListsLoading } = useCueLists();

  // Convert devices to LightingDevice format
  const lightingDevices = useMemo(() => {
    return devices.map((device) => {
      const status = getDeviceConnectionStatus(device.id);
      const isConnected = status?.isConnected ?? false;
      // Get color from device state if available, otherwise default
      const deviceColor = "#FF6B35"; // Default color, could be enhanced
      const deviceIntensity = 80; // Default intensity, could be enhanced
      
      return {
        id: device.id.toString(),
        deviceId: device.id,
        ipAddress: device.ipAddress,
        name: device.name,
        type: "WLED Device", // Could be enhanced with device type
        intensity: deviceIntensity,
        color: deviceColor,
        isActive: isConnected,
      };
    });
  }, [devices, getDeviceConnectionStatus]);

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
        .map((cueListItem, idx) => {
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
              <Button size="sm" variant="outline" className="border-zinc-800 text-zinc-400 hover:text-white">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-zinc-500 text-sm">Loading devices...</div>
              ) : lightingDevices.length > 0 ? (
                lightingDevices.map((device) => (
                  <LightingDevice key={device.id} {...device} />
                ))
              ) : (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  No devices configured. Click + to add a device.
                </div>
              )}
            </div>
          </div>

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
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
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
                        onPlay={() => executeCue(parseInt(cue.id)).catch(err => console.error("Failed to execute cue:", err))}
                        onEdit={() => {
                          // TODO: Open cue editor
                          console.log("Edit cue:", cue.id);
                        }}
                        onCopy={() => {
                          // TODO: Copy cue
                          console.log("Copy cue:", cue.id);
                        }}
                        onDelete={() => {
                          if (confirm(`Are you sure you want to delete "${cue.name}"?`)) {
                            deleteCue(parseInt(cue.id)).catch(err => console.error("Failed to delete cue:", err));
                          }
                        }}
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
                  <h3 className="text-sm font-medium mb-3">Active Cue</h3>
                  <div className="bg-zinc-950/50 rounded-lg p-3 border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">No active cue</span>
                    </div>
                    <p className="text-xs text-zinc-400">Select a cue to activate</p>
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
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    Emergency Blackout
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
