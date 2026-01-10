import { Router } from "express";
import type { Request, Response } from "express";
import { cueExecutionService } from "../services/cueExecutionService.js";
import { applyPresetToDevices } from "../services/wledService.js";
import { z } from "zod";

export const executionRouter = Router();

// Validation schema for apply-preset
const applyPresetSchema = z.object({
  presetId: z.number().int().positive(),
  deviceIds: z.array(z.number().int().positive()).min(1),
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

