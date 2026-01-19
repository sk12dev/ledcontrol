import { Lightbulb } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

interface LightingDeviceProps {
  id: string;
  name: string;
  type: string;
  intensity?: number;
  color?: string;
  isActive?: boolean;
}

export function LightingDevice({ 
  name, 
  type, 
  intensity = 75,
  color = "#FF5733",
  isActive = true 
}: LightingDeviceProps) {
  const [deviceIntensity, setDeviceIntensity] = useState(intensity);
  const [deviceColor, setDeviceColor] = useState(color);
  const [deviceActive, setDeviceActive] = useState(isActive);

  return (
    <div className="bg-zinc-900/80 border border-zinc-700 rounded-lg p-4 backdrop-blur-sm hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-md flex items-center justify-center" 
            style={{ backgroundColor: deviceActive ? deviceColor : '#27272a' }}
          >
            <Lightbulb className={`w-5 h-5 ${deviceActive ? 'text-white' : 'text-zinc-600'}`} />
          </div>
          <div>
            <h3 className="font-medium text-sm text-white">{name}</h3>
            <p className="text-xs text-zinc-500">{type}</p>
          </div>
        </div>
        <Switch checked={deviceActive} onCheckedChange={setDeviceActive} />
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-zinc-400">Intensity</label>
            <span className="text-xs text-zinc-400">{deviceIntensity}%</span>
          </div>
          <Slider 
            value={[deviceIntensity]} 
            onValueChange={(val) => setDeviceIntensity(val[0])}
            max={100}
            step={1}
            className="w-full"
            disabled={!deviceActive}
          />
        </div>
        
        <div>
          <label className="text-xs text-zinc-400 mb-2 block">Color</label>
          <Popover>
            <PopoverTrigger asChild>
              <button 
                className="w-full h-8 rounded border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: deviceActive ? deviceColor : '#27272a' }}
                disabled={!deviceActive}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 bg-zinc-900 border-zinc-800">
              <HexColorPicker color={deviceColor} onChange={setDeviceColor} />
              <input
                type="text"
                value={deviceColor}
                onChange={(e) => setDeviceColor(e.target.value)}
                className="w-full mt-2 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-white"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
