import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";

export const presetsRouter = Router();

// Validation schemas
const createPresetSchema = z.object({
  name: z.string().min(1).max(255),
  color: z
    .array(z.number().int().min(0).max(255))
    .length(4, "Color must be [R, G, B, W] array"),
  brightness: z.number().int().min(1).max(255),
  deviceId: z.number().int().positive().optional(),
  userId: z.number().int().positive().optional(),
});

const updatePresetSchema = createPresetSchema.partial();

// GET /api/presets - Get all presets (optionally filtered by deviceId)
presetsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId
      ? parseInt(req.query.deviceId as string)
      : undefined;
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    if (deviceId !== undefined && isNaN(deviceId)) {
      return res.status(400).json({ error: "Invalid deviceId parameter" });
    }

    if (userId !== undefined && isNaN(userId)) {
      return res.status(400).json({ error: "Invalid userId parameter" });
    }

    const presets = await prisma.preset.findMany({
      where: {
        deviceId: deviceId ?? undefined,
        userId: userId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
          },
        },
      },
    });

    res.json(presets);
  } catch (error) {
    console.error("Error fetching presets:", error);
    res.status(500).json({ error: "Failed to fetch presets" });
  }
});

// GET /api/presets/:id - Get preset by ID
presetsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid preset ID" });
    }

    const preset = await prisma.preset.findUnique({
      where: { id },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
          },
        },
      },
    });

    if (!preset) {
      return res.status(404).json({ error: "Preset not found" });
    }

    res.json(preset);
  } catch (error) {
    console.error("Error fetching preset:", error);
    res.status(500).json({ error: "Failed to fetch preset" });
  }
});

// POST /api/presets - Create new preset
presetsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createPresetSchema.parse(req.body);

    // Validate brightness range (additional check)
    if (validatedData.brightness < 1 || validatedData.brightness > 255) {
      return res
        .status(400)
        .json({ error: "Brightness must be between 1 and 255" });
    }

    // Validate color array
    if (
      validatedData.color.length !== 4 ||
      !validatedData.color.every((v) => v >= 0 && v <= 255)
    ) {
      return res
        .status(400)
        .json({
          error:
            "Color must be an array of 4 integers between 0 and 255 [R, G, B, W]",
        });
    }

    // If deviceId is provided, verify device exists
    if (validatedData.deviceId) {
      const device = await prisma.device.findUnique({
        where: { id: validatedData.deviceId },
      });

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
    }

    const preset = await prisma.preset.create({
      data: {
        name: validatedData.name,
        color: validatedData.color as [number, number, number, number],
        brightness: validatedData.brightness,
        deviceId: validatedData.deviceId,
        userId: validatedData.userId,
      },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
          },
        },
      },
    });

    res.status(201).json(preset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating preset:", error);
    res.status(500).json({ error: "Failed to create preset" });
  }
});

// PUT /api/presets/:id - Update preset
presetsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid preset ID" });
    }

    const validatedData = updatePresetSchema.parse(req.body);

    // Validate brightness if provided
    if (validatedData.brightness !== undefined) {
      if (validatedData.brightness < 1 || validatedData.brightness > 255) {
        return res
          .status(400)
          .json({ error: "Brightness must be between 1 and 255" });
      }
    }

    // Validate color if provided
    if (validatedData.color !== undefined) {
      if (
        validatedData.color.length !== 4 ||
        !validatedData.color.every((v) => v >= 0 && v <= 255)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Color must be an array of 4 integers between 0 and 255 [R, G, B, W]",
          });
      }
    }

    // If deviceId is being updated, verify device exists
    if (
      validatedData.deviceId !== undefined &&
      validatedData.deviceId !== null
    ) {
      const device = await prisma.device.findUnique({
        where: { id: validatedData.deviceId },
      });

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
    }

    const preset = await prisma.preset.update({
      where: { id },
      data: {
        ...validatedData,
        color: validatedData.color as
          | [number, number, number, number]
          | undefined,
      },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
          },
        },
      },
    });

    res.json(preset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return res.status(404).json({ error: "Preset not found" });
    }
    console.error("Error updating preset:", error);
    res.status(500).json({ error: "Failed to update preset" });
  }
});

// DELETE /api/presets/:id - Delete preset
presetsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid preset ID" });
    }

    await prisma.preset.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to delete does not exist")
    ) {
      return res.status(404).json({ error: "Preset not found" });
    }
    console.error("Error deleting preset:", error);
    res.status(500).json({ error: "Failed to delete preset" });
  }
});
