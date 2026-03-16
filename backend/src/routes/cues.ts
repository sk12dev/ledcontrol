import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { cueExecutionService } from "../services/cueExecutionService.js";

export const cuesRouter = Router();

// Base object schema (plain z.object so we can .extend() - refined schemas have no .extend())
const stepSchemaBase = z.object({
  order: z.number().int().min(0),
  targetColor: z.array(z.number().int().min(0).max(255)).length(4).optional().nullable(),
  targetBrightness: z.number().int().min(1).max(255).optional().nullable(),
  startColor: z
    .union([
      z.array(z.number().int().min(0).max(255)).length(0),
      z.array(z.number().int().min(0).max(255)).length(4),
    ])
    .optional(),
  startBrightness: z.number().int().min(1).max(255).optional().nullable(),
  turnOff: z.boolean().optional().default(false),
  useWledEffect: z.boolean().optional().default(false),
  wledEffectId: z.number().int().min(0).max(255).optional().nullable(),
  wledEffectSpeed: z.number().int().min(0).max(255).optional().nullable(),
  wledEffectIntensity: z.number().int().min(0).max(255).optional().nullable(),
  wledPaletteId: z.number().int().min(0).optional().nullable(),
  deviceIds: z.array(z.number().int().positive()).default([]),
  segmentTargets: z.array(z.number().int().positive()).default([]),
  fixtureIds: z.array(z.number().int().positive()).default([]),
});

const stepRefine = (step: z.infer<typeof stepSchemaBase>) => {
  if (step.turnOff) return true;
  if (step.useWledEffect) return step.wledEffectId != null;
  return step.targetColor != null || step.targetBrightness != null;
};

const deviceFixtureRefine = (step: z.infer<typeof stepSchemaBase>) =>
  step.deviceIds.length > 0 || step.segmentTargets.length > 0 || step.fixtureIds.length > 0;

const stepSchema = stepSchemaBase
  .refine(deviceFixtureRefine, {
    message: "Each step must have at least one device or fixture",
  })
  .refine(stepRefine, {
    message: "Step must have turnOff, (useWledEffect with wledEffectId), or (targetColor/targetBrightness)",
  });

const createCueSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  showId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
  steps: z.array(stepSchema).min(1),
});

const updateStepSchema = stepSchemaBase
  .extend({
    id: z.number().int().positive().optional(),
  })
  .refine(deviceFixtureRefine, {
    message: "Each step must have at least one device or fixture",
  })
  .refine(stepRefine, {
    message: "Step must have turnOff, (useWledEffect with wledEffectId), or (targetColor/targetBrightness)",
  });

const updateCueSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  showId: z.number().int().positive().optional(),
  userId: z.number().int().positive().optional(),
  steps: z.array(updateStepSchema).min(1).optional(),
});

