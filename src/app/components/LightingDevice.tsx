import { Lightbulb, Pencil } from "lucide-react";
import { Slider } from "@/app/components/ui/slider";
import { Switch } from "@/app/components/ui/switch";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Button } from "@/app/components/ui/button";
import { useState, useEffect, useCallback, useRef } from "react";
import { setState } from "@/api/wledClient";

interface LightingDeviceProps {
  id: string;
  deviceId: number;
  ipAddress: string;
  name: string;
  type: string;
  intensity?: number;
  color?: string;
  isActive?: boolean;
  onEdit?: () => void;
  onStateChange?: () => void; // Callback when state is manually changed
}

// Helper to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [255, 160, 0, 0]; // Default orange
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return [r, g, b, 0]; // WLED format: [R, G, B, W]
}

// Helper to convert percentage (0-100) to WLED brightness (1-255)
function percentToBrightness(percent: number): number {
  return Math.max(1, Math.min(255, Math.round((percent / 100) * 255)));
}

export function LightingDevice({ 
  ipAddress,
  name, 
  type, 
  intensity = 75,
  color = "#FF5733",
  isActive = true,
  onEdit,
  onStateChange
}: LightingDeviceProps) {
  const [deviceIntensity, setDeviceIntensity] = useState(intensity);
  const [deviceColor, setDeviceColor] = useState(color);
  const [deviceActive, setDeviceActive] = useState(isActive);
  const [isUpdating, setIsUpdating] = useState(false);
  const colorInputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update device when intensity changes
  const handleIntensityChange = useCallback(async (newIntensity: number) => {
    setDeviceIntensity(newIntensity);
    if (!isActive || !ipAddress) return;
    
    setIsUpdating(true);
    try {
      const brightness = percentToBrightness(newIntensity);
      await setState(ipAddress, { bri: brightness });
      // Trigger state refresh after a short delay to sync with device
      if (onStateChange) {
        setTimeout(() => onStateChange(), 500);
      }
    } catch (error) {
      console.error(`Failed to update intensity for ${name}:`, error);
    } finally {
      setIsUpdating(false);
    }
  }, [ipAddress, isActive, name, onStateChange]);

  // Update device when color changes
  const handleColorChange = useCallback(async (newColor: string) => {
    setDeviceColor(newColor);
    if (!isActive || !ipAddress) return;
    
    setIsUpdating(true);
    try {
      const rgb = hexToRgb(newColor);
      await setState(ipAddress, {
        seg: [{
          id: 0,
          col: [rgb, [0, 0, 0, 0], [0, 0, 0, 0]],
        }],
      });
      // Trigger state refresh after a short delay to sync with device
      if (onStateChange) {
        setTimeout(() => onStateChange(), 500);
      }
    } catch (error) {
      console.error(`Failed to update color for ${name}:`, error);
    } finally {
      setIsUpdating(false);
    }
  }, [ipAddress, isActive, name, onStateChange]);

  // Update device when power state changes
  const handlePowerChange = useCallback(async (newActive: boolean) => {
    setDeviceActive(newActive);
    if (!ipAddress) return;
    
    setIsUpdating(true);
    try {
      await setState(ipAddress, { on: newActive });
      // Trigger state refresh after a short delay to sync with device
      if (onStateChange) {
        setTimeout(() => onStateChange(), 500);
      }
    } catch (error) {
      console.error(`Failed to update power for ${name}:`, error);
      // Revert on error
      setDeviceActive(!newActive);
    } finally {
      setIsUpdating(false);
    }
  }, [ipAddress, name, onStateChange]);

  // Sync with props when they change (this happens when device state is fetched)
  // When device state changes externally (e.g., from cue execution), update local state
  // This ensures the UI reflects the actual device state
  useEffect(() => {
    if (isActive !== deviceActive) {
      setDeviceActive(isActive);
    }
  }, [isActive, deviceActive]);

  useEffect(() => {
    // Only update if difference is significant to avoid jitter from polling
    if (Math.abs(intensity - deviceIntensity) > 1) {
      setDeviceIntensity(intensity);
    }
  }, [intensity, deviceIntensity]);

  useEffect(() => {
    if (color !== deviceColor) {
      setDeviceColor(color);
    }
  }, [color, deviceColor]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (colorInputTimeoutRef.current) {
        clearTimeout(colorInputTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 backdrop-blur-sm hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div 
            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" 
            style={{ backgroundColor: deviceActive ? deviceColor : '#27272a' }}
          >
            <Lightbulb className={`w-5 h-5 ${deviceActive ? 'text-white' : 'text-zinc-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-white truncate">{name}</h3>
            <p className="text-xs text-zinc-500">{type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit device"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <Switch checked={deviceActive} onCheckedChange={handlePowerChange} disabled={isUpdating || !ipAddress} />
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-zinc-400">Intensity</label>
            <span className="text-xs text-zinc-400">{deviceIntensity}%</span>
          </div>
          <Slider 
            value={[deviceIntensity]} 
            onValueChange={(val) => handleIntensityChange(val[0])}
            max={100}
            step={1}
            className="w-full"
            disabled={!deviceActive || isUpdating || !ipAddress}
          />
        </div>
        
        <div>
          <label className="text-xs text-zinc-400 mb-2 block">Color</label>
          <Popover>
            <PopoverTrigger asChild>
              <button 
                className="w-full h-8 rounded border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: deviceActive ? deviceColor : '#27272a' }}
                disabled={!deviceActive || isUpdating || !ipAddress}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 bg-zinc-900 border-zinc-800">
              <HexColorPicker color={deviceColor} onChange={handleColorChange} />
              <input
                type="text"
                value={deviceColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setDeviceColor(newColor);
                  
                  // Clear existing timeout
                  if (colorInputTimeoutRef.current) {
                    clearTimeout(colorInputTimeoutRef.current);
                  }
                  
                  // Debounce color updates on manual input
                  colorInputTimeoutRef.current = setTimeout(() => {
                    if (/^#?[0-9A-Fa-f]{6}$/.test(newColor)) {
                      handleColorChange(newColor.startsWith('#') ? newColor : `#${newColor}`);
                    }
                  }, 500);
                }}
                className="w-full mt-2 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-white"
                disabled={isUpdating || !ipAddress}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
