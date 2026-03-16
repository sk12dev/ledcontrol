import { useState, useMemo } from "react";
import { Play, Edit2, Copy, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export interface CueRow {
  id: string;
  name: string;
  description: string;
  stepsCount: number;
  duration: number;
  deviceCount: number;
  previewColors: string[];
  createdAt: string;
}

interface CueTableProps {
  rows: CueRow[];
  onPlay: (id: number) => void;
  onEdit: (id: number) => void;
  onCopy: (id: number) => void;
  onDelete: (id: number) => void;
}

type SortKey = "id" | "name" | "stepsCount" | "duration" | "deviceCount" | "createdAt";
type SortDir = "asc" | "desc";

const columns: { key: SortKey; label: string; className?: string }[] = [
  { key: "id", label: "ID", className: "w-16" },
  { key: "name", label: "Name", className: "min-w-[140px]" },
  { key: "stepsCount", label: "Targets", className: "w-20" },
  { key: "duration", label: "Duration", className: "w-24" },
  { key: "deviceCount", label: "Devices", className: "w-22" },
  { key: "createdAt", label: "Created", className: "w-32" },
];

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-400" />
    : <ArrowDown className="w-3 h-3 ml-1 text-emerald-400" />;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export function CueTable({ rows, onPlay, onEdit, onCopy, onDelete }: CueTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "id":
          cmp = parseInt(a.id) - parseInt(b.id);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "stepsCount":
          cmp = a.stepsCount - b.stepsCount;
          break;
        case "duration":
          cmp = a.duration - b.duration;
          break;
        case "deviceCount":
          cmp = a.deviceCount - b.deviceCount;
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <div className="overflow-auto max-h-[calc(100vh-18rem)]">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/90 sticky top-0 z-10">
            <tr className="border-b border-zinc-800">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`text-left px-3 py-2.5 font-medium text-zinc-400 select-none cursor-pointer hover:text-white transition-colors ${col.className ?? ""}`}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 font-medium text-zinc-400 w-14 text-center">Colors</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400 w-36 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {sorted.map(row => {
              const numId = parseInt(row.id);
              return (
                <tr
                  key={row.id}
                  className="bg-zinc-950 hover:bg-zinc-900/60 transition-colors group"
                >
                  <td className="px-3 py-2 text-zinc-500 tabular-nums">#{row.id}</td>
                  <td className="px-3 py-2">
                    <div className="text-white font-medium truncate max-w-[220px]">{row.name}</div>
                    {row.description && (
                      <div className="text-xs text-zinc-500 truncate max-w-[220px]">{row.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-300 tabular-nums">{row.stepsCount}</td>
                  <td className="px-3 py-2 text-zinc-300 tabular-nums">{row.duration}s</td>
                  <td className="px-3 py-2 text-zinc-300 tabular-nums">{row.deviceCount}</td>
                  <td className="px-3 py-2 text-zinc-500 text-xs">{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5 justify-center">
                      {row.previewColors.slice(0, 6).map((color, idx) => (
                        <div
                          key={idx}
                          className="w-4 h-4 rounded-sm border border-zinc-700/50"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10"
                        onClick={() => onPlay(numId)}
                        title="Play"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                        onClick={() => onEdit(numId)}
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                        onClick={() => onCopy(numId)}
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400"
                        onClick={() => onDelete(numId)}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
