import { Play, Edit2, Copy, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface CueCardProps {
  id: string;
  name: string;
  duration: number;
  deviceCount: number;
  previewColors: string[];
  onPlay?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}

export function CueCard({ id, name, duration, deviceCount, previewColors, onPlay, onEdit, onCopy, onDelete }: CueCardProps) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 backdrop-blur-sm hover:border-zinc-700 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-white">{name}</h3>
            <span className="text-xs text-zinc-500">#{id}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>{duration}s</span>
            <span>•</span>
            <span>{deviceCount} devices</span>
          </div>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10"
          onClick={onPlay}
        >
          <Play className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex items-center gap-1 mb-3">
        {previewColors.map((color, idx) => (
          <div 
            key={idx} 
            className="h-6 flex-1 rounded" 
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          size="sm" 
          variant="ghost" 
          className="flex-1 text-xs text-zinc-400 hover:text-white"
          onClick={onEdit}
        >
          <Edit2 className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          className="flex-1 text-xs text-zinc-400 hover:text-white"
          onClick={onCopy}
        >
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-xs text-zinc-400 hover:text-red-400"
          onClick={onDelete}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
