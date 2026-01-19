import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";

export const colorPresetsRouter = Router();

// Validation schemas
const createColorPresetSchema = z.object({
  name: z.string().min(1).max(255),
  color: z
    .array(z.number().int().min(0).max(255))
    .length(4, "Color must be [R, G, B, W] array"),
  userId: z.number().int().positive().optional(),
});

const updateColorPresetSchema = createColorPresetSchema.partial();

// GET /api/color-presets - Get all color presets (optionally filtered by userId)
colorPresetsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    if (userId !== undefined && isNaN(userId)) {
      return res.status(400).json({ error: "Invalid userId parameter" });
    }

    const colorPresets = await prisma.colorPreset.findMany({
      where: {
        userId: userId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(colorPresets);
  } catch (error) {
    console.error("Error fetching color presets:", error);
    res.status(500).json({ error: "Failed to fetch color presets" });
  }
});

// GET /api/color-presets/:id - Get color preset by ID
colorPresetsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid color preset ID" });
    }

    const colorPreset = await prisma.colorPreset.findUnique({
      where: { id },
    });

    if (!colorPreset) {
      return res.status(404).json({ error: "Color preset not found" });
    }

    res.json(colorPreset);
  } catch (error) {
    console.error("Error fetching color preset:", error);
    res.status(500).json({ error: "Failed to fetch color preset" });
  }
});

// POST /api/color-presets - Create new color preset
colorPresetsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createColorPresetSchema.parse(req.body);

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

    const colorPreset = await prisma.colorPreset.create({
      data: {
        name: validatedData.name,
        color: validatedData.color as [number, number, number, number],
        userId: validatedData.userId,
      },
    });

    res.status(201).json(colorPreset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating color preset:", error);
    res.status(500).json({ error: "Failed to create color preset" });
  }
});

// PUT /api/color-presets/:id - Update color preset
colorPresetsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid color preset ID" });
    }

    const validatedData = updateColorPresetSchema.parse(req.body);

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

    const colorPreset = await prisma.colorPreset.update({
      where: { id },
      data: {
        ...validatedData,
        color: validatedData.color as
          | [number, number, number, number]
          | undefined,
      },
    });

    res.json(colorPreset);
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
      return res.status(404).json({ error: "Color preset not found" });
    }
    console.error("Error updating color preset:", error);
    res.status(500).json({ error: "Failed to update color preset" });
  }
});

// DELETE /api/color-presets/:id - Delete color preset
colorPresetsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid color preset ID" });
    }

    await prisma.colorPreset.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to delete does not exist")
    ) {
      return res.status(404).json({ error: "Color preset not found" });
    }
    console.error("Error deleting color preset:", error);
    res.status(500).json({ error: "Failed to delete color preset" });
  }
});
