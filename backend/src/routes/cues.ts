import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { cueExecutionService } from "../services/cueExecutionService.js";

export const cuesRouter = Router();

// Validation schemas
const createCueSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  showId: z.number().int().positive(), // Required - cue must belong to a show
  userId: z.number().int().positive().optional(),
  steps: z
    .array(
      z.object({
        order: z.number().int().min(0),
        timeOffset: z.coerce.number().min(0), // Coerce string to number
        transitionDuration: z.coerce.number().min(0), // Coerce string to number
        targetColor: z.array(z.number().int().min(0).max(255)).length(4).optional().nullable(),
        targetBrightness: z.number().int().min(1).max(255).optional().nullable(),
        startColor: z
          .union([
            z.array(z.number().int().min(0).max(255)).length(0), // Empty array
            z.array(z.number().int().min(0).max(255)).length(4), // 4-element array
          ])
          .optional(),
        startBrightness: z.number().int().min(1).max(255).optional().nullable(),
        deviceIds: z.array(z.number().int().positive()).min(1),
      })
    )
    .min(1),
});

const updateCueSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  showId: z.number().int().positive().optional(), // Optional - allow changing show
  userId: z.number().int().positive().optional(),
  steps: z
    .array(
      z.object({
        id: z.number().int().positive().optional(), // For existing steps
        order: z.number().int().min(0),
        timeOffset: z.coerce.number().min(0), // Coerce string to number
        transitionDuration: z.coerce.number().min(0), // Coerce string to number
        targetColor: z.array(z.number().int().min(0).max(255)).length(4).optional().nullable(),
        targetBrightness: z.number().int().min(1).max(255).optional().nullable(),
        startColor: z
          .union([
            z.array(z.number().int().min(0).max(255)).length(0), // Empty array
            z.array(z.number().int().min(0).max(255)).length(4), // 4-element array
          ])
          .optional(),
        startBrightness: z.number().int().min(1).max(255).optional().nullable(),
        deviceIds: z.array(z.number().int().positive()).min(1),
      })
    )
    .min(1)
    .optional(),
});

// GET /api/cues - List all cues
cuesRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;
    const showId = req.query.showId
      ? parseInt(req.query.showId as string)
      : undefined;

    if (userId !== undefined && isNaN(userId)) {
      return res.status(400).json({ error: "Invalid userId parameter" });
    }
    if (showId !== undefined && isNaN(showId)) {
      return res.status(400).json({ error: "Invalid showId parameter" });
    }

    const cues = await prisma.cue.findMany({
      where: {
        userId: userId ?? undefined,
        showId: showId ?? undefined,
      },
      include: {
        show: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
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
    });

    res.json(cues);
  } catch (error) {
    console.error("Error fetching cues:", error);
    res.status(500).json({ error: "Failed to fetch cues" });
  }
});

// GET /api/cues/:id - Get cue by ID
cuesRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid cue ID" });
    }

    const cue = await prisma.cue.findUnique({
      where: { id },
      include: {
        show: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
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
    });

    if (!cue) {
      return res.status(404).json({ error: "Cue not found" });
    }

    res.json(cue);
  } catch (error) {
    console.error("Error fetching cue:", error);
    res.status(500).json({ error: "Failed to fetch cue" });
  }
});

// POST /api/cues - Create new cue
cuesRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createCueSchema.parse(req.body);

    // Validate that showId exists
    const show = await prisma.show.findUnique({
      where: { id: validatedData.showId },
    });

    if (!show) {
      return res.status(400).json({ error: "Show ID not found" });
    }

    // Validate that all device IDs exist
    const deviceIds = validatedData.steps.flatMap((step) => step.deviceIds);
    const uniqueDeviceIds = [...new Set(deviceIds)];
    const devices = await prisma.device.findMany({
      where: {
        id: { in: uniqueDeviceIds },
      },
    });

    if (devices.length !== uniqueDeviceIds.length) {
      return res.status(400).json({ error: "One or more device IDs not found" });
    }

    // Create cue with steps and device assignments
    const cue = await prisma.cue.create({
      data: {
        name: validatedData.name,
        description: validatedData.description ?? null,
        showId: validatedData.showId,
        userId: validatedData.userId,
        cueSteps: {
          create: validatedData.steps.map((step) => ({
            order: step.order,
            timeOffset: step.timeOffset,
            transitionDuration: step.transitionDuration,
            targetColor: step.targetColor || [],
            targetBrightness: step.targetBrightness ?? null,
            startColor: step.startColor || [],
            startBrightness: step.startBrightness ?? null,
            cueStepDevices: {
              create: step.deviceIds.map((deviceId) => ({
                deviceId,
              })),
            },
          })),
        },
      },
      include: {
        show: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
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
    });

    res.status(201).json(cue);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating cue:", error);
    res.status(500).json({ error: "Failed to create cue" });
  }
});

