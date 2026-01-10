import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";

export const showsRouter = Router();

// Validation schemas
const createShowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  userId: z.number().int().positive().optional(),
});

const updateShowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  userId: z.number().int().positive().optional(),
});

// GET /api/shows - List all shows
showsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    if (userId !== undefined && isNaN(userId)) {
      return res.status(400).json({ error: "Invalid userId parameter" });
    }

    const shows = await prisma.show.findMany({
      where: {
        userId: userId ?? undefined,
      },
      include: {
        cues: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        cueLists: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(shows);
  } catch (error) {
    console.error("Error fetching shows:", error);
    res.status(500).json({ error: "Failed to fetch shows" });
  }
});

// GET /api/shows/:id - Get show by ID
showsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid show ID" });
    }

    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        cues: {
          include: {
            cueSteps: {
              include: {
                cueStepDevices: {
                  include: {
                    device: {
                      select: {
                        id: true,
                        name: true,
                        ipAddress: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        cueLists: {
          include: {
            cueListCues: {
              include: {
                cue: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!show) {
      return res.status(404).json({ error: "Show not found" });
    }

    res.json(show);
  } catch (error) {
    console.error("Error fetching show:", error);
    res.status(500).json({ error: "Failed to fetch show" });
  }
});

// POST /api/shows - Create new show
showsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createShowSchema.parse(req.body);

    const show = await prisma.show.create({
      data: {
        name: validatedData.name,
        description: validatedData.description ?? null,
        userId: validatedData.userId,
      },
      include: {
        cues: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        cueLists: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    res.status(201).json(show);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating show:", error);
    res.status(500).json({ error: "Failed to create show" });
  }
});

// PUT /api/shows/:id - Update show
showsRouter.put("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid show ID" });
  }

  try {
    const validatedData = updateShowSchema.parse(req.body);

    // Check if show exists
    const existingShow = await prisma.show.findUnique({
      where: { id },
    });

    if (!existingShow) {
      return res.status(404).json({ error: "Show not found" });
    }

    // Update show
    const updateData: {
      name?: string;
      description?: string | null;
      userId?: number;
    } = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description ?? null;
    if (validatedData.userId !== undefined) updateData.userId = validatedData.userId;

    const show = await prisma.show.update({
      where: { id },
      data: updateData,
      include: {
        cues: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        cueLists: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    res.json(show);
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
      return res.status(404).json({ error: "Show not found" });
    }
    console.error("Error updating show:", error);
    res.status(500).json({ error: "Failed to update show" });
  }
});

// DELETE /api/shows/:id - Delete show
showsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid show ID" });
    }

    await prisma.show.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to delete does not exist")
    ) {
      return res.status(404).json({ error: "Show not found" });
    }
    console.error("Error deleting show:", error);
    res.status(500).json({ error: "Failed to delete show" });
  }
});
