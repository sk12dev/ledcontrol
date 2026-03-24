import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radio } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { artnetNodesApi, type DmxMonitorNodeRow } from "@/api/backendClient";

const POLL_MS = 400;

function fixtureHue(fixtureId: number): number {
  return (fixtureId * 137.508) % 360;
}

function fixtureForChannel(
  channel1: number,
  fixtures: DmxMonitorNodeRow["fixtures"]
): (typeof fixtures)[0] | undefined {
  return fixtures.find(
    (f) =>
      channel1 >= f.startAddress &&
      channel1 < f.startAddress + f.channelCount
  );
}

export default function DmxMonitorPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DmxMonitorNodeRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchMonitor = useCallback(async () => {
    try {
      const data = await artnetNodesApi.getDmxMonitor();
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load DMX monitor");
    }
  }, []);

  useEffect(() => {
    void fetchMonitor();
    const id = window.setInterval(() => void fetchMonitor(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchMonitor]);

  useEffect(() => {
    if (rows.length === 0) return;
    const has = rows.some((r) => String(r.id) === selectedId);
    if (!has) {
      setSelectedId(String(rows[0].id));
    }
  }, [rows, selectedId]);

  const active = useMemo(
    () => rows.find((r) => String(r.id) === selectedId),
    [rows, selectedId]
  );

  const stats = useMemo(() => {
    if (!active) return { max: 0, nonzero: 0 };
    let max = 0;
    let nonzero = 0;
    for (const v of active.channels) {
      if (v > 0) nonzero++;
      if (v > max) max = v;
    }
    return { max, nonzero };
  }, [active]);

  const channelCells = useMemo(() => {
    if (!active) return null;
    const { channels, fixtures } = active;
    return Array.from({ length: 512 }, (_, i) => {
      const ch = i + 1;
      const v = channels[i] ?? 0;
      const fx = fixtureForChannel(ch, fixtures);
      const hue = fx ? fixtureHue(fx.id) : 0;
      const label = fx ? `${fx.name} · ch ${ch}` : `Channel ${ch}`;
      return (
        <div
          key={ch}
          title={`${label} = ${v}`}
          className="relative rounded border border-zinc-800/90 overflow-hidden min-h-[2.25rem] flex flex-col justify-between p-0.5 text-[10px] leading-tight"
          style={{
            borderColor: fx ? `hsl(${hue} 55% 42%)` : undefined,
            background: `linear-gradient(to top, hsl(160 40% ${8 + (v / 255) * 28}%) 0%, rgb(24 24 27) 100%)`,
          }}
        >
          <span className="text-zinc-500 tabular-nums">{ch}</span>
          <span className="text-zinc-200 font-mono tabular-nums text-right">{v}</span>
        </div>
      );
    });
  }, [active]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white"
                onClick={() => navigate("/shows")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Shows
              </Button>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Radio className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">DMX monitor</h1>
                  <p className="text-xs text-zinc-500">
                    Last values sent per universe (updates ~{Math.round(1000 / POLL_MS)}× / s)
                  </p>
                </div>
              </div>
            </div>
            {rows.length > 0 && active && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                <span>
                  Max <span className="text-white font-mono">{stats.max}</span>
                </span>
                <span className="text-zinc-700">·</span>
                <span>
                  Non-zero{" "}
                  <span className="text-white font-mono">{stats.nonzero}</span> / 512
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {error && (
          <p className="text-red-400 text-sm mb-4" role="alert">
            {error}
          </p>
        )}

        {rows.length === 0 && !error ? (
          <div className="text-center py-16 text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <Radio className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No Art-Net nodes configured.</p>
            <p className="text-xs mt-1">Add a node under Devices → Art-Net, then patch fixtures.</p>
            <Button
              variant="outline"
              className="mt-4 border-zinc-700"
              onClick={() => navigate("/devices/artnet")}
            >
              Art-Net nodes
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <label className="text-sm text-zinc-400 flex items-center gap-2">
                Universe
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-[min(100vw-3rem,22rem)] bg-zinc-900 border-zinc-700">
                    <SelectValue placeholder="Select node" />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name} — {r.ipAddress} (sub {r.subnet} / uni {r.universe})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            {active && (
              <>
                {active.fixtures.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {active.fixtures.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                        style={{
                          borderColor: `hsl(${fixtureHue(f.id)} 55% 42%)`,
                          background: "rgb(24 24 27)",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background: `hsl(${fixtureHue(f.id)} 70% 50%)`,
                          }}
                        />
                        {f.name}{" "}
                        <span className="text-zinc-500 font-mono">
                          @{f.startAddress}+{f.channelCount}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-[repeat(32,minmax(0,1fr))] gap-0.5 max-w-[120rem]">
                  {channelCells}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
