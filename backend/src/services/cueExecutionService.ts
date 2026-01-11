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

interface CueStepWithDevices {
  id: number;
  order: number;
  timeOffset: number;
  transitionDuration: number;
  targetColor: number[] | null;
  targetBrightness: number | null;
  startColor: number[]; // Empty array means use current
  startBrightness: number | null;
  turnOff: boolean;
  devices: number[];
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
  private transitionFrames: Map<number, NodeJS.Timeout> = new Map(); // deviceId -> timeout

  // Transition update rate (30 FPS)
  private readonly FRAME_RATE = 30;
  private readonly FRAME_INTERVAL = 1000 / this.FRAME_RATE; // milliseconds

  /**
   * Execute a cue
   */
  async executeCue(cueId: number): Promise<void> {
    console.log(`[ExecutionService] executeCue called for cue ${cueId}`);
    if (this.executionStatus.isRunning) {
      console.log(`[ExecutionService] Already executing cue ${this.executionStatus.cueId}`);
      throw new Error("A cue is already executing. Stop it first.");
    }

    console.log(`[ExecutionService] Loading cue ${cueId} from database`);
    // Load cue with steps and devices
    const cue = await prisma.cue.findUnique({
      where: { id: cueId },
      include: {
        cueSteps: {
          include: {
            cueStepDevices: {
              select: {
                deviceId: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
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

    console.log(`[ExecutionService] Cue ${cueId} has ${cue.cueSteps.length} steps`);
    // Prepare steps with device assignments
    const steps: CueStepWithDevices[] = cue.cueSteps.map((step) => ({
      id: step.id,
      order: step.order,
      timeOffset: Number(step.timeOffset),
      transitionDuration: Number(step.transitionDuration),
      targetColor: step.targetColor.length > 0 ? step.targetColor : null,
      targetBrightness: step.targetBrightness,
      startColor: step.startColor || [],
      startBrightness: step.startBrightness,
      turnOff: step.turnOff ?? false,
      devices: step.cueStepDevices.map((csd) => csd.deviceId),
    }));

    // Initialize execution status
    this.executionStatus = {
      isRunning: true,
      cueId,
      currentStep: null,
      startTime: Date.now(),
      totalSteps: steps.length,
    };

    console.log(`[ExecutionService] Execution status initialized for cue ${cueId}, ${steps.length} steps`);

    try {
      // Execute all steps (they will start at their respective timeOffsets)
      console.log(`[ExecutionService] Starting execution of ${steps.length} steps`);
      await Promise.all(
        steps.map((step) => {
          console.log(`[ExecutionService] Scheduling step ${step.order} to start at ${step.timeOffset}s`);
          return this.executeStep(step);
        })
      );
      console.log(`[ExecutionService] All steps scheduled for cue ${cueId}`);
    } catch (error) {
      console.error(`[ExecutionService] Error during execution of cue ${cueId}:`, error);
      this.stopExecution();
      throw error;
    }

    // Wait for all transitions to complete
    const maxDuration = Math.max(
      ...steps.map((step) => step.timeOffset + step.transitionDuration)
    );

    const finalTimeout = setTimeout(() => {
      this.executionStatus = {
        isRunning: false,
        cueId: null,
        currentStep: null,
        startTime: null,
        totalSteps: 0,
      };
      this.activeTimeouts.delete(finalTimeout);
    }, maxDuration * 1000);

    this.activeTimeouts.add(finalTimeout);
  }

  /**
   * Execute a single step with timing
   */
  private async executeStep(step: CueStepWithDevices): Promise<void> {
    return new Promise((resolve) => {
      // Wait until timeOffset
      const startTimeout = setTimeout(async () => {
        this.activeTimeouts.delete(startTimeout);
        this.executionStatus.currentStep = step.order;

        // Execute transition for each device in parallel
        await Promise.all(
          step.devices.map((deviceId) => this.executeTransition(step, deviceId))
        );

        resolve();
      }, step.timeOffset * 1000); // Convert seconds to milliseconds

      this.activeTimeouts.add(startTimeout);
    });
  }

  /**
   * Execute a transition for a specific device
   */
  private async executeTransition(
    step: CueStepWithDevices,
    deviceId: number
  ): Promise<void> {
    // Stop any existing transition for this device
    const existingTimeout = this.transitionFrames.get(deviceId);
    if (existingTimeout) {
      clearInterval(existingTimeout);
      this.transitionFrames.delete(deviceId);
    }

    // If turnOff is true, turn the device off directly
    if (step.turnOff) {
      try {
        // Wait until timeOffset
        const startTimeout = setTimeout(async () => {
          this.activeTimeouts.delete(startTimeout);
          await updateDeviceState(deviceId, {
            on: false,
            transition: Math.round(step.transitionDuration * 10), // WLED transition is in 100ms units
          });
        }, step.timeOffset * 1000);
        this.activeTimeouts.add(startTimeout);
        return;
      } catch (error) {
        console.error(
          `Failed to turn off device ${deviceId}:`,
          error
        );
        return;
      }
    }

    // Get current device state if start values are not specified
    let startColor: number[] = step.startColor;
    let startBrightness: number | null = step.startBrightness;

    if (startColor.length === 0 || !startBrightness) {
      try {
        const currentState = await getDeviceState(deviceId);
        if (!startColor) {
          // Extract color from first segment
          if (
            currentState.seg &&
            currentState.seg.length > 0 &&
            currentState.seg[0].col &&
            currentState.seg[0].col[0]
          ) {
            startColor = currentState.seg[0].col[0];
          } else {
            startColor = [0, 0, 0, 0];
          }
        }
        if (!startBrightness) {
          startBrightness = currentState.bri;
        }
      } catch (error) {
        console.error(
          `Failed to get current state for device ${deviceId}:`,
          error
        );
        // Use defaults if we can't get current state
        if (startColor.length === 0) {
          startColor = [0, 0, 0, 0];
        }
        if (!startBrightness) {
          startBrightness = 128;
        }
      }
    }

    // Ensure startColor has a value
    if (startColor.length === 0) {
      startColor = [0, 0, 0, 0];
    }

    // Determine target values
    const targetColor = step.targetColor || startColor;
    const targetBrightness = step.targetBrightness ?? startBrightness;

    // Calculate number of frames
    const durationMs = step.transitionDuration * 1000;
    const numFrames = Math.ceil(durationMs / this.FRAME_INTERVAL);
    let currentFrame = 0;

    // Create interval for transition updates
    const interval = setInterval(async () => {
      currentFrame += 1;
      const progress = Math.min(currentFrame / numFrames, 1.0); // Clamp to 1.0

      // Interpolate values
      const targetColorValue = targetColor || startColor;
      const currentColor: [number, number, number, number] = [
        Math.round(
          startColor[0] + (targetColorValue[0] - startColor[0]) * progress
        ),
        Math.round(
          startColor[1] + (targetColorValue[1] - startColor[1]) * progress
        ),
        Math.round(
          startColor[2] + (targetColorValue[2] - startColor[2]) * progress
        ),
        Math.round(
          startColor[3] + (targetColorValue[3] - startColor[3]) * progress
        ),
      ];

      const currentBrightness = Math.round(
        (startBrightness || 0) + (targetBrightness - (startBrightness || 0)) * progress
      );

      // Apply interpolated state
      try {
        await updateDeviceColorAndBrightness(
          deviceId,
          currentColor,
          currentBrightness,
          0 // No additional transition (we're doing it manually)
        );
      } catch (error) {
        console.error(
          `Failed to update device ${deviceId} during transition:`,
          error
        );
      }

      // Clean up when transition is complete
      if (progress >= 1.0) {
        clearInterval(interval);
        this.transitionFrames.delete(deviceId);
        this.activeIntervals.delete(interval);
      }
    }, this.FRAME_INTERVAL);

    this.activeIntervals.add(interval);
    this.transitionFrames.set(deviceId, interval as unknown as NodeJS.Timeout);
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

