import { useState } from "react";
import { Plus, Settings, Save, Zap } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { LightingDevice } from "@/app/components/LightingDevice";
import { CueCard } from "@/app/components/CueCard";
import { Timeline } from "@/app/components/Timeline";

export default function App() {
  const [showName, setShowName] = useState("Romeo & Juliet - Act 2");

  // Mock data for devices
  const devices = [
    { id: "1", name: "Front Wash L", type: "LED Par", intensity: 80, color: "#FF6B35", isActive: true },
    { id: "2", name: "Front Wash R", type: "LED Par", intensity: 80, color: "#FF6B35", isActive: true },
    { id: "3", name: "Backlight 1", type: "Moving Head", intensity: 65, color: "#4ECDC4", isActive: true },
    { id: "4", name: "Backlight 2", type: "Moving Head", intensity: 65, color: "#4ECDC4", isActive: true },
    { id: "5", name: "Side Spot L", type: "Profile", intensity: 90, color: "#FFE66D", isActive: false },
    { id: "6", name: "Side Spot R", type: "Profile", intensity: 90, color: "#FFE66D", isActive: false },
  ];

  // Mock data for cues
  const cues = [
    { id: "1", name: "House Lights Down", duration: 3, deviceCount: 12, previewColors: ["#1a1a1a", "#000000", "#0a0a0a"] },
    { id: "2", name: "Stage Wash - Warm", duration: 2, deviceCount: 8, previewColors: ["#FF6B35", "#FFB347", "#FF8C42"] },
    { id: "3", name: "Moonlight Scene", duration: 5, deviceCount: 6, previewColors: ["#4A6FA5", "#6B8CAE", "#91B8D1"] },
    { id: "4", name: "Spotlight Center", duration: 1, deviceCount: 2, previewColors: ["#FFE66D", "#FFFFFF"] },
    { id: "5", name: "Color Chase", duration: 4, deviceCount: 10, previewColors: ["#FF6B35", "#4ECDC4", "#C7F0DB", "#F7B267"] },
    { id: "6", name: "Dramatic Red", duration: 2, deviceCount: 12, previewColors: ["#D90429", "#EF233C", "#F72E51"] },
  ];

  // Mock data for timeline
  const timelineCues = [
    { id: "1", name: "Opening", startTime: 0, duration: 15, color: "#4A6FA5" },
    { id: "2", name: "Act 1 Scene 1", startTime: 15, duration: 45, color: "#FF6B35" },
    { id: "3", name: "Transition", startTime: 60, duration: 10, color: "#4ECDC4" },
    { id: "4", name: "Act 1 Scene 2", startTime: 70, duration: 60, color: "#FFE66D" },
    { id: "5", name: "Finale", startTime: 130, duration: 30, color: "#D90429" },
  ];

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
              {devices.map((device) => (
                <LightingDevice key={device.id} {...device} />
              ))}
            </div>
          </div>

          {/* Center Panel - Timeline & Controls */}
          <div className="col-span-6 space-y-6">
            <Timeline cues={timelineCues} totalDuration={180} />
            
            <Tabs defaultValue="cues" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
                <TabsTrigger value="cues">Cues</TabsTrigger>
                <TabsTrigger value="effects">Effects</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
              </TabsList>
              <TabsContent value="cues" className="mt-4 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-zinc-400">{cues.length} cues available</p>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    New Cue
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {cues.map((cue) => (
                    <CueCard key={cue.id} {...cue} />
                  ))}
                </div>
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
                      <span className="text-sm font-medium">Cue #2</span>
                      <span className="text-xs text-emerald-400">Active</span>
                    </div>
                    <p className="text-xs text-zinc-400">Stage Wash - Warm</p>
                    <div className="flex gap-1 mt-3">
                      <div className="h-2 flex-1 rounded" style={{ backgroundColor: "#FF6B35" }} />
                      <div className="h-2 flex-1 rounded" style={{ backgroundColor: "#FFB347" }} />
                      <div className="h-2 flex-1 rounded" style={{ backgroundColor: "#FF8C42" }} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <h3 className="text-sm font-medium mb-3">System Status</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Connected Devices</span>
                      <span className="text-emerald-400">6 / 6</span>
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
                      <span className="text-emerald-400 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Online
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
