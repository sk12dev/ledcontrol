import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";

export const buskingPatchRouter = Router();

const patchEntrySchema = z.object({
  fixtureNumber: z.number().int().min(1),
  deviceId: z.number().int().positive().optional(),
  dmxFixtureId: z.number().int().positive().optional(),
}).refine(
  (data) => (data.deviceId != null ? 1 : 0) + (data.dmxFixtureId != null ? 1 : 0) === 1,
  { message: "Exactly one of deviceId or dmxFixtureId must be set" }
);

const setPatchSchema = z.object({
  entries: z.array(patchEntrySchema),
});

// GET /api/busking-patch - Get all patch entries with device/fixture names
buskingPatchRouter.get("/", async (req: Request, res: Response) => {
  try {
    const entries = await prisma.buskingPatchEntry.findMany({
      orderBy: { fixtureNumber: "asc" },
      include: {
        device: { select: { id: true, name: true } },
        dmxFixture: { select: { id: true, name: true } },
      },
    });
    res.json(entries);
  } catch (error) {
    console.error("Error fetching busking patch:", error);
    res.status(500).json({ error: "Failed to fetch busking patch" });
  }
});

// PUT /api/busking-patch - Replace full patch
buskingPatchRouter.put("/", async (req: Request, res: Response) => {
  try {
    const parsed = setPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation error", details: parsed.error.issues });
    }
    const { entries } = parsed.data;

    // Validate device/fixture existence and uniqueness of fixture numbers
    const fixtureNumbers = new Set<number>();
    for (const e of entries) {
      if (fixtureNumbers.has(e.fixtureNumber)) {
        return res.status(400).json({ error: `Duplicate fixture number: ${e.fixtureNumber}` });
      }
      fixtureNumbers.add(e.fixtureNumber);

      if (e.deviceId != null) {
        const device = await prisma.device.findUnique({ where: { id: e.deviceId } });
        if (!device) {
          return res.status(400).json({ error: `Device ${e.deviceId} not found` });
        }
      }
      if (e.dmxFixtureId != null) {
        const fixture = await prisma.dmxFixture.findUnique({ where: { id: e.dmxFixtureId } });
        if (!fixture) {
          return res.status(400).json({ error: `DMX fixture ${e.dmxFixtureId} not found` });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.buskingPatchEntry.deleteMany({});
      if (entries.length > 0) {
        await tx.buskingPatchEntry.createMany({
          data: entries.map((e) => ({
            fixtureNumber: e.fixtureNumber,
            deviceId: e.deviceId ?? null,
            dmxFixtureId: e.dmxFixtureId ?? null,
          })),
        });
      }
    });

    const updated = await prisma.buskingPatchEntry.findMany({
      orderBy: { fixtureNumber: "asc" },
      include: {
        device: { select: { id: true, name: true } },
        dmxFixture: { select: { id: true, name: true } },
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error setting busking patch:", error);
    res.status(500).json({ error: "Failed to set busking patch" });
  }
});
