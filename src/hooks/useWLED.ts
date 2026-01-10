/**
 * Custom React hook for WLED state management
 */

import { useState, useEffect, useCallback } from "react";
import { getState, setState, getInfo, getPalettes } from "../api/wledClient";
import { getWLEDIP } from "../utils/config";
import type { WLEDInfo, WLEDColor, ConnectionStatus } from "../types/wled";

interface UseWLEDReturn {
  // State
  power: boolean;
  color: WLEDColor;
  brightness: number;
  connectionStatus: ConnectionStatus;
  deviceInfo: WLEDInfo | null;
  error: string | null;
  ip: string;
  palettes: string[];
  currentPalette: number;
  currentPreset: number | null;

  // Actions
  togglePower: () => Promise<void>;
  setColor: (color: WLEDColor) => Promise<void>;
  setBrightness: (brightness: number) => Promise<void>;
  setPalette: (paletteIndex: number) => Promise<void>;
  setPreset: (presetId: number | null) => Promise<void>;
  connect: (ip: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing WLED device state and interactions
 * @param initialIP - Initial IP address (optional, will use stored value if not provided)
 * @returns WLED state and control functions
 */
export function useWLED(initialIP?: string): UseWLEDReturn {
  const [ip, setIP] = useState<string>(initialIP || "");
  const [power, setPower] = useState<boolean>(false);
  const [color, setColorState] = useState<WLEDColor>([255, 160, 0, 0]);
  const [brightness, setBrightnessState] = useState<number>(127);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [deviceInfo, setDeviceInfo] = useState<WLEDInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [palettes, setPalettes] = useState<string[]>([]);
  const [currentPalette, setCurrentPaletteState] = useState<number>(0);
  const [currentPreset, setCurrentPresetState] = useState<number | null>(null);

  // Load IP address from storage on mount
  useEffect(() => {
    const loadIP = async () => {
      if (!initialIP) {
        try {
          const storedIP = await getWLEDIP();
          if (storedIP) {
            setIP(storedIP);
          }
        } catch (err) {
          console.error("Failed to load IP address:", err);
        }
      }
    };
    loadIP();
  }, [initialIP]);

  /**
   * Fetches current state from WLED device
   */
  const fetchState = useCallback(async () => {
    if (!ip || ip.trim() === "") {
      setConnectionStatus("disconnected");
      return;
    }

    try {
      setConnectionStatus("connecting");
      setError(null);

      const [state, info, palettesList] = await Promise.all([
        getState(ip),
        getInfo(ip),
        getPalettes(ip).catch(() => []), // Fallback to empty array if palettes fail
      ]);

      setPower(state.on === true);
      setBrightnessState(state.bri);

      // Extract color from first segment, default to [255, 160, 0, 0] if no segments
      if (state.seg && state.seg.length > 0 && state.seg[0].col && state.seg[0].col[0]) {
        setColorState(state.seg[0].col[0]);
      }

      // Extract palette index from first segment
      if (state.seg && state.seg.length > 0 && typeof state.seg[0].pal === "number") {
        setCurrentPaletteState(state.seg[0].pal);
      }

      // Extract preset ID (ps property)
      if (typeof state.ps === "number" && state.ps >= 0) {
        setCurrentPresetState(state.ps);
      } else {
        setCurrentPresetState(null);
      }

      setPalettes(palettesList);
      setDeviceInfo(info);
      setConnectionStatus("connected");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to WLED device";
      setError(errorMessage);
      setConnectionStatus("error");
      setDeviceInfo(null);
    }
  }, [ip]);

  /**
   * Connects to a WLED device at the specified IP
   */
  const connect = useCallback(async (newIP: string) => {
    setIP(newIP);
    // fetchState will be called by useEffect when ip changes
  }, []);

  /**
   * Toggles power on/off
   */
  const togglePower = useCallback(async () => {
    if (!ip || ip.trim() === "") {
      setError("IP address not configured");
      return;
    }

    try {
      setError(null);
      // Use WLED's toggle value "t" to toggle the state
      await setState(ip, { on: "t" });
      // Fetch the updated state to ensure we have the correct value
      const updatedState = await getState(ip);
      setPower(updatedState.on === true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to toggle power";
      setError(errorMessage);
      setConnectionStatus("error");
    }
  }, [ip]);

  /**
   * Sets the color of the first segment
   */
  const setColor = useCallback(async (newColor: WLEDColor) => {
    if (!ip || ip.trim() === "") {
      setError("IP address not configured");
      return;
    }

    try {
      setError(null);
      // Update first segment's color
      const stateUpdate = {
        seg: [
          {
            id: 0,
            col: [newColor, [0, 0, 0, 0], [0, 0, 0, 0]] as [WLEDColor, WLEDColor, WLEDColor],
          },
        ],
      };
      await setState(ip, stateUpdate);
      setColorState(newColor);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to set color";
      setError(errorMessage);
      setConnectionStatus("error");
    }
  }, [ip]);

  /**
   * Sets the brightness
   */
  const setBrightness = useCallback(async (newBrightness: number) => {
    if (!ip || ip.trim() === "") {
      setError("IP address not configured");
      return;
    }

    try {
      setError(null);
      const clampedBrightness = Math.max(1, Math.min(255, newBrightness));
      const state = await setState(ip, { bri: clampedBrightness });
      setBrightnessState(state.bri);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to set brightness";
      setError(errorMessage);
      setConnectionStatus("error");
    }
  }, [ip]);

  /**
   * Sets the palette for the first segment
   */
  const setPalette = useCallback(async (paletteIndex: number) => {
    if (!ip || ip.trim() === "") {
      setError("IP address not configured");
      return;
    }

    try {
      setError(null);
      // Update first segment's palette
      const stateUpdate = {
        seg: [
          {
            id: 0,
            pal: paletteIndex,
          },
        ],
      };
      const updatedState = await setState(ip, stateUpdate);
      // Update state from response
      if (updatedState.seg && updatedState.seg.length > 0 && typeof updatedState.seg[0].pal === "number") {
        setCurrentPaletteState(updatedState.seg[0].pal);
      } else {
        setCurrentPaletteState(paletteIndex);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to set palette";
      setError(errorMessage);
      setConnectionStatus("error");
    }
  }, [ip]);

  /**
   * Applies a preset (or clears it if null)
   */
  const setPreset = useCallback(async (presetId: number | null) => {
    if (!ip || ip.trim() === "") {
      setError("IP address not configured");
      return;
    }

    try {
      setError(null);
      // Set preset ID, -1 to clear preset
      const presetValue = presetId === null ? -1 : presetId;
      await setState(ip, { ps: presetValue });
      setCurrentPresetState(presetId);
      // Refresh state to get all changes from preset
      await fetchState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to set preset";
      setError(errorMessage);
      setConnectionStatus("error");
    }
  }, [ip, fetchState]);

  /**
   * Refreshes state from device
   */
  const refresh = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  // Auto-connect when IP changes
  useEffect(() => {
    if (ip && ip.trim() !== "") {
      fetchState();
    } else {
      setConnectionStatus("disconnected");
      setDeviceInfo(null);
    }
  }, [ip, fetchState]);

  return {
    power,
    color,
    brightness,
    connectionStatus,
    deviceInfo,
    error,
    ip,
    palettes,
    currentPalette,
    currentPreset,
    togglePower,
    setColor,
    setBrightness,
    setPalette,
    setPreset,
    connect,
    refresh,
  };
}

