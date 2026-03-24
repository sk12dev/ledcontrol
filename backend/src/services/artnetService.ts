/**
 * Art-Net Service
 * Handles sending DMX data to Art-Net nodes via UDP
 */

import { createRequire } from "module";
import { prisma } from "../lib/prisma.js";

const require = createRequire(import.meta.url);
const dmxlib = require("dmxnet") as { dmxnet: new (opts?: object) => { newSender: (opts: object) => Sender } };

interface Sender {
  prepChannel(channel: number, value: number): void;
  transmit(): void;
}

// Singleton dmxnet instance (dmxnet types are loose in @types)
let dmxnetInstance: { newSender: (opts: object) => Sender } | null = null;

// Cache senders by node key: ip_subnet_universe
const senderCache = new Map<string, Sender>();

/** Last outgoing DMX per universe (for /dmx-monitor). Key matches sender cache. */
const universeShadow = new Map<string, Uint8Array>();

function getOrCreateShadow(ip: string, subnet: number, universe: number): Uint8Array {
  const key = getSenderKey(ip, subnet, universe);
  let buf = universeShadow.get(key);
  if (!buf) {
    buf = new Uint8Array(512);
    universeShadow.set(key, buf);
  }
  return buf;
}

/**
 * Snapshot of 512 channel values (0–255) last sent for this universe, or zeros if never sent.
 */
export function getUniverseShadowSnapshot(
  ip: string,
  subnet: number,
  universe: number
): number[] {
  const buf = universeShadow.get(getSenderKey(ip, subnet, universe));
  if (!buf) {
    return Array.from({ length: 512 }, () => 0);
  }
  return Array.from(buf);
}

function getDmxNet() {
  if (!dmxnetInstance) {
    dmxnetInstance = new dmxlib.dmxnet({
      log: { level: "error" },
      sName: "LedControl",
      lName: "LedControl Art-Net Controller",
    });
  }
  return dmxnetInstance;
}

function getSenderKey(ip: string, subnet: number, universe: number): string {
  return `${ip}_${subnet}_${universe}`;
}

function getSender(ip: string, subnet: number, universe: number) {
  const key = getSenderKey(ip, subnet, universe);
  if (senderCache.has(key)) {
    return senderCache.get(key)!;
  }
  const dmxnet = getDmxNet();
  const sender = dmxnet.newSender({
    ip,
    subnet,
    universe,
    net: 0,
    port: 6454,
    base_refresh_interval: 1000,
  });
  senderCache.set(key, sender);
  return sender;
}

/**
 * Build channel values from cue step color/brightness using fixture's channelPurposes
 */
export function buildFixtureChannelValues(
  channelPurposes: string[],
  targetColor: number[],
  targetBrightness: number | null,
  turnOff: boolean
): number[] {
  const [r = 0, g = 0, b = 0, w = 0] = targetColor;
  const values: number[] = new Array(channelPurposes.length).fill(0);

  const brightness = targetBrightness ?? 255;
  const scale = turnOff ? 0 : brightness / 255;

  for (let i = 0; i < channelPurposes.length; i++) {
    const purpose = (channelPurposes[i] || "").toLowerCase();
    let val = 0;

    switch (purpose) {
      case "red":
        val = Math.round(r * scale);
        break;
      case "green":
        val = Math.round(g * scale);
        break;
      case "blue":
        val = Math.round(b * scale);
        break;
      case "white":
      case "alpha":
        val = Math.round(w * scale);
        break;
      case "amber":
        val = Math.round(((r + g) / 2) * scale);
        break;
      case "uv":
        val = Math.round(((b + w) / 2) * scale);
        break;
      case "dimmer":
        val = turnOff ? 0 : brightness;
        break;
      case "strobe":
      case "pan":
      case "tilt":
      case "custom":
      default:
        val = 0;
        break;
    }

    values[i] = Math.max(0, Math.min(255, val));
  }

  return values;
}

/**
 * Send DMX channel values to a fixture
 */
export async function sendFixtureDmx(
  fixtureId: number,
  channelValues: number[]
): Promise<void> {
  const fixture = await prisma.dmxFixture.findUnique({
    where: { id: fixtureId },
    include: { artNetNode: true },
  });

  if (!fixture) {
    throw new Error(`Fixture with id ${fixtureId} not found`);
  }

  const { artNetNode, startAddress, channelCount } = fixture;

  if (!artNetNode) {
    throw new Error(`Fixture ${fixtureId} has no Art-Net node assigned`);
  }

  if (channelValues.length !== channelCount) {
    throw new Error(
      `Channel values length (${channelValues.length}) does not match fixture channel count (${channelCount})`
    );
  }

  if (startAddress + channelCount - 1 > 512) {
    throw new Error(`Fixture channels exceed DMX 512 limit`);
  }

  const sender = getSender(
    artNetNode.ipAddress,
    artNetNode.subnet,
    artNetNode.universe
  );

  const shadow = getOrCreateShadow(
    artNetNode.ipAddress,
    artNetNode.subnet,
    artNetNode.universe
  );

  // dmxnet uses 0-indexed channels (0-511), DMX uses 1-512
  for (let i = 0; i < channelValues.length; i++) {
    const dmxChannel = startAddress - 1 + i; // convert to 0-indexed
    const value = Math.max(0, Math.min(255, channelValues[i]));
    shadow[dmxChannel] = value;
    sender.prepChannel(dmxChannel, value);
  }

  sender.transmit();

  // Verification: set DEBUG_ARTNET=1 to log each DMX send (backend terminal)
  if (process.env.DEBUG_ARTNET === "1" || process.env.DEBUG_ARTNET === "true") {
    const sample = channelValues.slice(0, 6);
    const sampleStr = sample.join(",") + (channelValues.length > 6 ? "..." : "");
    console.log(
      `[Art-Net] fixture ${fixtureId} "${fixture.name}" -> ${artNetNode.ipAddress} subnet=${artNetNode.subnet} universe=${artNetNode.universe} ch ${startAddress}-${startAddress + channelCount - 1} [${sampleStr}]`
    );
  }
}

/**
 * Send raw universe DMX data (low-level)
 */
export function sendUniverseDmx(
  nodeIp: string,
  subnet: number,
  universe: number,
  channelValues: number[]
): void {
  const sender = getSender(nodeIp, subnet, universe);
  const shadow = getOrCreateShadow(nodeIp, subnet, universe);

  for (let i = 0; i < channelValues.length && i < 512; i++) {
    const value = Math.max(0, Math.min(255, channelValues[i]));
    shadow[i] = value;
    sender.prepChannel(i, value);
  }
  sender.transmit();
}

/**
 * Test a fixture by sending full-on values
 */
export async function testFixture(fixtureId: number): Promise<void> {
  const fixture = await prisma.dmxFixture.findUnique({
    where: { id: fixtureId },
    include: { artNetNode: true },
  });

  if (!fixture) {
    throw new Error(`Fixture with id ${fixtureId} not found`);
  }

  const channelPurposes = fixture.channelPurposes as string[];
  const purposes = Array.isArray(channelPurposes)
    ? channelPurposes
    : Array(fixture.channelCount).fill("dimmer");

  // Full white at max brightness
  const channelValues = buildFixtureChannelValues(
    purposes,
    [255, 255, 255, 255],
    255,
    false
  );

  await sendFixtureDmx(fixtureId, channelValues);
}
