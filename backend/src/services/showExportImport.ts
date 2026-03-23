/**
 * Export / import a show (cues + cue lists) for moving between instances.
 * Targets are resolved by device IP, segment index, and Art-Net node IP + fixture start address.
 */

import { prisma } from "../lib/prisma.js";
import { z } from "zod";

export const SHOW_EXPORT_FORMAT = "ledcontrol-show-export" as const;
export const SHOW_EXPORT_VERSION = 1 as const;

const decimalLike = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
});

const cueStepDeviceExportSchema = z.object({
  deviceIp: z.string().min(1),
  deviceName: z.string().optional(),
  /** null = whole device */
  wledSegmentIndex: z.number().int().min(0).nullable(),
  segmentName: z.string().nullable().optional(),
});

const cueStepFixtureExportSchema = z.object({
  artNetNodeIp: z.string().min(1),
  artNetNodeName: z.string().optional(),
  fixtureName: z.string().min(1),
  startAddress: z.number().int().min(1).max(512),
  channelCount: z.number().int().min(1).max(512),
  channelPurposes: z.array(z.string()).optional(),
  dmxChannelValues: z.array(z.number().int().min(0).max(255)).optional().default([]),
});

const cueStepExportSchema = z.object({
  order: z.number().int().min(0),
  targetColor: z.array(z.number().int().min(0).max(255)).length(4).nullable().optional(),
  targetBrightness: z.number().int().min(1).max(255).nullable().optional(),
  startColor: z.array(z.number().int().min(0).max(255)).max(4).optional(),
  startBrightness: z.number().int().min(1).max(255).nullable().optional(),
  turnOff: z.boolean().optional(),
  useWledEffect: z.boolean().optional(),
  wledEffectId: z.number().int().nullable().optional(),
  wledEffectSpeed: z.number().int().nullable().optional(),
  wledEffectIntensity: z.number().int().nullable().optional(),
  wledPaletteId: z.number().int().nullable().optional(),
  cueStepDevices: z.array(cueStepDeviceExportSchema),
  cueStepFixtures: z.array(cueStepFixtureExportSchema),
  fixtureDmx: z
    .array(
      z.object({
        fixtureIndex: z.number().int().min(0),
        values: z.array(z.number().int().min(0).max(255)),
      })
    )
    .optional(),
});

const cueExportSchema = z.object({
  exportKey: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  steps: z.array(cueStepExportSchema).min(1),
});

const cueListCueExportSchema = z.object({
  order: z.number().int().min(0),
  cueExportKey: z.string().min(1),
  fadeInSeconds: decimalLike,
  fadeOutSeconds: decimalLike,
  durationSeconds: decimalLike.nullable().optional(),
  repeatIntervalSeconds: decimalLike.optional(),
  repeatTotalPlays: z.number().int().positive().nullable().optional(),
});

const cueListExportSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  currentPosition: z.number().int().min(0),
  cueListCues: z.array(cueListCueExportSchema),
});

export const showExportBundleSchema = z.object({
  format: z.literal(SHOW_EXPORT_FORMAT),
  version: z.literal(SHOW_EXPORT_VERSION),
  exportedAt: z.string(),
  show: z.object({
    name: z.string().min(1).max(255),
    description: z.string().nullable().optional(),
  }),
  cues: z.array(cueExportSchema).default([]),
  cueLists: z.array(cueListExportSchema).default([]),
});

export type ShowExportBundle = z.infer<typeof showExportBundleSchema>;

type SegmentClient = {
  wledSegment: {
    findMany: (args: {
      where: { id: { in: number[] } };
      select: { id: true; deviceId: true };
    }) => Promise<Array<{ id: number; deviceId: number }>>;
  };
};

async function buildCueStepDevicesCreate(
  client: SegmentClient,
  stepDeviceIds: number[],
  stepSegmentTargets: number[]
): Promise<Array<{ deviceId: number; wledSegmentId: number | null }>> {
  const rows: Array<{ deviceId: number; wledSegmentId: number | null }> = stepDeviceIds.map(
    (deviceId) => ({ deviceId, wledSegmentId: null })
  );
  if (stepSegmentTargets.length > 0) {
    const segments = await client.wledSegment.findMany({
      where: { id: { in: stepSegmentTargets } },
      select: { id: true, deviceId: true },
    });
    for (const s of segments) {
      rows.push({ deviceId: s.deviceId, wledSegmentId: s.id });
    }
  }
  return rows;
}

