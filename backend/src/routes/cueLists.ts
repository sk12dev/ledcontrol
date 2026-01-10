import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { cueExecutionService } from "../services/cueExecutionService.js";

export const cueListsRouter = Router();

// Validation schemas
const createCueListSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  showId: z.number().int().positive(), // Required - cue list must belong to a show
  userId: z.number().int().positive().optional(),
  cueIds: z.array(z.number().int().positive()).optional().default([]),
});

const updateCueListSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  showId: z.number().int().positive().optional(), // Optional - allow changing show
  userId: z.number().int().positive().optional(),
  cueIds: z.array(z.number().int().positive()).optional(),
});

// GET /api/cue-lists - List all cue lists
cueListsRouter.get("/", async (req: Request, res: Response) => {
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

    const cueLists = await prisma.cueList.findMany({
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
    });

    res.json(cueLists);
  } catch (error) {
    console.error("Error fetching cue lists:", error);
    res.status(500).json({ error: "Failed to fetch cue lists" });
  }
});

// GET /api/cue-lists/:id - Get cue list by ID
cueListsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid cue list ID" });
    }

    const cueList = await prisma.cueList.findUnique({
      where: { id },
      include: {
        show: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        cueListCues: {
          include: {
            cue: {
              select: {
                id: true,
                name: true,
                description: true,
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
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!cueList) {
      return res.status(404).json({ error: "Cue list not found" });
    }

    res.json(cueList);
  } catch (error) {
    console.error("Error fetching cue list:", error);
    res.status(500).json({ error: "Failed to fetch cue list" });
  }
});

// POST /api/cue-lists - Create new cue list
cueListsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = createCueListSchema.parse(req.body);

    // Validate that showId exists
    const show = await prisma.show.findUnique({
      where: { id: validatedData.showId },
    });

    if (!show) {
      return res.status(400).json({ error: "Show ID not found" });
    }

    // Validate that all cue IDs exist and belong to the same show
    if (validatedData.cueIds && validatedData.cueIds.length > 0) {
      const uniqueCueIds = [...new Set(validatedData.cueIds)];
      const cues = await prisma.cue.findMany({
        where: {
          id: { in: uniqueCueIds },
        },
      });

      if (cues.length !== uniqueCueIds.length) {
        return res.status(400).json({ error: "One or more cue IDs not found" });
      }

      // Validate that all cues belong to the same show as the cue list
      const cuesFromDifferentShow = cues.filter(
        (cue) => cue.showId !== validatedData.showId
      );

      if (cuesFromDifferentShow.length > 0) {
        return res.status(400).json({
          error: `One or more cues belong to a different show. All cues must belong to show ${validatedData.showId}`,
        });
      }
    }

    // Create cue list with cue assignments
    const cueList = await prisma.cueList.create({
      data: {
        name: validatedData.name,
        description: validatedData.description ?? null,
        showId: validatedData.showId,
        userId: validatedData.userId,
        currentPosition: 0,
        cueListCues: {
          create: validatedData.cueIds.map((cueId, index) => ({
            cueId,
            order: index,
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
    });

    res.status(201).json(cueList);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating cue list:", error);
    res.status(500).json({ error: "Failed to create cue list" });
  }
});

// PUT /api/cue-lists/:id - Update cue list
cueListsRouter.put("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid cue list ID" });
  }

  try {
    const validatedData = updateCueListSchema.parse(req.body);

    // Check if cue list exists
    const existingCueList = await prisma.cueList.findUnique({
      where: { id },
    });

    if (!existingCueList) {
      return res.status(404).json({ error: "Cue list not found" });
    }

    // Determine the showId to use (either from update or existing)
    const targetShowId = validatedData.showId ?? existingCueList.showId;

    // If showId is being updated, validate that it exists
    if (validatedData.showId !== undefined) {
      const show = await prisma.show.findUnique({
        where: { id: validatedData.showId },
      });

      if (!show) {
        return res.status(400).json({ error: "Show ID not found" });
      }
    }

    // If cueIds are being updated, validate and replace all cue assignments
    if (validatedData.cueIds !== undefined) {
      const uniqueCueIds = [...new Set(validatedData.cueIds)];
      const cues = await prisma.cue.findMany({
        where: {
          id: { in: uniqueCueIds },
        },
      });

      if (cues.length !== uniqueCueIds.length) {
        return res.status(400).json({ error: "One or more cue IDs not found" });
      }

      // Validate that all cues belong to the same show as the cue list
      const cuesFromDifferentShow = cues.filter(
        (cue) => cue.showId !== targetShowId
      );

      if (cuesFromDifferentShow.length > 0) {
        return res.status(400).json({
          error: `One or more cues belong to a different show. All cues must belong to show ${targetShowId}`,
        });
      }

      // Delete existing cue assignments
      await prisma.cueListCue.deleteMany({
        where: { cueListId: id },
      });

      // Reset current position if it would be out of bounds
      const newPosition =
        existingCueList.currentPosition >= uniqueCueIds.length
          ? Math.max(0, uniqueCueIds.length - 1)
          : existingCueList.currentPosition;

      // Update cue list with new cue assignments
      const updateData: {
        name?: string;
        description?: string | null;
        showId?: number;
        userId?: number;
        currentPosition: number;
        cueListCues: {
          create: Array<{ cueId: number; order: number }>;
        };
      } = {
        currentPosition: newPosition,
        cueListCues: {
          create: uniqueCueIds.map((cueId, index) => ({
            cueId,
            order: index,
          })),
        },
      };

      if (validatedData.name !== undefined) updateData.name = validatedData.name;
      if (validatedData.description !== undefined)
        updateData.description = validatedData.description ?? null;
      if (validatedData.showId !== undefined) updateData.showId = validatedData.showId;
      if (validatedData.userId !== undefined) updateData.userId = validatedData.userId;

      const cueList = await prisma.cueList.update({
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
      });

      return res.json(cueList);
    }

    // Update cue list metadata only
    const updateData: {
      name?: string;
      description?: string | null;
      showId?: number;
      userId?: number;
    } = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description ?? null;
    if (validatedData.showId !== undefined) updateData.showId = validatedData.showId;
    if (validatedData.userId !== undefined) updateData.userId = validatedData.userId;

    const cueList = await prisma.cueList.update({
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
    });

    res.json(cueList);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating cue list:", error);
    res.status(500).json({ error: "Failed to update cue list" });
  }
});

// DELETE /api/cue-lists/:id - Delete cue list
cueListsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid cue list ID" });
    }

    await prisma.cueList.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Record to delete does not exist")
    ) {
      return res.status(404).json({ error: "Cue list not found" });
    }
    console.error("Error deleting cue list:", error);
    res.status(500).json({ error: "Failed to delete cue list" });
  }
});

