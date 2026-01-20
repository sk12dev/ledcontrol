import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { connectionManager } from "../services/connectionManager.js";
// @ts-ignore - File outside rootDir, excluded from compilation but available at runtime
import type * as Prisma from "../../../src/generated/prisma/internal/prismaNamespace.js";
// @ts-ignore - File outside rootDir, excluded from compilation but available at runtime
import { JsonNull } from "../../../src/generated/prisma/internal/prismaNamespace.js";
import type * as runtime from "@prisma/client/runtime/client";

export const devicesRouter = Router();

// Validation schemas
// IP address validation function
const isValidIP = (ip: string): boolean => {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;
  const parts = ip.split(".");
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

const createDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  ipAddress: z
    .string()
    .refine(isValidIP, { message: "Invalid IP address format" }),
  macAddress: z
    .string()
    .refine(
      (val) =>
        val === "" || /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(val),
      {
        message: "Invalid MAC address format",
      }
    )
    .optional()
    .nullable(),
  deviceInfo: z.any().optional().nullable(), // Use z.any() for JSON fields
});

const updateDeviceSchema = createDeviceSchema.partial();

// GET /api/devices - Get all devices
devicesRouter.get("/", async (req: Request, res: Response) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        presets: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// GET /api/devices/connection-status - Get connection status for all devices
// NOTE: Must be defined before /:id route to avoid matching "connection-status" as an ID
devicesRouter.get("/connection-status", async (req: Request, res: Response) => {
  try {
    console.log(`[Devices Route] GET /connection-status requested`);
    const statuses = await connectionManager.getAllConnectionStatuses();
    console.log(`[Devices Route] Returning ${statuses.length} statuses:`, statuses.map(s => ({
      deviceId: s.deviceId,
      isConnected: s.isConnected,
      lastPingAt: s.lastPingAt?.toISOString() || null,
      errorCount: s.errorCount
    })));
    
    // Ensure dates are serialized correctly
    const serializedStatuses = statuses.map(status => ({
      ...status,
      lastPingAt: status.lastPingAt ? status.lastPingAt.toISOString() : null,
    }));
    
    res.json(serializedStatuses);
  } catch (error) {
    console.error("Error fetching connection statuses:", error);
    res.status(500).json({ error: "Failed to fetch connection statuses" });
  }
});

// GET /api/devices/:id - Get device by ID
devicesRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        presets: true,
      },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json(device);
  } catch (error) {
    console.error("Error fetching device:", error);
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

// POST /api/devices - Create new device
devicesRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createDeviceSchema.parse(req.body);

    // Check if IP address already exists
    const existingDevice = await prisma.device.findUnique({
      where: { ipAddress: validatedData.ipAddress },
    });

    if (existingDevice) {
      return res
        .status(409)
        .json({ error: "Device with this IP address already exists" });
    }

    const device = await prisma.device.create({
      data: {
        name: validatedData.name,
        ipAddress: validatedData.ipAddress,
        macAddress: validatedData.macAddress ?? null,
        deviceInfo: validatedData.deviceInfo !== undefined && validatedData.deviceInfo !== null
          ? (validatedData.deviceInfo as runtime.InputJsonValue)
          : JsonNull,
        lastSeen: new Date(),
      },
    });

    res.status(201).json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating device:", error);
    res.status(500).json({ error: "Failed to create device" });
  }
});

// PUT /api/devices/:id - Update device
devicesRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    const validatedData = updateDeviceSchema.parse(req.body);

    // If IP address is being updated, check for conflicts
    if (validatedData.ipAddress) {
      const existingDevice = await prisma.device.findUnique({
        where: { ipAddress: validatedData.ipAddress },
      });

      if (existingDevice && existingDevice.id !== id) {
        return res
          .status(409)
          .json({
            error: "Another device with this IP address already exists",
          });
      }
    }

    const updateData: {
      name?: string;
      ipAddress?: string;
      macAddress?: string | null;
      deviceInfo?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
      lastSeen?: Date;
    } = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.ipAddress !== undefined) {
      updateData.ipAddress = validatedData.ipAddress;
      updateData.lastSeen = new Date();
    }
    if (validatedData.macAddress !== undefined)
      updateData.macAddress = validatedData.macAddress ?? null;
    if (validatedData.deviceInfo !== undefined) {
      updateData.deviceInfo = validatedData.deviceInfo !== null
        ? (validatedData.deviceInfo as runtime.InputJsonValue)
        : JsonNull;
    }

    const device = await prisma.device.update({
      where: { id },
      data: updateData,
    });

    res.json(device);
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
      return res.status(404).json({ error: "Device not found" });
    }
    console.error("Error updating device:", error);
    res.status(500).json({ error: "Failed to update device" });
  }
});

// DELETE /api/devices/:id - Delete device
devicesRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    await prisma.device.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to delete does not exist")
    ) {
      return res.status(404).json({ error: "Device not found" });
    }
    console.error("Error deleting device:", error);
    res.status(500).json({ error: "Failed to delete device" });
  }
});

// PATCH /api/devices/:id/seen - Update last seen timestamp
devicesRouter.patch("/:id/seen", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    const device = await prisma.device.update({
      where: { id },
      data: { lastSeen: new Date() },
    });

    res.json(device);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return res.status(404).json({ error: "Device not found" });
    }
    console.error("Error updating device last seen:", error);
    res.status(500).json({ error: "Failed to update device" });
  }
});

// GET /api/devices/:id/connection-status - Get connection status for a specific device
devicesRouter.get("/:id/connection-status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    const status = connectionManager.getConnectionStatus(id);
    if (!status) {
      // Device not in connection manager yet, check connection immediately
      const isConnected = await connectionManager.checkDeviceConnection(id);
      const newStatus = connectionManager.getConnectionStatus(id);
      if (newStatus) {
        return res.json(newStatus);
      }
      // Fallback if status still not set
      return res.json({
        deviceId: id,
        isConnected,
        lastPingAt: new Date(),
        errorCount: isConnected ? 0 : 1,
      });
    }

    res.json(status);
  } catch (error) {
    console.error("Error fetching connection status:", error);
    res.status(500).json({ error: "Failed to fetch connection status" });
  }
});

// POST /api/devices/:id/reconnect - Force reconnection check for a device
devicesRouter.post("/:id/reconnect", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    console.log(`[Devices Route] Reconnect requested for device ${id}`);
    
    // Force reconnect by clearing status and checking immediately
    const isConnected = await connectionManager.reconnectDevice(id);
    
    // Get the updated status (wait a tiny bit to ensure it's set)
    await new Promise(resolve => setTimeout(resolve, 100));
    const status = connectionManager.getConnectionStatus(id);
    
    console.log(`[Devices Route] Reconnect result for device ${id}: isConnected=${isConnected}, status=${status ? status.isConnected : 'null'}`);
    
    if (status) {
      res.json({
        deviceId: id,
        isConnected: status.isConnected,
        status: status,
        message: status.isConnected ? "Device reconnected successfully" : "Device connection failed",
      });
    } else {
      res.json({
        deviceId: id,
        isConnected: isConnected,
        message: isConnected ? "Device reconnected successfully" : "Device connection failed",
      });
    }
  } catch (error) {
    console.error("Error reconnecting device:", error);
    res.status(500).json({ error: "Failed to reconnect device" });
  }
});
