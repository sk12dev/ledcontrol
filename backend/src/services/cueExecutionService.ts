/**
 * Cue Execution Service
 * Handles execution of cues with timing and transitions
 */

import { prisma } from "../lib/prisma.js";
import {
  updateDeviceSolidColorsPerSegment,
  updateDeviceState,
  getDeviceState,
  resolveSegmentIdsFromState,
} from "./wledService.js";
import { sendFixtureDmx, buildFixtureChannelValues } from "./artnetService.js";

export interface ExecuteCueOptions {
  /** Transition duration in seconds (used for all steps; from CueListCue.fadeInSeconds when in a list). */
  transitionDurationSeconds?: number;
}

/** Device target: deviceId + optional WLED segment index (null = whole device / all segments) */
interface DeviceTarget {
  deviceId: number;
  segmentIndex: number | null;
}

interface CueStepWithTargets {
  id: number;
  order: number;
  targetColor: number[] | null;
  targetBrightness: number | null;
  startColor: number[]; // Kept for DB; execution always uses current state for crossfade
  startBrightness: number | null;
  turnOff: boolean;
  useWledEffect: boolean;
  wledEffectId: number | null;
  wledEffectSpeed: number | null;
  wledEffectIntensity: number | null;
  wledPaletteId: number | null;
  deviceTargets: DeviceTarget[];
  fixtures: number[];
}

/** One device row paired with its cue step (for per-row color across merged cue steps). */
interface DeviceTargetWithStep {
  segmentIndex: number | null;
  step: CueStepWithTargets;
}

interface ExecutionStatus {
  isRunning: boolean;
  cueId: number | null;
  currentStep: number | null;
  startTime: number | null;
  totalSteps: number;
}

class CueExecutionService {
  private executionStatus: ExecutionStatus = {
    isRunning: false,
    cueId: null,
    currentStep: null,
    startTime: null,
    totalSteps: 0,
  };

  private activeTimeouts: Set<NodeJS.Timeout> = new Set();
  private activeIntervals: Set<NodeJS.Timeout> = new Set();
  private fixtureTransitionFrames: Map<number, NodeJS.Timeout> = new Map(); // fixtureId -> interval
  /** Last-sent state per fixture for crossfade (avoid starting from black). */
  private fixtureLastState: Map<number, { color: number[]; brightness: number }> = new Map();

  // Transition update rate (30 FPS)
  private readonly FRAME_RATE = 30;
  private readonly FRAME_INTERVAL = 1000 / this.FRAME_RATE; // milliseconds
  private readonly DEFAULT_TRANSITION_SECONDS = 1;

  /**
   * Clear only scheduled timeouts (e.g. pending steps). Does NOT clear in-progress
   * transition intervals, so lights keep fading. Call before executeCue when advancing
   * in a cue list so the new cue crossfades from current output.
   */
  prepareForNextCue(): void {
    this.activeTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.activeTimeouts.clear();
  }