// POST /api/cue-lists/:id/step-forward - Step to next cue in list
cueListsRouter.post(
  "/:id/step-forward",
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid cue list ID" });
      }

      const cueList = await prisma.cueList.findUnique({
        where: { id },
        include: {
          cueListCues: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });

      if (!cueList) {
        return res.status(404).json({ error: "Cue list not found" });
      }

      if (cueList.cueListCues.length === 0) {
        return res.status(400).json({ error: "Cue list is empty" });
      }

      // Calculate next position
      const nextPosition = Math.min(
        cueList.currentPosition + 1,
        cueList.cueListCues.length - 1
      );

      // Update position
      const updatedCueList = await prisma.cueList.update({
        where: { id },
        data: {
          currentPosition: nextPosition,
        },
        include: {
          show: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
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
      });

      // Get the cue at the new position
      const currentCueListItem = updatedCueList.cueListCues[nextPosition];

      // Execute the cue if it exists
      if (currentCueListItem) {
        try {
          // Stop any currently executing cue
          if (cueExecutionService.isExecuting()) {
            cueExecutionService.stopExecution();
          }

          // Execute the new cue
          cueExecutionService
            .executeCue(currentCueListItem.cueId)
            .catch((error) => {
              console.error(
                `Error executing cue ${currentCueListItem.cueId}:`,
                error
              );
            });
        } catch (error) {
          console.error(
            `Error executing cue ${currentCueListItem.cueId}:`,
            error
          );
          // Continue even if execution fails
        }
      }

      res.json({
        ...updatedCueList,
        currentCueId: currentCueListItem?.cueId ?? null,
      });
    } catch (error) {
      console.error("Error stepping forward in cue list:", error);
      res.status(500).json({ error: "Failed to step forward in cue list" });
    }
  }
);

