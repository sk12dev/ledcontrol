import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { testFixture } from "../services/artnetService.js";
import type * as runtime from "@prisma/client/runtime/client";

export const dmxFixturesRouter = Router();

const createFixtureSchema = z.object({
  name: z.string().min(1).max(255),
  artNetNodeId: z.number().int().positive(),
  startAddress: z.number().int().min(1).max(512),
  channelCount: z.number().int().min(1).max(512),
  channelPurposes: z.array(z.string()),
});

const updateFixtureSchema = createFixtureSchema.partial();

// Validate startAddress + channelCount <= 512
function validateFixtureAddress(data: {
  startAddress: number;
  channelCount: number;
}): boolean {
  return data.startAddress + data.channelCount - 1 <= 512;
}

// GET /api/dmx-fixtures
dmxFixturesRouter.get("/", async (req: Request, res: Response) => {
  try {
    const fixtures = await prisma.dmxFixture.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        artNetNode: {
          select: { id: true, name: true, ipAddress: true, subnet: true, universe: true },
        },
      },
    });
    res.json(fixtures);
  } catch (error) {
    console.error("Error fetching DMX fixtures:", error);
    res.status(500).json({ error: "Failed to fetch DMX fixtures" });
  }
});

// GET /api/dmx-fixtures/:id
dmxFixturesRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid fixture ID" });
    }

    const fixture = await prisma.dmxFixture.findUnique({
      where: { id },
      include: { artNetNode: true },
    });

    if (!fixture) {
      return res.status(404).json({ error: "DMX fixture not found" });
    }

    res.json(fixture);
  } catch (error) {
    console.error("Error fetching DMX fixture:", error);
    res.status(500).json({ error: "Failed to fetch DMX fixture" });
  }
});

// POST /api/dmx-fixtures
dmxFixturesRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createFixtureSchema.parse(req.body);

    if (!validateFixtureAddress(validatedData)) {
      return res.status(400).json({
        error: "startAddress + channelCount must not exceed 512",
      });
    }

    const nodeExists = await prisma.artNetNode.findUnique({
      where: { id: validatedData.artNetNodeId },
    });
    if (!nodeExists) {
      return res.status(404).json({ error: "Art-Net node not found" });
    }

    const fixture = await prisma.dmxFixture.create({
      data: {
        name: validatedData.name,
        artNetNodeId: validatedData.artNetNodeId,
        startAddress: validatedData.startAddress,
        channelCount: validatedData.channelCount,
        channelPurposes: validatedData.channelPurposes as runtime.InputJsonValue,
      },
      include: { artNetNode: true },
    });

    res.status(201).json(fixture);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating DMX fixture:", error);
    res.status(500).json({ error: "Failed to create DMX fixture" });
  }
});

// PUT /api/dmx-fixtures/:id
dmxFixturesRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid fixture ID" });
    }

    const validatedData = updateFixtureSchema.parse(req.body);

    const existing = await prisma.dmxFixture.findUnique({
      where: { id },
      include: { artNetNode: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "DMX fixture not found" });
    }

    const merged = {
      startAddress: validatedData.startAddress ?? existing.startAddress,
      channelCount: validatedData.channelCount ?? existing.channelCount,
    };
    if (!validateFixtureAddress(merged)) {
      return res.status(400).json({
        error: "startAddress + channelCount must not exceed 512",
      });
    }

    if (validatedData.artNetNodeId) {
      const nodeExists = await prisma.artNetNode.findUnique({
        where: { id: validatedData.artNetNodeId },
      });
      if (!nodeExists) {
        return res.status(404).json({ error: "Art-Net node not found" });
      }
    }

    const fixture = await prisma.dmxFixture.update({
      where: { id },
      data: {
        ...validatedData,
        channelPurposes:
          validatedData.channelPurposes !== undefined
            ? (validatedData.channelPurposes as runtime.InputJsonValue)
            : undefined,
      },
      include: { artNetNode: true },
    });

    res.json(fixture);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return res.status(404).json({ error: "DMX fixture not found" });
    }
    console.error("Error updating DMX fixture:", error);
    res.status(500).json({ error: "Failed to update DMX fixture" });
  }
});

// DELETE /api/dmx-fixtures/:id
dmxFixturesRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid fixture ID" });
    }

    await prisma.dmxFixture.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to delete does not exist")
    ) {
      return res.status(404).json({ error: "DMX fixture not found" });
    }
    console.error("Error deleting DMX fixture:", error);
    res.status(500).json({ error: "Failed to delete DMX fixture" });
  }
});

// POST /api/dmx-fixtures/:id/test - Send test values
dmxFixturesRouter.post("/:id/test", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid fixture ID" });
    }

    await testFixture(id);
    res.json({ success: true, message: "Test DMX sent" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ error: "DMX fixture not found" });
    }
    console.error("Error testing DMX fixture:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send test DMX",
    });
  }
});
