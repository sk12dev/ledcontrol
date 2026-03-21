import { Router } from "express";
import type { Request, Response } from "express";
import { cueExecutionService } from "../services/cueExecutionService.js";
import {
  applyPresetToDevices,
  getDeviceState,
  updateDeviceColorAndBrightness,
  updateDeviceState,
} from "../services/wledService.js";
import {
  buildFixtureChannelValues,
  sendFixtureDmx,
} from "../services/artnetService.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

export const executionRouter = Router();

// Validation schema for apply-preset
const applyPresetSchema = z.object({
  presetId: z.number().int().positive(),
  deviceIds: z.array(z.number().int().positive()).min(1),
});

const colorArray = z.array(z.number().int().min(0).max(255)).length(4);

const setFixtureSchema = z.object({
  fixtureId: z.number().int().positive(),
  color: colorArray.optional(),
  /** 0 is valid when turning off / busking blackout */
  brightness: z.number().int().min(0).max(255).optional(),
  turnOff: z.boolean().optional(),
});

const setDeviceSchema = z.object({
  deviceId: z.number().int().positive(),
  color: colorArray.optional(),
  /** 0 is valid when on: false / busking off */
  brightness: z.number().int().min(0).max(255).optional(),
  on: z.boolean().optional(),
});

const setFixtureChannelsSchema = z.object({
  fixtureId: z.number().int().positive(),
  channels: z.array(z.number().int().min(0).max(255)),
});

// GET /api/execution/status - Get current execution status
executionRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const status = cueExecutionService.getExecutionStatus();
    res.json(status);
  } catch (error) {
    console.error("Error fetching execution status:", error);
    res.status(500).json({ error: "Failed to fetch execution status" });
  }
});

// POST /api/execution/stop - Stop currently executing cue
executionRouter.post("/stop", async (req: Request, res: Response) => {
  try {
    cueExecutionService.stopExecution();
    res.json({ message: "Execution stopped" });
  } catch (error) {
    console.error("Error stopping execution:", error);
    res.status(500).json({ error: "Failed to stop execution" });
  }
});

// POST /api/execution/apply-preset - Apply preset to device(s)
executionRouter.post("/apply-preset", async (req: Request, res: Response) => {
  try {
    const validatedData = applyPresetSchema.parse(req.body);

    await applyPresetToDevices(validatedData.presetId, validatedData.deviceIds);

    res.json({
      message: "Preset applied successfully",
      presetId: validatedData.presetId,
      deviceIds: validatedData.deviceIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error applying preset:", error);
    res.status(500).json({ error: "Failed to apply preset" });
  }
});

// POST /api/execution/set-fixture - Live busking: set one DMX fixture state
executionRouter.post("/set-fixture", async (req: Request, res: Response) => {
  try {
    const validated = setFixtureSchema.parse(req.body);
    const fixture = await prisma.dmxFixture.findUnique({
      where: { id: validated.fixtureId },
    });
    if (!fixture) {
      return res.status(404).json({ error: "Fixture not found" });
    }
    const purposes = (fixture.channelPurposes as string[]) ?? [];
    const channelPurposes =
      Array.isArray(purposes) && purposes.length === fixture.channelCount
        ? purposes
        : Array(fixture.channelCount).fill("dimmer");
    const color = validated.color ?? [255, 255, 255, 0];
    const brightness = validated.brightness ?? 255;
    const turnOff = validated.turnOff ?? false;
    const values = buildFixtureChannelValues(
      channelPurposes,
      color,
      brightness,
      turnOff
    );
    await sendFixtureDmx(validated.fixtureId, values);
    res.json({ message: "Fixture updated" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error setting fixture:", error);
    res.status(500).json({ error: "Failed to set fixture" });
  }
});

// POST /api/execution/set-fixture-channels - Live busking: set raw DMX channel values
executionRouter.post("/set-fixture-channels", async (req: Request, res: Response) => {
  try {
    const validated = setFixtureChannelsSchema.parse(req.body);
    const fixture = await prisma.dmxFixture.findUnique({
      where: { id: validated.fixtureId },
    });
    if (!fixture) {
      return res.status(404).json({ error: "Fixture not found" });
    }
    if (validated.channels.length !== fixture.channelCount) {
      return res.status(400).json({
        error: `Channel count must be ${fixture.channelCount}`,
      });
    }
    await sendFixtureDmx(validated.fixtureId, validated.channels);
    res.json({ message: "Fixture channels updated" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error setting fixture channels:", error);
    res.status(500).json({ error: "Failed to set fixture channels" });
  }
});

// POST /api/execution/set-device - Live busking: set one WLED device state
executionRouter.post("/set-device", async (req: Request, res: Response) => {
  try {
    const validated = setDeviceSchema.parse(req.body);
    if (validated.on === false) {
      await updateDeviceState(validated.deviceId, { on: false });
      return res.json({ message: "Device turned off" });
    }
    let color: [number, number, number, number] = [255, 255, 255, 0];
    if (validated.color && validated.color.length >= 4) {
      color = [
        validated.color[0],
        validated.color[1],
        validated.color[2],
        validated.color[3] ?? 0,
      ];
    } else {
      try {
        const state = await getDeviceState(validated.deviceId);
        if (
          state.seg &&
          state.seg.length > 0 &&
          state.seg[0].col &&
          state.seg[0].col[0]
        ) {
          color = state.seg[0].col[0];
        }
      } catch {
        // keep default
      }
    }
    const brightness = validated.brightness ?? 255;
    await updateDeviceColorAndBrightness(
      validated.deviceId,
      color,
      brightness,
      0
    );
    res.json({ message: "Device updated" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error setting device:", error);
    res.status(500).json({ error: "Failed to set device" });
  }
});