async function findDeviceByIp(ipRaw: string) {
  const trimmed = ipRaw.trim();
  let device = await prisma.device.findUnique({ where: { ipAddress: trimmed } });
  if (!device) {
    device =
      (await prisma.device.findFirst({
        where: { ipAddress: { equals: trimmed, mode: "insensitive" } },
      })) ?? null;
  }
  return device;
}

async function findArtNetNodeByIp(ipRaw: string) {
  const trimmed = ipRaw.trim();
  let node = await prisma.artNetNode.findUnique({ where: { ipAddress: trimmed } });
  if (!node) {
    node =
      (await prisma.artNetNode.findFirst({
        where: { ipAddress: { equals: trimmed, mode: "insensitive" } },
      })) ?? null;
  }
  return node;
}

export async function exportShowToBundle(showId: number): Promise<ShowExportBundle | null> {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      cues: {
        orderBy: { id: "asc" },
        include: {
          cueSteps: {
            orderBy: { order: "asc" },
            include: {
              cueStepDevices: {
                include: {
                  device: true,
                  wledSegment: true,
                },
              },
              cueStepFixtures: {
                include: {
                  fixture: {
                    include: { artNetNode: true },
                  },
                },
              },
            },
          },
        },
      },
      cueLists: {
        orderBy: { id: "asc" },
        include: {
          cueListCues: {
            orderBy: { order: "asc" },
            include: { cue: true },
          },
        },
      },
    },
  });

  if (!show) return null;

  const sortedCues = [...show.cues].sort((a, b) => a.id - b.id);
  const cueIdToExportKey = new Map<number, string>();
  sortedCues.forEach((cue, i) => {
    cueIdToExportKey.set(cue.id, `cue-${i}`);
  });

  const cues: ShowExportBundle["cues"] = sortedCues.map((cue) => ({
    exportKey: cueIdToExportKey.get(cue.id)!,
    name: cue.name,
    description: cue.description ?? null,
    steps: cue.cueSteps.map((step) => {
      const cueStepFixtures = step.cueStepFixtures.map((csf) => {
        const f = csf.fixture;
        const node = f.artNetNode;
        const vals = csf.dmxChannelValues ?? [];
        return {
          artNetNodeIp: node.ipAddress,
          artNetNodeName: node.name,
          fixtureName: f.name,
          startAddress: f.startAddress,
          channelCount: f.channelCount,
          channelPurposes: (f.channelPurposes as string[]) ?? [],
          dmxChannelValues: [...vals],
        };
      });

      const cueStepDevices = step.cueStepDevices.map((csd) => ({
        deviceIp: csd.device.ipAddress,
        deviceName: csd.device.name,
        wledSegmentIndex: csd.wledSegment ? csd.wledSegment.wledSegmentIndex : null,
        segmentName: csd.wledSegment ? csd.wledSegment.name : null,
      }));

      return {
        order: step.order,
        targetColor:
          step.targetColor.length >= 4
            ? ([step.targetColor[0], step.targetColor[1], step.targetColor[2], step.targetColor[3]] as [
                number,
                number,
                number,
                number,
              ])
            : null,
        targetBrightness: step.targetBrightness,
        startColor: step.startColor ?? [],
        startBrightness: step.startBrightness,
        turnOff: step.turnOff,
        useWledEffect: step.useWledEffect,
        wledEffectId: step.wledEffectId,
        wledEffectSpeed: step.wledEffectSpeed,
        wledEffectIntensity: step.wledEffectIntensity,
        wledPaletteId: step.wledPaletteId,
        cueStepDevices,
        cueStepFixtures,
      };
    }),
  }));

  const cueLists: ShowExportBundle["cueLists"] = show.cueLists.map((cl) => ({
    name: cl.name,
    description: cl.description ?? null,
    currentPosition: cl.currentPosition,
    cueListCues: cl.cueListCues.map((clc) => ({
      order: clc.order,
      cueExportKey: cueIdToExportKey.get(clc.cueId) ?? `cue-missing-${clc.cueId}`,
      fadeInSeconds: Number(clc.fadeInSeconds),
      fadeOutSeconds: Number(clc.fadeOutSeconds),
      durationSeconds: clc.durationSeconds != null ? Number(clc.durationSeconds) : null,
      repeatIntervalSeconds: Number(clc.repeatIntervalSeconds),
      repeatTotalPlays: clc.repeatTotalPlays,
    })),
  }));

  return {
    format: SHOW_EXPORT_FORMAT,
    version: SHOW_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    show: {
      name: show.name,
      description: show.description ?? null,
    },
    cues,
    cueLists,
  };
}