// POST /api/cue-lists/:id/step-backward - Step to previous cue in list
cueListsRouter.post(
  "/:id/step-backward",
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid cue list ID" });
      }

      const cueList = await prisma.cueList.findUnique({
        where: { id },
        include: {
          cueListCues: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });

      if (!cueList) {
        return res.status(404).json({ error: "Cue list not found" });
      }

      if (cueList.cueListCues.length === 0) {
        return res.status(400).json({ error: "Cue list is empty" });
      }

      // Calculate previous position
      const prevPosition = Math.max(0, cueList.currentPosition - 1);

      // Update position
      const updatedCueList = await prisma.cueList.update({
        where: { id },
        data: {
          currentPosition: prevPosition,
        },
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
      });

      // Get the cue at the new position
      const currentCueListItem = updatedCueList.cueListCues[prevPosition];

      // Execute the cue if it exists
      if (currentCueListItem) {
        try {
          // Stop any currently executing cue
          if (cueExecutionService.isExecuting()) {
            cueExecutionService.stopExecution();
          }

          // Execute the new cue
          cueExecutionService
            .executeCue(currentCueListItem.cueId)
            .catch((error) => {
              console.error(
                `Error executing cue ${currentCueListItem.cueId}:`,
                error
              );
            });
        } catch (error) {
          console.error(
            `Error executing cue ${currentCueListItem.cueId}:`,
            error
          );
          // Continue even if execution fails
        }
      }

      res.json({
        ...updatedCueList,
        currentCueId: currentCueListItem?.cueId ?? null,
      });
    } catch (error) {
      console.error("Error stepping backward in cue list:", error);
      res.status(500).json({ error: "Failed to step backward in cue list" });
    }
  }
);

// POST /api/cue-lists/:id/go-to - Go to a specific position in the list
cueListsRouter.post("/:id/go-to", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid cue list ID" });
    }

    const positionSchema = z.object({
      position: z.number().int().min(0),
    });
    const validatedData = positionSchema.parse(req.body);

    const cueList = await prisma.cueList.findUnique({
      where: { id },
      include: {
        cueListCues: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!cueList) {
      return res.status(404).json({ error: "Cue list not found" });
    }

    if (validatedData.position >= cueList.cueListCues.length) {
      return res.status(400).json({
        error: `Position ${validatedData.position} is out of bounds. List has ${cueList.cueListCues.length} cues.`,
      });
    }

    // Update position
    const updatedCueList = await prisma.cueList.update({
      where: { id },
      data: {
        currentPosition: validatedData.position,
      },
      include: {
        show: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
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
    });

    // Get the cue at the new position
    const currentCueListItem =
      updatedCueList.cueListCues[validatedData.position];

    // Execute the cue if it exists
    if (currentCueListItem) {
      try {
        // Stop any currently executing cue
        if (cueExecutionService.isExecuting()) {
          cueExecutionService.stopExecution();
        }

        // Execute the new cue
        cueExecutionService
          .executeCue(currentCueListItem.cueId)
          .catch((error) => {
            console.error(
              `Error executing cue ${currentCueListItem.cueId}:`,
              error
            );
          });
      } catch (error) {
        console.error(
          `Error executing cue ${currentCueListItem.cueId}:`,
          error
        );
        // Continue even if execution fails
      }
    }

    res.json({
      ...updatedCueList,
      currentCueId: currentCueListItem?.cueId ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("Error going to position in cue list:", error);
    res.status(500).json({ error: "Failed to go to position in cue list" });
  }
});
