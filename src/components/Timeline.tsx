import { useState } from "react";
import { Play, Pause, SkipForward, SkipBack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelineCue {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  color: string;
}

interface TimelineProps {
  cues: TimelineCue[];
  totalDuration: number;
}

export function Timeline({ cues, totalDuration }: TimelineProps) {
  const [currentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate dynamic time markers based on totalDuration
  const generateTimeMarkers = (duration: number): number[] => {
    if (duration <= 0) return [0];
    
    // Use 30-second intervals for durations up to 180 seconds
    // For longer durations, use larger intervals to keep ~6-7 markers
    const interval = duration <= 180 ? 30 : Math.ceil(duration / 6);
    const markers: number[] = [];
    
    for (let i = 0; i <= duration; i += interval) {
      markers.push(i);
    }
    
    // Always include the final duration
    if (markers[markers.length - 1] !== duration) {
      markers.push(duration);
    }
    
    return markers;
  };

  const timeMarkers = generateTimeMarkers(totalDuration);

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-white">Timeline</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button 
            size="sm" 
            variant="default" 
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white">
            <SkipForward className="w-4 h-4" />
          </Button>
          <span className="text-sm text-zinc-400 ml-2">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>
      </div>
      
      <ScrollArea className="w-full">
        <div className="relative h-24 bg-zinc-950/50 rounded border border-zinc-800 p-2">
          {/* Time markers */}
          <div className="absolute top-0 left-0 right-0 h-6 flex items-center justify-between px-2 text-xs text-zinc-500">
            {timeMarkers.map((time) => (
              <span key={time}>{formatTime(time)}</span>
            ))}
          </div>
          
          {/* Cue blocks */}
          <div className="absolute top-6 left-0 right-0 bottom-0 p-2">
            {cues.map((cue) => {
              const leftPercent = (cue.startTime / totalDuration) * 100;
              const widthPercent = (cue.duration / totalDuration) * 100;
              
              return (
                <div
                  key={cue.id}
                  className="absolute h-12 rounded border border-zinc-700 cursor-pointer hover:border-zinc-600 transition-all group"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: `${cue.color}40`,
                  }}
                >
                  <div className="flex items-center h-full px-2">
                    <span className="text-xs font-medium text-white truncate">{cue.name}</span>
                  </div>
                  <div 
                    className="absolute bottom-0 left-0 h-1 rounded-b" 
                    style={{ backgroundColor: cue.color, width: '100%' }}
                  />
                </div>
              );
            })}
          </div>
          
          {/* Playhead */}
          <div 
            className="absolute top-6 bottom-2 w-0.5 bg-emerald-400 pointer-events-none z-10"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          >
            <div className="w-3 h-3 bg-emerald-400 rounded-full absolute -top-1 -left-1.5" />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