// PUT /api/cues/:id - Update cue
cuesRouter.put("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid cue ID" });
  }

  try {
    console.log(`[Cues Route] PUT /cues/${id} - Request body:`, JSON.stringify(req.body, null, 2));
    const validatedData = updateCueSchema.parse(req.body);
    console.log(`[Cues Route] PUT /cues/${id} - Validation passed`);

    // Check if cue exists
    const existingCue = await prisma.cue.findUnique({
      where: { id },
    });

    if (!existingCue) {
      return res.status(404).json({ error: "Cue not found" });
    }

    // If steps are being updated, validate device IDs
    if (validatedData.steps) {
      const deviceIds = validatedData.steps.flatMap((step) => step.deviceIds);
      const uniqueDeviceIds = [...new Set(deviceIds)];
      const devices = await prisma.device.findMany({
        where: {
          id: { in: uniqueDeviceIds },
        },
      });

      if (devices.length !== uniqueDeviceIds.length) {
        return res.status(400).json({ error: "One or more device IDs not found" });
      }

      // Delete existing steps and create new ones
      await prisma.cueStep.deleteMany({
        where: { cueId: id },
      });
    }

    // If showId is being updated, validate that it exists
    if (validatedData.showId !== undefined) {
      const show = await prisma.show.findUnique({
        where: { id: validatedData.showId },
      });

      if (!show) {
        return res.status(400).json({ error: "Show ID not found" });
      }
    }

    // Update cue
    const updateData: {
      name?: string;
      description?: string | null;
      showId?: number;
      userId?: number;
      cueSteps?: {
        create: Array<{
          order: number;
          timeOffset: number;
          transitionDuration: number;
          targetColor: number[];
          targetBrightness: number | null;
          startColor: number[];
          startBrightness: number | null;
          cueStepDevices: {
            create: Array<{ deviceId: number }>;
          };
        }>;
      };
    } = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description ?? null;
    if (validatedData.showId !== undefined) updateData.showId = validatedData.showId;
    if (validatedData.userId !== undefined) updateData.userId = validatedData.userId;

    if (validatedData.steps) {
      updateData.cueSteps = {
        create: validatedData.steps.map((step) => ({
          order: step.order,
          timeOffset: step.timeOffset,
            transitionDuration: step.transitionDuration,
            targetColor: step.targetColor || [],
            targetBrightness: step.targetBrightness ?? null,
            startColor: step.startColor || [],
            startBrightness: step.startBrightness ?? null,
          cueStepDevices: {
            create: step.deviceIds.map((deviceId) => ({
              deviceId,
            })),
          },
        })),
      };
    }

    const cue = await prisma.cue.update({
      where: { id },
      data: updateData,
      include: {
        show: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
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
    });

    res.json(cue);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[Cues Route] PUT /cues/${id} - Validation error:`, error.issues);
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return res.status(404).json({ error: "Cue not found" });
    }
    console.error("Error updating cue:", error);
    res.status(500).json({ error: "Failed to update cue" });
  }
});

// DELETE /api/cues/:id - Delete cue
cuesRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid cue ID" });
    }

    await prisma.cue.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to delete does not exist")
    ) {
      return res.status(404).json({ error: "Cue not found" });
    }
    console.error("Error deleting cue:", error);
    res.status(500).json({ error: "Failed to delete cue" });
  }
});

// POST /api/cues/:id/execute - Execute a cue
cuesRouter.post("/:id/execute", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid cue ID" });
    }

    // Check if cue exists
    const cue = await prisma.cue.findUnique({
      where: { id },
    });

    if (!cue) {
      return res.status(404).json({ error: "Cue not found" });
    }

    // Execute cue (non-blocking)
    console.log(`[Cues Route] Starting execution for cue ${id}`);
    cueExecutionService.executeCue(id).then(() => {
      console.log(`[Cues Route] Cue ${id} execution completed`);
    }).catch((error) => {
      console.error(`[Cues Route] Error executing cue ${id}:`, error);
    });

    res.json({ message: "Cue execution started", cueId: id });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already executing")) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Error starting cue execution:", error);
    res.status(500).json({ error: "Failed to execute cue" });
  }
});

