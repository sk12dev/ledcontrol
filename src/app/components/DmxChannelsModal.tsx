"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Slider } from "@/app/components/ui/slider";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { executionApi } from "@/api/backendClient";
import type { DmxFixture } from "@/api/backendClient";

const LIVE_DEBOUNCE_MS = 80;

/**
 * Build channel values from color/brightness/on using fixture's channelPurposes (mirrors backend logic).
 */
export function buildFixtureChannelValuesFromState(
  channelPurposes: string[],
  color: [number, number, number, number],
  brightness: number,
  on: boolean
): number[] {
  const [r = 0, g = 0, b = 0, w = 0] = color;
  const values: number[] = new Array(channelPurposes.length).fill(0);
  const turnOff = !on;
  const brightnessVal = turnOff ? 0 : brightness;
  const scale = turnOff ? 0 : brightnessVal / 255;

  for (let i = 0; i < channelPurposes.length; i++) {
    const purpose = (channelPurposes[i] || "").toLowerCase();
    let val = 0;
    switch (purpose) {
      case "red":
        val = Math.round(r * scale);
        break;
      case "green":
        val = Math.round(g * scale);
        break;
      case "blue":
        val = Math.round(b * scale);
        break;
      case "white":
      case "alpha":
        val = Math.round(w * scale);
        break;
      case "amber":
        val = Math.round(((r + g) / 2) * scale);
        break;
      case "uv":
        val = Math.round(((b + w) / 2) * scale);
        break;
      case "dimmer":
        val = brightnessVal;
        break;
      default:
        val = 0;
        break;
    }
    values[i] = Math.max(0, Math.min(255, val));
  }
  return values;
}

interface DmxChannelsModalProps {
  fixture: DmxFixture;
  initialChannels: number[];
  isOpen: boolean;
  onClose: () => void;
  liveMode: boolean;
  /** When set (e.g. cue builder), primary action stores values on the cue instead of only live output */
  onApplyToCue?: (channels: number[]) => void;
}

export function DmxChannelsModal({
  fixture,
  initialChannels,
  isOpen,
  onClose,
  liveMode,
  onApplyToCue,
}: DmxChannelsModalProps) {
  const [channels, setChannels] = useState<number[]>(() => [...initialChannels]);
  const liveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelsRef = useRef<number[]>(channels);
  channelsRef.current = channels;

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setChannels(
        initialChannels.length === fixture.channelCount
          ? [...initialChannels]
          : Array(fixture.channelCount).fill(0)
      );
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, fixture.channelCount, initialChannels]);

  useEffect(() => {
    return () => {
      if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
    };
  }, []);

  const purposes =
    Array.isArray(fixture.channelPurposes) && fixture.channelPurposes.length === fixture.channelCount
      ? (fixture.channelPurposes as string[])
      : Array(fixture.channelCount).fill("dimmer");

  const sendChannels = useCallback(
    (next: number[]) => {
      if (!liveMode) return;
      executionApi.setFixtureChannels(fixture.id, next).catch((e) => console.error("setFixtureChannels failed:", e));
    },
    [fixture.id, liveMode]
  );

  const setChannel = useCallback(
    (index: number, value: number) => {
      const v = Math.max(0, Math.min(255, value));
      setChannels((prev) => {
        const next = [...prev];
        next[index] = v;
        if (liveMode) {
          if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
          liveDebounceRef.current = setTimeout(() => {
            liveDebounceRef.current = null;
            sendChannels(channelsRef.current);
          }, LIVE_DEBOUNCE_MS);
        }
        return next;
      });
    },
    [liveMode, sendChannels]
  );

  const handleSliderChange = useCallback(
    (index: number, value: number[]) => {
      setChannel(index, value[0] ?? 0);
    },
    [setChannel]
  );

  const handleInputChange = useCallback(
    (index: number, raw: string) => {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n)) setChannel(index, n);
    },
    [setChannel]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[90vw] max-h-[85vh] bg-zinc-900 border-zinc-800 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">DMX Channels — {fixture.name}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Ch {fixture.startAddress}–{fixture.startAddress + fixture.channelCount - 1} (0–255)
            {liveMode && " · Live"}
            {onApplyToCue && " · Saved on the cue when you confirm (not sent to stage until the cue runs)"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-wrap gap-6 py-2 px-4">
            {channels.map((val, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 min-w-[4.5rem] shrink-0"
              >
                <Label className="text-xs text-zinc-500 text-center leading-tight whitespace-nowrap">
                  Ch {fixture.startAddress + i}
                  <span className="block font-normal text-zinc-600 capitalize">
                    {purposes[i] || "—"}
                  </span>
                </Label>
                <div className="flex-1 flex flex-col items-center gap-1 min-h-[120px]">
                  <Slider
                    orientation="vertical"
                    value={[val]}
                    onValueChange={(v) => handleSliderChange(i, v)}
                    min={0}
                    max={255}
                    step={1}
                    className="h-24 [&_[data-slot=slider-track]]:bg-gradient-to-t [&_[data-slot=slider-track]]:from-black [&_[data-slot=slider-track]]:to-white [&_[data-slot=slider-range]]:bg-transparent"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={val}
                    onChange={(e) => handleInputChange(i, e.target.value)}
                    className="w-16 h-8 text-center text-sm bg-zinc-800 border-zinc-700 text-white tabular-nums"
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
          {onApplyToCue ? (
            <>
              <Button variant="outline" className="border-zinc-700" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => {
                  onApplyToCue(channels);
                  onClose();
                }}
              >
                Save to cue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="border-zinc-700" onClick={onClose}>
                Close
              </Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => {
                  executionApi.setFixtureChannels(fixture.id, channels).catch((e) => console.error("setFixtureChannels failed:", e));
                }}
              >
                {liveMode ? "Send now" : "Send"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
