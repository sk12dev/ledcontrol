import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

export const dmxFixtureGroupsRouter = Router();

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
});

const updateGroupSchema = createGroupSchema.partial();

const updateFixturesSchema = z.object({
  fixtureIds: z.array(z.number().int().positive()),
});

// GET /api/dmx-fixture-groups
dmxFixtureGroupsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const groups = await prisma.dmxFixtureGroup.findMany({
      include: {
        fixtures: {
          select: {
            id: true,
            name: true,
            startAddress: true,
            channelCount: true,
            artNetNodeId: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(groups);
  } catch (error) {
    console.error("Error fetching fixture groups:", error);
    res.status(500).json({ error: "Failed to fetch fixture groups" });
  }
});

// GET /api/dmx-fixture-groups/:id
dmxFixtureGroupsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const group = await prisma.dmxFixtureGroup.findUnique({
      where: { id },
      include: {
        fixtures: {
          include: {
            artNetNode: {
              select: { id: true, name: true, ipAddress: true },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Fixture group not found" });
    }

    res.json(group);
  } catch (error) {
    console.error("Error fetching fixture group:", error);
    res.status(500).json({ error: "Failed to fetch fixture group" });
  }
});

// POST /api/dmx-fixture-groups
dmxFixtureGroupsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createGroupSchema.parse(req.body);
    const { fixtureIds } = req.body as { fixtureIds?: number[] };

    const group = await prisma.dmxFixtureGroup.create({
      data: {
        name: validatedData.name,
        description: validatedData.description ?? null,
        fixtures: fixtureIds?.length
          ? { connect: fixtureIds.map((id: number) => ({ id })) }
          : undefined,
      },
      include: {
        fixtures: {
          select: {
            id: true,
            name: true,
            startAddress: true,
            channelCount: true,
          },
        },
      },
    });

    res.status(201).json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating fixture group:", error);
    res.status(500).json({ error: "Failed to create fixture group" });
  }
});

// PUT /api/dmx-fixture-groups/:id/fixtures - must be before PUT /:id
dmxFixtureGroupsRouter.put("/:id/fixtures", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const { fixtureIds } = updateFixturesSchema.parse(req.body);

    const existing = await prisma.dmxFixtureGroup.findUnique({
      where: { id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Fixture group not found" });
    }

    const group = await prisma.dmxFixtureGroup.update({
      where: { id },
      data: {
        fixtures: {
          set: fixtureIds.map((fixtureId) => ({ id: fixtureId })),
        },
      },
      include: {
        fixtures: {
          select: {
            id: true,
            name: true,
            startAddress: true,
            channelCount: true,
          },
        },
      },
    });

    res.json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating fixture group fixtures:", error);
    res.status(500).json({ error: "Failed to update fixture group fixtures" });
  }
});

// PUT /api/dmx-fixture-groups/:id
dmxFixtureGroupsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const validatedData = updateGroupSchema.parse(req.body);

    const group = await prisma.dmxFixtureGroup.update({
      where: { id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description ?? null,
        }),
      },
      include: {
        fixtures: {
          select: {
            id: true,
            name: true,
            startAddress: true,
            channelCount: true,
          },
        },
      },
    });

    res.json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating fixture group:", error);
    res.status(500).json({ error: "Failed to update fixture group" });
  }
});

// DELETE /api/dmx-fixture-groups/:id
dmxFixtureGroupsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    await prisma.dmxFixtureGroup.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting fixture group:", error);
    res.status(500).json({ error: "Failed to delete fixture group" });
  }
});
