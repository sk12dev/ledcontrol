import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { getUniverseShadowSnapshot } from "../services/artnetService.js";

export const artnetNodesRouter = Router();

const isValidIP = (ip: string): boolean => {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;
  const parts = ip.split(".");
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

const createNodeSchema = z.object({
  name: z.string().min(1).max(255),
  ipAddress: z.string().refine(isValidIP, { message: "Invalid IP address format" }),
  subnet: z.number().int().min(0).max(15).default(0),
  universe: z.number().int().min(0).max(15).default(0),
});

const updateNodeSchema = createNodeSchema.partial();

// GET /api/artnet-nodes
artnetNodesRouter.get("/", async (req: Request, res: Response) => {
  try {
    const nodes = await prisma.artNetNode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        dmxFixtures: {
          select: { id: true, name: true, startAddress: true, channelCount: true },
        },
      },
    });
    res.json(nodes);
  } catch (error) {
    console.error("Error fetching Art-Net nodes:", error);
    res.status(500).json({ error: "Failed to fetch Art-Net nodes" });
  }
});

// GET /api/artnet-nodes/dmx-monitor — live last-sent DMX per node universe (must be before /:id)
artnetNodesRouter.get("/dmx-monitor", async (_req: Request, res: Response) => {
  try {
    const nodes = await prisma.artNetNode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        dmxFixtures: {
          select: { id: true, name: true, startAddress: true, channelCount: true },
          orderBy: { startAddress: "asc" },
        },
      },
    });

    const payload = nodes.map((n) => ({
      id: n.id,
      name: n.name,
      ipAddress: n.ipAddress,
      subnet: n.subnet,
      universe: n.universe,
      channels: getUniverseShadowSnapshot(n.ipAddress, n.subnet, n.universe),
      fixtures: n.dmxFixtures,
    }));

    res.json(payload);
  } catch (error) {
    console.error("Error building DMX monitor snapshot:", error);
    res.status(500).json({ error: "Failed to fetch DMX monitor data" });
  }
});

// GET /api/artnet-nodes/:id
artnetNodesRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid node ID" });
    }

    const node = await prisma.artNetNode.findUnique({
      where: { id },
      include: { dmxFixtures: true },
    });

    if (!node) {
      return res.status(404).json({ error: "Art-Net node not found" });
    }

    res.json(node);
  } catch (error) {
    console.error("Error fetching Art-Net node:", error);
    res.status(500).json({ error: "Failed to fetch Art-Net node" });
  }
});

// POST /api/artnet-nodes
artnetNodesRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createNodeSchema.parse(req.body);

    const existing = await prisma.artNetNode.findUnique({
      where: { ipAddress: validatedData.ipAddress },
    });

    if (existing) {
      return res
        .status(409)
        .json({ error: "Art-Net node with this IP address already exists" });
    }

    const node = await prisma.artNetNode.create({
      data: {
        name: validatedData.name,
        ipAddress: validatedData.ipAddress,
        subnet: validatedData.subnet,
        universe: validatedData.universe,
      },
    });

    res.status(201).json(node);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating Art-Net node:", error);
    res.status(500).json({ error: "Failed to create Art-Net node" });
  }
});

// PUT /api/artnet-nodes/:id
artnetNodesRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid node ID" });
    }

    const validatedData = updateNodeSchema.parse(req.body);

    if (validatedData.ipAddress) {
      const existing = await prisma.artNetNode.findUnique({
        where: { ipAddress: validatedData.ipAddress },
      });
      if (existing && existing.id !== id) {
        return res.status(409).json({
          error: "Another Art-Net node with this IP address already exists",
        });
      }
    }

    const node = await prisma.artNetNode.update({
      where: { id },
      data: validatedData,
    });

    res.json(node);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return res.status(404).json({ error: "Art-Net node not found" });
    }
    console.error("Error updating Art-Net node:", error);
    res.status(500).json({ error: "Failed to update Art-Net node" });
  }
});

// DELETE /api/artnet-nodes/:id
artnetNodesRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid node ID" });
    }

    await prisma.artNetNode.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to delete does not exist")
    ) {
      return res.status(404).json({ error: "Art-Net node not found" });
    }
    console.error("Error deleting Art-Net node:", error);
    res.status(500).json({ error: "Failed to delete Art-Net node" });
  }
});