export interface ImportShowResult {
  showId: number;
  cueCount: number;
  cueListCount: number;
}

export async function importShowBundle(
  bundle: ShowExportBundle,
  options?: { nameSuffix?: string }
): Promise<ImportShowResult> {
  const suffix = options?.nameSuffix?.trim() ?? "";

  const errors: string[] = [];

  type ResolvedStep = {
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
    deviceIds: number[];
    segmentTargets: number[];
    fixtureIds: number[];
    fixtureDmx: Array<{ fixtureId: number; values: number[] }>;
  };

  const resolveStep = async (step: z.infer<typeof cueStepExportSchema>): Promise<ResolvedStep | null> => {
    const deviceIds: number[] = [];
    const segmentTargets: number[] = [];

    for (const row of step.cueStepDevices) {
      const device = await findDeviceByIp(row.deviceIp);
      if (!device) {
        errors.push(`No WLED device with IP "${row.deviceIp}" (needed for "${row.deviceName ?? "target"}")`);
        return null;
      }
      if (row.wledSegmentIndex == null) {
        deviceIds.push(device.id);
      } else {
        const seg = await prisma.wledSegment.findFirst({
          where: {
            deviceId: device.id,
            wledSegmentIndex: row.wledSegmentIndex,
          },
        });
        if (!seg) {
          errors.push(
            `No segment index ${row.wledSegmentIndex} on device "${device.name}" (${row.deviceIp})`
          );
          return null;
        }
        segmentTargets.push(seg.id);
      }
    }

    const fixtureIds: number[] = [];
    const fixtureDmx: Array<{ fixtureId: number; values: number[] }> = [];

    for (let fi = 0; fi < step.cueStepFixtures.length; fi++) {
      const fx = step.cueStepFixtures[fi];
      const node = await findArtNetNodeByIp(fx.artNetNodeIp);
      if (!node) {
        errors.push(`No Art-Net node with IP "${fx.artNetNodeIp}" (fixture "${fx.fixtureName}")`);
        return null;
      }
      const fixture = await prisma.dmxFixture.findFirst({
        where: {
          artNetNodeId: node.id,
          startAddress: fx.startAddress,
          channelCount: fx.channelCount,
        },
      });
      if (!fixture) {
        errors.push(
          `No DMX fixture on ${fx.artNetNodeIp} at address ${fx.startAddress} with ${fx.channelCount} channels ("${fx.fixtureName}")`
        );
        return null;
      }
      fixtureIds.push(fixture.id);
      const vals = fx.dmxChannelValues ?? [];
      if (vals.length > 0 && vals.length === fixture.channelCount) {
        fixtureDmx.push({ fixtureId: fixture.id, values: vals });
      }
    }

    if (step.fixtureDmx && step.fixtureDmx.length > 0) {
      for (const ov of step.fixtureDmx) {
        const idx = ov.fixtureIndex;
        if (idx < 0 || idx >= fixtureIds.length) {
          errors.push(`fixtureDmx fixtureIndex ${idx} out of range`);
          return null;
        }
        const fid = fixtureIds[idx];
        const fixture = await prisma.dmxFixture.findUnique({ where: { id: fid } });
        if (!fixture || ov.values.length !== fixture.channelCount) {
          errors.push(`fixtureDmx values for fixture index ${idx} must have length ${fixture?.channelCount ?? "?"}`);
          return null;
        }
        const existing = fixtureDmx.findIndex((x) => x.fixtureId === fid);
        if (existing >= 0) fixtureDmx.splice(existing, 1);
        fixtureDmx.push({ fixtureId: fid, values: ov.values });
      }
    }

    return {
      order: step.order,
      targetColor: step.targetColor?.length === 4 ? [...step.targetColor] : [],
      targetBrightness: step.targetBrightness ?? null,
      startColor: step.startColor?.length === 4 ? [...step.startColor] : [],
      startBrightness: step.startBrightness ?? null,
      turnOff: step.turnOff ?? false,
      useWledEffect: step.useWledEffect ?? false,
      wledEffectId: step.wledEffectId ?? null,
      wledEffectSpeed: step.wledEffectSpeed ?? null,
      wledEffectIntensity: step.wledEffectIntensity ?? null,
      wledPaletteId: step.wledPaletteId ?? null,
      deviceIds,
      segmentTargets,
      fixtureIds,
      fixtureDmx,
    };
  };

  const resolvedCues: Array<{
    exportKey: string;
    name: string;
    description: string | null;
    steps: ResolvedStep[];
  }> = [];

  for (const cue of bundle.cues) {
    const steps: ResolvedStep[] = [];
    for (const st of cue.steps) {
      const r = await resolveStep(st);
      if (!r) {
        throw new Error(errors.join("; ") || "Failed to resolve cue step targets");
      }
      steps.push(r);
    }
    resolvedCues.push({
      exportKey: cue.exportKey,
      name: cue.name,
      description: cue.description ?? null,
      steps,
    });
  }

  const showName = suffix ? `${bundle.show.name}${suffix}` : bundle.show.name;

  const result = await prisma.$transaction(async (tx) => {
    const newShow = await tx.show.create({
      data: {
        name: showName.slice(0, 255),
        description: bundle.show.description ?? null,
      },
    });

    const keyToCueId = new Map<string, number>();

    for (const cue of resolvedCues) {
      const created = await tx.cue.create({
        data: {
          name: cue.name,
          description: cue.description,
          showId: newShow.id,
          cueSteps: {
            create: await Promise.all(
              cue.steps.map(async (step) => ({
                order: step.order,
                targetColor: step.targetColor,
                targetBrightness: step.targetBrightness,
                startColor: step.startColor,
                startBrightness: step.startBrightness,
                turnOff: step.turnOff,
                useWledEffect: step.useWledEffect,
                wledEffectId: step.wledEffectId,
                wledEffectSpeed: step.wledEffectSpeed,
                wledEffectIntensity: step.wledEffectIntensity,
                wledPaletteId: step.wledPaletteId,
                cueStepDevices: {
                  create: await buildCueStepDevicesCreate(tx, step.deviceIds, step.segmentTargets),
                },
                cueStepFixtures: {
                  create: step.fixtureIds.map((fixtureId) => {
                    const dmxRow = step.fixtureDmx.find((d) => d.fixtureId === fixtureId);
                    const raw = dmxRow?.values;
                    return {
                      fixtureId,
                      dmxChannelValues: raw && raw.length > 0 ? raw : [],
                    };
                  }),
                },
              }))
            ),
          },
        },
      });
      keyToCueId.set(cue.exportKey, created.id);
    }

    for (const cl of bundle.cueLists) {
      await tx.cueList.create({
        data: {
          name: cl.name,
          description: cl.description ?? null,
          showId: newShow.id,
          currentPosition: Math.min(
            cl.currentPosition,
            Math.max(0, cl.cueListCues.length - 1)
          ),
          cueListCues: {
            create: cl.cueListCues.map((e) => {
              const cueId = keyToCueId.get(e.cueExportKey);
              if (cueId == null) {
                throw new Error(`Unknown cueExportKey "${e.cueExportKey}" in cue list "${cl.name}"`);
              }
              return {
                cueId,
                order: e.order,
                fadeInSeconds: e.fadeInSeconds,
                fadeOutSeconds: e.fadeOutSeconds,
                durationSeconds: e.durationSeconds ?? null,
                repeatIntervalSeconds: e.repeatIntervalSeconds ?? 0,
                repeatTotalPlays: e.repeatTotalPlays ?? null,
              };
            }),
          },
        },
      });
    }

    return {
      showId: newShow.id,
      cueCount: resolvedCues.length,
      cueListCount: bundle.cueLists.length,
    };
  });

  return result;
}