async function buildCueStepDevicesCreate(
  stepDeviceIds: number[],
  stepSegmentTargets: number[]
): Promise<Array<{ deviceId: number; wledSegmentId: number | null }>> {
  const rows: Array<{ deviceId: number; wledSegmentId: number | null }> = stepDeviceIds.map(
    (deviceId) => ({ deviceId, wledSegmentId: null })
  );
  if (stepSegmentTargets.length > 0) {
    const segments = await prisma.wledSegment.findMany({
      where: { id: { in: stepSegmentTargets } },
      select: { id: true, deviceId: true },
    });
    for (const s of segments) {
      rows.push({ deviceId: s.deviceId, wledSegmentId: s.id });
    }
  }
  return rows;
}

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
                wledSegment: {
                  select: {
                    id: true,
                    name: true,
                    wledSegmentIndex: true,
                    deviceId: true,
                  },
                },
              },
            },
            cueStepFixtures: {
              include: {
                fixture: {
                  select: {
                    id: true,
                    name: true,
                    startAddress: true,
                    channelCount: true,
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
                wledSegment: {
                  select: {
                    id: true,
                    name: true,
                    wledSegmentIndex: true,
                    deviceId: true,
                  },
                },
              },
            },
            cueStepFixtures: {
              include: {
                fixture: {
                  select: {
                    id: true,
                    name: true,
                    startAddress: true,
                    channelCount: true,
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

    const deviceIds = validatedData.steps.flatMap((step) => step.deviceIds ?? []);
    const segmentTargetIds = validatedData.steps.flatMap((step) => step.segmentTargets ?? []);
    const fixtureIds = validatedData.steps.flatMap((step) => step.fixtureIds ?? []);
    const uniqueDeviceIds = [...new Set(deviceIds)];
    const uniqueSegmentIds = [...new Set(segmentTargetIds)];
    const uniqueFixtureIds = [...new Set(fixtureIds)];

    if (uniqueDeviceIds.length > 0) {
      const devices = await prisma.device.findMany({
        where: { id: { in: uniqueDeviceIds } },
      });
      if (devices.length !== uniqueDeviceIds.length) {
        return res.status(400).json({ error: "One or more device IDs not found" });
      }
    }
    if (uniqueSegmentIds.length > 0) {
      const segments = await prisma.wledSegment.findMany({
        where: { id: { in: uniqueSegmentIds } },
        select: { id: true },
      });
      if (segments.length !== uniqueSegmentIds.length) {
        return res.status(400).json({ error: "One or more segment IDs not found" });
      }
    }
    if (uniqueFixtureIds.length > 0) {
      const fixtures = await prisma.dmxFixture.findMany({
        where: { id: { in: uniqueFixtureIds } },
      });
      if (fixtures.length !== uniqueFixtureIds.length) {
        return res.status(400).json({ error: "One or more fixture IDs not found" });
      }
    }

    // Create cue with steps and device/segment assignments
    const cue = await prisma.cue.create({
      data: {
        name: validatedData.name,
        description: validatedData.description ?? null,
        showId: validatedData.showId,
        userId: validatedData.userId,
        cueSteps: {
          create: await Promise.all(
            validatedData.steps.map(async (step) => ({
              order: step.order,
              targetColor: step.targetColor || [],
              targetBrightness: step.targetBrightness ?? null,
              startColor: step.startColor || [],
              startBrightness: step.startBrightness ?? null,
              turnOff: step.turnOff ?? false,
              useWledEffect: step.useWledEffect ?? false,
              wledEffectId: step.wledEffectId ?? null,
              wledEffectSpeed: step.wledEffectSpeed ?? null,
              wledEffectIntensity: step.wledEffectIntensity ?? null,
              wledPaletteId: step.wledPaletteId ?? null,
              cueStepDevices: {
                create: await buildCueStepDevicesCreate(
                  step.deviceIds ?? [],
                  step.segmentTargets ?? []
                ),
              },
              cueStepFixtures: {
                create: (step.fixtureIds ?? []).map((fixtureId) => ({
                  fixtureId,
                })),
              },
            }))
          ),
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
                wledSegment: {
                  select: {
                    id: true,
                    name: true,
                    wledSegmentIndex: true,
                    deviceId: true,
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
    const validatedData = updateCueSchema.parse(req.body);

    // Check if cue exists
    const existingCue = await prisma.cue.findUnique({
      where: { id },
    });

    if (!existingCue) {
      return res.status(404).json({ error: "Cue not found" });
    }

    if (validatedData.steps) {
      const deviceIds = validatedData.steps.flatMap((step) => step.deviceIds ?? []);
      const segmentTargetIds = validatedData.steps.flatMap((step) => step.segmentTargets ?? []);
      const fixtureIds = validatedData.steps.flatMap((step) => step.fixtureIds ?? []);
      const uniqueDeviceIds = [...new Set(deviceIds)];
      const uniqueSegmentIds = [...new Set(segmentTargetIds)];
      const uniqueFixtureIds = [...new Set(fixtureIds)];

      if (uniqueDeviceIds.length > 0) {
        const devices = await prisma.device.findMany({
          where: { id: { in: uniqueDeviceIds } },
        });
        if (devices.length !== uniqueDeviceIds.length) {
          return res.status(400).json({ error: "One or more device IDs not found" });
        }
      }
      if (uniqueSegmentIds.length > 0) {
        const segments = await prisma.wledSegment.findMany({
          where: { id: { in: uniqueSegmentIds } },
          select: { id: true },
        });
        if (segments.length !== uniqueSegmentIds.length) {
          return res.status(400).json({ error: "One or more segment IDs not found" });
        }
      }
      if (uniqueFixtureIds.length > 0) {
        const fixtures = await prisma.dmxFixture.findMany({
          where: { id: { in: uniqueFixtureIds } },
        });
        if (fixtures.length !== uniqueFixtureIds.length) {
          return res.status(400).json({ error: "One or more fixture IDs not found" });
        }
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
          targetColor: number[];
          targetBrightness: number | null;
          startColor: number[];
          startBrightness: number | null;
          turnOff: boolean;
          useWledEffect: boolean;
          wledEffectId: number | null;
          wledEffectSpeed: number | null;
          wledEffectIntensity: number | null;
          wledPaletteId: number | null;
          cueStepDevices: {
            create: Array<{ deviceId: number; wledSegmentId: number | null }>;
          };
          cueStepFixtures: {
            create: Array<{ fixtureId: number }>;
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
        create: await Promise.all(
          validatedData.steps.map(async (step) => ({
            order: step.order,
            targetColor: step.targetColor || [],
            targetBrightness: step.targetBrightness ?? null,
            startColor: step.startColor || [],
            startBrightness: step.startBrightness ?? null,
            turnOff: step.turnOff ?? false,
            useWledEffect: step.useWledEffect ?? false,
            wledEffectId: step.wledEffectId ?? null,
            wledEffectSpeed: step.wledEffectSpeed ?? null,
            wledEffectIntensity: step.wledEffectIntensity ?? null,
            wledPaletteId: step.wledPaletteId ?? null,
            cueStepDevices: {
              create: await buildCueStepDevicesCreate(
                step.deviceIds ?? [],
                step.segmentTargets ?? []
              ),
            },
            cueStepFixtures: {
              create: (step.fixtureIds ?? []).map((fixtureId) => ({
                fixtureId,
              })),
            },
          }))
        ),
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
                wledSegment: {
                  select: {
                    id: true,
                    name: true,
                    wledSegmentIndex: true,
                    deviceId: true,
                  },
                },
              },
            },
            cueStepFixtures: {
              include: {
                fixture: {
                  select: {
                    id: true,
                    name: true,
                    startAddress: true,
                    channelCount: true,
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

