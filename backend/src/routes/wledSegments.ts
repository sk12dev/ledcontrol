/**
 * WLED Segments API - CRUD for named segments per device (nested under /api/devices/:deviceId/segments)
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { getDeviceState } from "../services/wledService.js";

export const wledSegmentsRouter = Router({ mergeParams: true });

const createSegmentSchema = z.object({
  name: z.string().min(1).max(255),
  wledSegmentIndex: z.number().int().min(0),
  start: z.number().int().min(0).optional().nullable(),
  stop: z.number().int().min(0).optional().nullable(),
  pushToWled: z.boolean().optional().default(false),
});

const updateSegmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  start: z.number().int().min(0).optional().nullable(),
  stop: z.number().int().min(0).optional().nullable(),
});

function getDeviceId(req: Request): number {
  const id = parseInt((req.params as { deviceId?: string }).deviceId ?? "", 10);
  if (isNaN(id)) throw new Error("Invalid device ID");
  return id;
}

// GET /api/devices/:deviceId/segments - List segments for device (from DB)
wledSegmentsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const deviceId = getDeviceId(req);

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const segments = await prisma.wledSegment.findMany({
      where: { deviceId },
      orderBy: { wledSegmentIndex: "asc" },
    });
    res.json(segments);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid device ID") {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error listing segments:", error);
    res.status(500).json({ error: "Failed to list segments" });
  }
});

// GET /api/devices/:deviceId/segments/from-wled - Get state.seg from WLED (for import)
wledSegmentsRouter.get("/from-wled", async (req: Request, res: Response) => {
  try {
    const deviceId = getDeviceId(req);

    const state = await getDeviceState(deviceId);
    const seg = state.seg ?? [];
    res.json(seg);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid device ID") {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ error: "Device not found" });
    }
    console.error("Error fetching segments from WLED:", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to fetch state from device",
    });
  }
});

// POST /api/devices/:deviceId/segments - Create segment
wledSegmentsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const deviceId = getDeviceId(req);
    const body = createSegmentSchema.parse(req.body);

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const segment = await prisma.wledSegment.create({
      data: {
        deviceId,
        name: body.name,
        wledSegmentIndex: body.wledSegmentIndex,
        start: body.start ?? undefined,
        stop: body.stop ?? undefined,
      },
    });

    if (body.pushToWled && (body.start != null || body.stop != null)) {
      try {
        const { updateDeviceState } = await import("../services/wledService.js");
        await updateDeviceState(deviceId, {
          seg: [
            {
              id: body.wledSegmentIndex,
              ...(body.start != null && { start: body.start }),
              ...(body.stop != null && { stop: body.stop }),
            },
          ],
        });
      } catch (wledError) {
        console.warn("Failed to push segment to WLED:", wledError);
        // Segment is still created in DB
      }
    }

    res.status(201).json(segment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (error instanceof Error && error.message === "Invalid device ID") {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ error: "Device not found" });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return res.status(409).json({ error: "A segment with this index already exists for this device" });
    }
    console.error("Error creating segment:", error);
    res.status(500).json({ error: "Failed to create segment" });
  }
});

// GET /api/devices/:deviceId/segments/:segmentId - Get one segment
wledSegmentsRouter.get("/:segmentId", async (req: Request, res: Response) => {
  try {
    const deviceId = getDeviceId(req);
    const segmentId = parseInt((req.params as { segmentId?: string }).segmentId ?? "", 10);
    if (isNaN(segmentId)) {
      return res.status(400).json({ error: "Invalid segment ID" });
    }

    const segment = await prisma.wledSegment.findFirst({
      where: { id: segmentId, deviceId },
    });
    if (!segment) {
      return res.status(404).json({ error: "Segment not found" });
    }
    res.json(segment);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid device ID") {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error fetching segment:", error);
    res.status(500).json({ error: "Failed to fetch segment" });
  }
});

// PUT /api/devices/:deviceId/segments/:segmentId - Update segment
wledSegmentsRouter.put("/:segmentId", async (req: Request, res: Response) => {
  try {
    const deviceId = getDeviceId(req);
    const segmentId = parseInt((req.params as { segmentId?: string }).segmentId ?? "", 10);
    if (isNaN(segmentId)) {
      return res.status(400).json({ error: "Invalid segment ID" });
    }
    const body = updateSegmentSchema.parse(req.body);

    const existing = await prisma.wledSegment.findFirst({
      where: { id: segmentId, deviceId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Segment not found" });
    }

    const segment = await prisma.wledSegment.update({
      where: { id: segmentId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.start !== undefined && { start: body.start }),
        ...(body.stop !== undefined && { stop: body.stop }),
      },
    });
    res.json(segment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (error instanceof Error && error.message === "Invalid device ID") {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return res.status(404).json({ error: "Segment not found" });
    }
    console.error("Error updating segment:", error);
    res.status(500).json({ error: "Failed to update segment" });
  }
});

// DELETE /api/devices/:deviceId/segments/:segmentId - Delete segment
wledSegmentsRouter.delete("/:segmentId", async (req: Request, res: Response) => {
  try {
    const deviceId = getDeviceId(req);
    const segmentId = parseInt((req.params as { segmentId?: string }).segmentId ?? "", 10);
    if (isNaN(segmentId)) {
      return res.status(400).json({ error: "Invalid segment ID" });
    }

    const existing = await prisma.wledSegment.findFirst({
      where: { id: segmentId, deviceId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Segment not found" });
    }

    await prisma.wledSegment.delete({
      where: { id: segmentId },
    });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid device ID") {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      return res.status(404).json({ error: "Segment not found" });
    }
    console.error("Error deleting segment:", error);
    res.status(500).json({ error: "Failed to delete segment" });
  }
});
