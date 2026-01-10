/**
 * TypeScript type definitions for WLED JSON API
 * Based on WLED API documentation: https://kno.wled.ge/interfaces/json-api/
 */

/**
 * WLED Color array format: [R, G, B, W]
 * R, G, B, W are values from 0-255
 * W is the white channel (0 if not used)
 */
export type WLEDColor = [number, number, number, number];

/**
 * WLED Segment object
 */
export interface WLEDSegment {
  id?: number;
  start: number;
  stop: number;
  len: number;
  col: [WLEDColor, WLEDColor, WLEDColor];
  fx: number;
  sx: number;
  ix: number;
  pal: number;
  sel?: boolean;
  rev?: boolean;
  on?: boolean | "t";
  cln?: number;
  cct?: number;
}

/**
 * Nightlight settings
 */
export interface WLEDNightlight {
  on: boolean;
  dur: number;
  fade: boolean;
  tbri: number;
}

/**
 * UDP sync settings
 */
export interface WLEDUDPN {
  send: boolean;
  recv: boolean;
}

/**
 * WLED State object - contains all controllable state
 */
export interface WLEDState {
  on: boolean | "t";
  bri: number;
  transition?: number;
  tt?: number;
  ps?: number;
  pl?: number;
  nl?: WLEDNightlight;
  udpn?: WLEDUDPN;
  seg?: WLEDSegment[];
  v?: boolean;
  time?: number;
  mainseg?: number;
}

/**
 * WLED LED information
 */
export interface WLEDLEDs {
  count: number;
  rgbw: boolean;
  pin: number[];
  pwr: number;
  maxpwr: number;
  maxseg: number;
}

/**
 * WLED Info object - device information (read-only)
 */
export interface WLEDInfo {
  ver: string;
  vid: number;
  leds: WLEDLEDs;
  name: string;
  udpport: number;
  live: boolean;
  fxcount: number;
  palcount: number;
  arch: string;
  core: string;
  freeheap: number;
  uptime: number;
  opt: number;
  brand: string;
  product: string;
  btype: string;
  mac: string;
}

/**
 * Complete WLED API response
 */
export interface WLEDResponse {
  state: WLEDState;
  info: WLEDInfo;
  effects?: string[];
  palettes?: string[];
}

/**
 * Partial segment update (for POST requests - segments can be partially updated)
 */
export type PartialWLEDSegment = Partial<WLEDSegment> & {
  id?: number;
  col?: [WLEDColor, WLEDColor, WLEDColor];
};

/**
 * Partial state update (for POST requests)
 */
export type WLEDStateUpdate = Partial<Omit<WLEDState, 'seg'>> & {
  seg?: PartialWLEDSegment[];
};

/**
 * Connection status types
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Error information
 */
export interface WLEDError {
  message: string;
  code?: string;
}

/**
 * Custom preset saved by the user
 */
export interface CustomPreset {
  id: string;
  name: string;
  color: WLEDColor;
  brightness: number;
  createdAt: number;
}

