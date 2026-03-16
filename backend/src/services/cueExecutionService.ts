/**
 * Cue Execution Service
 * Handles execution of cues with timing and transitions
 */

import { prisma } from "../lib/prisma.js";
import {
  updateDeviceColorAndBrightness,
  updateDeviceState,
  getDeviceState,
} from "./wledService.js";
import { sendFixtureDmx, buildFixtureChannelValues } from "./artnetService.js";

export interface ExecuteCueOptions {
  /** Transition duration in seconds (used for all steps; from CueListCue.fadeInSeconds when in a list). */
  transitionDurationSeconds?: number;
}

/** Device target: deviceId + optional segment index (0 = whole device) */
interface DeviceTarget {
  deviceId: number;
  segmentIndex: number;
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
  /** Key: "deviceId:segmentIndex" for per-segment transitions */
  private transitionFrames: Map<string, NodeJS.Timeout> = new Map();
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
        segmentIndex: csd.wledSegment?.wledSegmentIndex ?? 0,
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
      const devicePromises = steps.flatMap((step) =>
        step.deviceTargets.map((t) =>
          this.executeDeviceTransition(step, t.deviceId, transitionDurationSeconds, t.segmentIndex)
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
   * Execute a transition for a WLED device (or a specific segment). Always uses current live state as start (crossfade).
   * @param segmentIndex - 0 = whole device / first segment; otherwise WLED segment id
   */
  private async executeDeviceTransition(
    step: CueStepWithTargets,
    deviceId: number,
    transitionDurationSeconds: number,
    segmentIndex: number = 0
  ): Promise<void> {
    const frameKey = `${deviceId}:${segmentIndex}`;
    const existing = this.transitionFrames.get(frameKey);
    if (existing) {
      clearInterval(existing);
      this.transitionFrames.delete(frameKey);
    }

    if (step.turnOff) {
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

    if (step.useWledEffect && step.wledEffectId != null) {
      const primaryColor: [number, number, number, number] =
        step.targetColor && step.targetColor.length >= 4
          ? [step.targetColor[0], step.targetColor[1], step.targetColor[2], step.targetColor[3] ?? 0]
          : [255, 255, 255, 0];
      const segmentUpdate = {
        id: segmentIndex,
        fx: step.wledEffectId,
        sx: step.wledEffectSpeed ?? 128,
        ix: step.wledEffectIntensity ?? 128,
        pal: step.wledPaletteId ?? 0,
        col: [
          primaryColor,
          [0, 0, 0, 0] as [number, number, number, number],
          [0, 0, 0, 0] as [number, number, number, number],
        ] as [[number, number, number, number], [number, number, number, number], [number, number, number, number]],
      };
      try {
        await updateDeviceState(deviceId, {
          on: true,
          bri: step.targetBrightness ?? 255,
          transition: Math.round(transitionDurationSeconds * 10),
          seg: [segmentUpdate],
        });
      } catch (error) {
        console.error(`Failed to set effect on device ${deviceId}:`, error);
      }
      return;
    }

    // Crossfade: always use current device state as start (per-segment when targeting a segment)
    let startColor: number[] = [0, 0, 0, 0];
    let startBrightness = 128;
    try {
      const currentState = await getDeviceState(deviceId);
      const seg = currentState.seg;
      const segmentState = seg && segmentIndex < seg.length ? seg[segmentIndex] : seg?.[0];
      if (segmentState?.col && Array.isArray(segmentState.col[0])) {
        startColor = segmentState.col[0] as number[];
      }
      startBrightness = currentState.bri;
    } catch (error) {
      console.error(`Failed to get current state for device ${deviceId}:`, error);
      startColor = [1, 1, 1, 0];
      startBrightness = 10;
    }

    const targetColor = step.targetColor && step.targetColor.length >= 4
      ? step.targetColor
      : startColor;
    const targetBrightness = step.targetBrightness ?? startBrightness;

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

      try {
        await updateDeviceColorAndBrightness(deviceId, currentColor, currentBrightness, 0, segmentIndex);
      } catch (error) {
        console.error(`Failed to update device ${deviceId} during transition:`, error);
      }

      if (progress >= 1.0) {
        clearInterval(interval);
        this.transitionFrames.delete(frameKey);
        this.activeIntervals.delete(interval);
      }
    }, this.FRAME_INTERVAL);

    this.activeIntervals.add(interval);
    this.transitionFrames.set(frameKey, interval as unknown as NodeJS.Timeout);
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
    this.transitionFrames.clear();
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