  /**
   * Execute a cue (snapshot). All steps run immediately with one transition duration.
   * Crossfade: start state is always current live state (devices via API, fixtures via cache).
   */
  async executeCue(cueId: number, options?: ExecuteCueOptions): Promise<void> {
    console.log(`[ExecutionService] executeCue called for cue ${cueId}`);
    const transitionDurationSeconds = options?.transitionDurationSeconds ?? this.DEFAULT_TRANSITION_SECONDS;

    console.log(`[ExecutionService] Loading cue ${cueId} from database`);
    const cue = await prisma.cue.findUnique({
      where: { id: cueId },
      include: {
        cueSteps: {
          include: {
            cueStepDevices: {
              include: { wledSegment: { select: { wledSegmentIndex: true } } },
            },
            cueStepFixtures: { select: { fixtureId: true } },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!cue) {
      throw new Error(`Cue with id ${cueId} not found`);
    }

    if (cue.cueSteps.length === 0) {
      console.log(`[ExecutionService] Cue ${cueId} has no steps`);
      throw new Error("Cue has no steps");
    }

    const steps: CueStepWithTargets[] = cue.cueSteps.map((step: {
      id: number; order: number;
      targetColor: number[]; targetBrightness: number | null; startColor: number[];
      startBrightness: number | null; turnOff: boolean; useWledEffect: boolean;
      wledEffectId: number | null; wledEffectSpeed: number | null;
      wledEffectIntensity: number | null; wledPaletteId: number | null;
      cueStepDevices: Array<{ deviceId: number; wledSegmentId: number | null; wledSegment: { wledSegmentIndex: number } | null }>;
      cueStepFixtures: Array<{ fixtureId: number }>;
    }) => ({
      id: step.id,
      order: step.order,
      targetColor: step.targetColor.length > 0 ? step.targetColor : null,
      targetBrightness: step.targetBrightness,
      startColor: step.startColor || [],
      startBrightness: step.startBrightness,
      turnOff: step.turnOff ?? false,
      useWledEffect: step.useWledEffect ?? false,
      wledEffectId: step.wledEffectId ?? null,
      wledEffectSpeed: step.wledEffectSpeed ?? null,
      wledEffectIntensity: step.wledEffectIntensity ?? null,
      wledPaletteId: step.wledPaletteId ?? null,
      deviceTargets: step.cueStepDevices.map((csd) => ({
        deviceId: csd.deviceId,
        segmentIndex:
          csd.wledSegment != null ? csd.wledSegment.wledSegmentIndex : null,
      })),
      fixtures: (step.cueStepFixtures ?? []).map((csf) => csf.fixtureId),
    }));

    this.executionStatus = {
      isRunning: true,
      cueId,
      currentStep: null,
      startTime: Date.now(),
      totalSteps: steps.length,
    };

    try {
      console.log(`[ExecutionService] Applying snapshot for cue ${cueId} over ${transitionDurationSeconds}s`);
      const deviceTargetsByDevice = new Map<number, DeviceTargetWithStep[]>();
      for (const step of steps) {
        for (const t of step.deviceTargets) {
          const list = deviceTargetsByDevice.get(t.deviceId) ?? [];
          list.push({ segmentIndex: t.segmentIndex, step });
          deviceTargetsByDevice.set(t.deviceId, list);
        }
      }
      const devicePromises = Array.from(deviceTargetsByDevice.entries()).map(
        ([deviceId, mergedWithSteps]) =>
          this.executeDeviceTransition(
            deviceId,
            transitionDurationSeconds,
            mergedWithSteps
          )
      );
      const fixturePromises = steps.flatMap((step) =>
        step.fixtures.map((fixtureId) =>
          this.executeFixtureTransition(step, fixtureId, transitionDurationSeconds)
        )
      );
      await Promise.all([...devicePromises, ...fixturePromises]);
    } catch (error) {
      console.error(`[ExecutionService] Error during execution of cue ${cueId}:`, error);
      this.stopExecution();
      throw error;
    }

    const finalTimeout = setTimeout(() => {
      this.executionStatus = {
        isRunning: false,
        cueId: null,
        currentStep: null,
        startTime: null,
        totalSteps: 0,
      };
      this.activeTimeouts.delete(finalTimeout);
    }, transitionDurationSeconds * 1000);

    this.activeTimeouts.add(finalTimeout);
  }

  /**
   * One transition per device for the whole cue. `mergedWithSteps` is ordered by cue step order;
   * later rows override earlier ones for the same segment / whole-device row.
   */
  private async executeDeviceTransition(
    deviceId: number,
    transitionDurationSeconds: number,
    mergedWithSteps: DeviceTargetWithStep[]
  ): Promise<void> {
    if (mergedWithSteps.length === 0) return;

    let wholeStep: CueStepWithTargets | null = null;
    const segmentStepById = new Map<number, CueStepWithTargets>();
    for (const { segmentIndex, step } of mergedWithSteps) {
      if (segmentIndex === null) {
        wholeStep = step;
      } else {
        segmentStepById.set(segmentIndex, step);
      }
    }

    if (segmentStepById.size === 0 && wholeStep?.turnOff) {
      try {
        await updateDeviceState(deviceId, {
          on: false,
          transition: Math.round(transitionDurationSeconds * 10),
        });
      } catch (error) {
        console.error(`Failed to turn off device ${deviceId}:`, error);
      }
      return;
    }

    const targetStepForSegment = (
      segmentId: number
    ): CueStepWithTargets | null => {
      if (segmentStepById.has(segmentId)) {
        return segmentStepById.get(segmentId)!;
      }
      return wholeStep;
    };

    let segmentIds: number[] = [0];
    const startColorBySegmentId = new Map<number, number[]>();
    let startBrightness = 128;
    try {
      const currentState = await getDeviceState(deviceId);
      segmentIds = resolveSegmentIdsFromState(currentState);
      const seg = currentState.seg;
      const pad4 = (c: number[]) =>
        [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0] as number[];
      for (const id of segmentIds) {
        const segmentState = seg?.find((s, i) => (s.id ?? i) === id);
        const c =
          segmentState?.col && Array.isArray(segmentState.col[0])
            ? (segmentState.col[0] as number[])
            : [0, 0, 0, 0];
        startColorBySegmentId.set(id, pad4(c));
      }
      startBrightness = currentState.bri;
    } catch (error) {
      console.error(`Failed to get current state for device ${deviceId}:`, error);
      startBrightness = 10;
    }

    const rgbwTargetFromStep = (
      step: CueStepWithTargets,
      fallbackRgbw: number[]
    ): [number, number, number, number] => {
      if (step.targetColor && step.targetColor.length >= 4) {
        return [
          step.targetColor[0],
          step.targetColor[1],
          step.targetColor[2],
          step.targetColor[3] ?? 0,
        ];
      }
      return [
        fallbackRgbw[0] ?? 0,
        fallbackRgbw[1] ?? 0,
        fallbackRgbw[2] ?? 0,
        fallbackRgbw[3] ?? 0,
      ];
    };

    const maxTargetBrightness = (): number => {
      let m = startBrightness;
      for (const id of segmentIds) {
        const st = targetStepForSegment(id);
        if (st?.targetBrightness != null) {
          m = Math.max(m, st.targetBrightness);
        }
      }
      return Math.max(m, 1);
    };

    const anySegmentUsesEffect = (): boolean => {
      for (const id of segmentIds) {
        const st = targetStepForSegment(id);
        if (
          st &&
          !st.turnOff &&
          st.useWledEffect &&
          st.wledEffectId != null
        ) {
          return true;
        }
      }
      return false;
    };

    if (anySegmentUsesEffect()) {
      const bri = maxTargetBrightness();
      const blackTriple: [
        [number, number, number, number],
        [number, number, number, number],
        [number, number, number, number],
      ] = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      const segPayload = segmentIds.map((id) => {
        const st = targetStepForSegment(id);
        if (!st || st.turnOff) {
          return { id, fx: 0, col: blackTriple };
        }
        const sc = startColorBySegmentId.get(id) ?? [0, 0, 0, 0];
        const primaryColor = rgbwTargetFromStep(st, sc);
        if (st.useWledEffect && st.wledEffectId != null) {
          return {
            id,
            fx: st.wledEffectId,
            sx: st.wledEffectSpeed ?? 128,
            ix: st.wledEffectIntensity ?? 128,
            pal: st.wledPaletteId ?? 0,
            col: [
              primaryColor,
              [0, 0, 0, 0] as [number, number, number, number],
              [0, 0, 0, 0] as [number, number, number, number],
            ] as [
              [number, number, number, number],
              [number, number, number, number],
              [number, number, number, number],
            ],
          };
        }
        return {
          id,
          fx: 0,
          col: [
            primaryColor,
            [0, 0, 0, 0] as [number, number, number, number],
            [0, 0, 0, 0] as [number, number, number, number],
          ] as [
            [number, number, number, number],
            [number, number, number, number],
            [number, number, number, number],
          ],
        };
      });
      try {
        await updateDeviceState(deviceId, {
          on: true,
          bri,
          transition: Math.round(transitionDurationSeconds * 10),
          seg: segPayload,
        });
      } catch (error) {
        console.error(`Failed to set effect on device ${deviceId}:`, error);
      }
      return;
    }

    const targetBrightness = maxTargetBrightness();
    const transitionDeciseconds = Math.round(transitionDurationSeconds * 10);

    const colorBySeg = new Map<number, [number, number, number, number]>();
    for (const id of segmentIds) {
      const st = targetStepForSegment(id);
      if (!st || st.turnOff) {
        colorBySeg.set(id, [0, 0, 0, 0]);
        continue;
      }
      const sc = startColorBySegmentId.get(id) ?? [0, 0, 0, 0];
      const hasExplicit = st.targetColor != null && st.targetColor.length >= 4;
      const finalColor: [number, number, number, number] = hasExplicit
        ? rgbwTargetFromStep(st, sc)
        : ([
            sc[0] ?? 0,
            sc[1] ?? 0,
            sc[2] ?? 0,
            sc[3] ?? 0,
          ] as [number, number, number, number]);
      colorBySeg.set(id, finalColor);
    }
    try {
      await updateDeviceSolidColorsPerSegment(
        deviceId,
        colorBySeg,
        targetBrightness,
        transitionDeciseconds,
        segmentIds
      );
    } catch (error) {
      console.error(`Failed to update device ${deviceId}:`, error);
    }
  }

  /**
   * Execute a transition for a DMX fixture. Uses last-sent cache as start for crossfade when available.
   */
  private async executeFixtureTransition(
    step: CueStepWithTargets,
    fixtureId: number,
    transitionDurationSeconds: number
  ): Promise<void> {
    const existing = this.fixtureTransitionFrames.get(fixtureId);
    if (existing) {
      clearInterval(existing);
      this.fixtureTransitionFrames.delete(fixtureId);
    }

    const fixture = await prisma.dmxFixture.findUnique({
      where: { id: fixtureId },
      include: { artNetNode: true },
    });
    if (!fixture) {
      console.error(`[ExecutionService] Fixture ${fixtureId} not found`);
      return;
    }

    const channelPurposes = (fixture.channelPurposes as string[]) ?? [];
    const purposes = Array.isArray(channelPurposes) && channelPurposes.length === fixture.channelCount
      ? channelPurposes
      : Array(fixture.channelCount).fill("dimmer");

    const targetColor = step.targetColor && step.targetColor.length >= 4
      ? step.targetColor
      : [255, 255, 255, 255];
    const targetBrightness = step.targetBrightness ?? 255;

    if (step.turnOff) {
      const values = buildFixtureChannelValues(purposes, [0, 0, 0, 0], 0, true);
      await sendFixtureDmx(fixtureId, values);
      this.fixtureLastState.set(fixtureId, { color: [0, 0, 0, 0], brightness: 0 });
      return;
    }

    if (step.useWledEffect && step.wledEffectId != null) {
      const primaryColor: [number, number, number, number] =
        step.targetColor && step.targetColor.length >= 4
          ? [step.targetColor[0], step.targetColor[1], step.targetColor[2], step.targetColor[3] ?? 0]
          : [255, 255, 255, 0];
      const values = buildFixtureChannelValues(purposes, primaryColor, step.targetBrightness ?? 255, false);
      await sendFixtureDmx(fixtureId, values);
      this.fixtureLastState.set(fixtureId, { color: [...primaryColor], brightness: step.targetBrightness ?? 255 });
      return;
    }

    // Crossfade: use cached last-sent state as start when available
    const cached = this.fixtureLastState.get(fixtureId);
    const startColor = cached && cached.color.length >= 4
      ? cached.color
      : [1, 1, 1, 0];
    const startBrightness = cached?.brightness ?? 10;

    const durationMs = transitionDurationSeconds * 1000;
    const numFrames = Math.ceil(durationMs / this.FRAME_INTERVAL);
    let currentFrame = 0;

    const interval = setInterval(async () => {
      currentFrame += 1;
      const progress = Math.min(currentFrame / numFrames, 1.0);

      const currentColor: [number, number, number, number] = [
        Math.round(startColor[0] + (targetColor[0] - startColor[0]) * progress),
        Math.round(startColor[1] + (targetColor[1] - startColor[1]) * progress),
        Math.round(startColor[2] + (targetColor[2] - startColor[2]) * progress),
        Math.round(startColor[3] + (targetColor[3] - startColor[3]) * progress),
      ];
      const currentBrightness = Math.round(
        startBrightness + (targetBrightness - startBrightness) * progress
      );

      const values = buildFixtureChannelValues(purposes, currentColor, currentBrightness, false);
      try {
        await sendFixtureDmx(fixtureId, values);
        this.fixtureLastState.set(fixtureId, { color: [...currentColor], brightness: currentBrightness });
      } catch (err) {
        console.error(`Failed to update fixture ${fixtureId}:`, err);
      }

      if (progress >= 1.0) {
        clearInterval(interval);
        this.fixtureTransitionFrames.delete(fixtureId);
        this.activeIntervals.delete(interval);
      }
    }, this.FRAME_INTERVAL);

    this.activeIntervals.add(interval);
    this.fixtureTransitionFrames.set(fixtureId, interval as unknown as NodeJS.Timeout);
  }

  /**
   * Stop current execution
   */
  stopExecution(): void {
    // Clear all timeouts
    this.activeTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.activeTimeouts.clear();

    // Clear all intervals (transitions)
    this.activeIntervals.forEach((interval) => clearInterval(interval));
    this.activeIntervals.clear();
    this.fixtureTransitionFrames.clear();

    // Reset execution status
    this.executionStatus = {
      isRunning: false,
      cueId: null,
      currentStep: null,
      startTime: null,
      totalSteps: 0,
    };
  }

  /**
   * Get current execution status
   */
  getExecutionStatus(): ExecutionStatus {
    return { ...this.executionStatus };
  }

  /**
   * Check if a cue is currently executing
   */
  isExecuting(): boolean {
    return this.executionStatus.isRunning;
  }
}

// Singleton instance
export const cueExecutionService = new CueExecutionService();

