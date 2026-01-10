/**
 * Backend API client for WLED Control Interface
 * Communicates with the Express backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

/**
 * API Error response
 */
export interface ApiError {
  error: string;
  details?: unknown;
}

/**
 * Device from backend API
 */
export interface Device {
  id: number;
  name: string;
  ipAddress: string;
  macAddress?: string | null;
  lastSeen?: string | null;
  deviceInfo?: unknown;
  createdAt: string;
  updatedAt: string;
}

/**
 * Preset from backend API
 */
export interface Preset {
  id: number;
  name: string;
  color: [number, number, number, number];
  brightness: number;
  deviceId?: number | null;
  userId?: number | null;
  createdAt: string;
  updatedAt: string;
  device?: {
    id: number;
    name: string;
    ipAddress: string;
  } | null;
}

/**
 * Create device request
 */
export interface CreateDeviceRequest {
  name: string;
  ipAddress: string;
  macAddress?: string | null;
  deviceInfo?: unknown;
}

/**
 * Update device request
 */
export interface UpdateDeviceRequest {
  name?: string;
  ipAddress?: string;
  macAddress?: string | null;
  deviceInfo?: unknown;
}

/**
 * Create preset request
 */
export interface CreatePresetRequest {
  name: string;
  color: [number, number, number, number];
  brightness: number;
  deviceId?: number;
  userId?: number;
}

/**
 * Update preset request
 */
export interface UpdatePresetRequest {
  name?: string;
  color?: [number, number, number, number];
  brightness?: number;
  deviceId?: number | null;
  userId?: number | null;
}

/**
 * Show from backend API
 */
export interface Show {
  id: number;
  name: string;
  description: string | null;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
  cues?: Array<{
    id: number;
    name: string;
    description: string | null;
  }>;
  cueLists?: Array<{
    id: number;
    name: string;
    description: string | null;
  }>;
}

/**
 * Create show request
 */
export interface CreateShowRequest {
  name: string;
  description?: string | null;
  userId?: number;
}

/**
 * Update show request
 */
export interface UpdateShowRequest {
  name?: string;
  description?: string | null;
  userId?: number;
}

/**
 * Helper function to handle API responses
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: `HTTP error! status: ${response.status}`,
    }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * Devices API
 */
export const devicesApi = {
  /**
   * Get all devices
   */
  async getAll(): Promise<Device[]> {
    const response = await fetch(`${API_BASE_URL}/devices`);
    return handleResponse<Device[]>(response);
  },

  /**
   * Get device by ID
   */
  async getById(id: number): Promise<Device> {
    const response = await fetch(`${API_BASE_URL}/devices/${id}`);
    return handleResponse<Device>(response);
  },

  /**
   * Create a new device
   */
  async create(device: CreateDeviceRequest): Promise<Device> {
    const response = await fetch(`${API_BASE_URL}/devices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(device),
    });
    return handleResponse<Device>(response);
  },

  /**
   * Update a device
   */
  async update(id: number, device: UpdateDeviceRequest): Promise<Device> {
    const response = await fetch(`${API_BASE_URL}/devices/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(device),
    });
    return handleResponse<Device>(response);
  },

  /**
   * Delete a device
   */
  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/devices/${id}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },

  /**
   * Update device last seen timestamp
   */
  async updateLastSeen(id: number): Promise<Device> {
    const response = await fetch(`${API_BASE_URL}/devices/${id}/seen`, {
      method: "PATCH",
    });
    return handleResponse<Device>(response);
  },
};

/**
 * Presets API
 */
export const presetsApi = {
  /**
   * Get all presets (optionally filtered by deviceId or userId)
   */
  async getAll(filters?: { deviceId?: number; userId?: number }): Promise<Preset[]> {
    const params = new URLSearchParams();
    if (filters?.deviceId !== undefined) {
      params.append("deviceId", filters.deviceId.toString());
    }
    if (filters?.userId !== undefined) {
      params.append("userId", filters.userId.toString());
    }

    const url = params.toString()
      ? `${API_BASE_URL}/presets?${params.toString()}`
      : `${API_BASE_URL}/presets`;

    const response = await fetch(url);
    return handleResponse<Preset[]>(response);
  },

  /**
   * Get preset by ID
   */
  async getById(id: number): Promise<Preset> {
    const response = await fetch(`${API_BASE_URL}/presets/${id}`);
    return handleResponse<Preset>(response);
  },

  /**
   * Create a new preset
   */
  async create(preset: CreatePresetRequest): Promise<Preset> {
    const response = await fetch(`${API_BASE_URL}/presets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preset),
    });
    return handleResponse<Preset>(response);
  },

  /**
   * Update a preset
   */
  async update(id: number, preset: UpdatePresetRequest): Promise<Preset> {
    const response = await fetch(`${API_BASE_URL}/presets/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preset),
    });
    return handleResponse<Preset>(response);
  },

  /**
   * Delete a preset
   */
  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/presets/${id}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },
};

/**
 * Cue Step Device assignment
 */
export interface CueStepDevice {
  id: number;
  deviceId: number;
  device: {
    id: number;
    name: string;
    ipAddress: string;
  };
}

/**
 * Cue Step
 */
export interface CueStep {
  id: number;
  cueId: number;
  order: number;
  timeOffset: number;
  transitionDuration: number;
  targetColor: [number, number, number, number] | null;
  targetBrightness: number | null;
  startColor: [number, number, number, number] | null;
  startBrightness: number | null;
  cueStepDevices: CueStepDevice[];
}

/**
 * Cue
 */
export interface Cue {
  id: number;
  name: string;
  description: string | null;
  showId: number;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
  show?: {
    id: number;
    name: string;
    description: string | null;
  };
  cueSteps: CueStep[];
}

/**
 * Create cue request
 */
export interface CreateCueRequest {
  name: string;
  description?: string | null;
  showId: number; // Required - cue must belong to a show
  userId?: number;
  steps: Array<{
    order: number;
    timeOffset: number;
    transitionDuration: number;
    targetColor?: [number, number, number, number] | null;
    targetBrightness?: number | null;
    startColor?: [number, number, number, number] | null;
    startBrightness?: number | null;
    deviceIds: number[];
  }>;
}

/**
 * Update cue request
 */
export interface UpdateCueRequest {
  name?: string;
  description?: string | null;
  showId?: number; // Optional - allow changing show
  userId?: number;
  steps?: Array<{
    id?: number;
    order: number;
    timeOffset: number;
    transitionDuration: number;
    targetColor?: [number, number, number, number] | null;
    targetBrightness?: number | null;
    startColor?: [number, number, number, number] | null;
    startBrightness?: number | null;
    deviceIds: number[];
  }>;
}

/**
 * Execution status
 */
export interface ExecutionStatus {
  isRunning: boolean;
  cueId: number | null;
  currentStep: number | null;
  startTime: number | null;
  totalSteps: number;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  deviceId: number;
  isConnected: boolean;
  lastPingAt: string | null; // ISO string date
  errorCount: number;
}

/**
 * Cues API
 */
export const cuesApi = {
  /**
   * Get all cues
   */
  async getAll(filters?: { userId?: number; showId?: number }): Promise<Cue[]> {
    const params = new URLSearchParams();
    if (filters?.userId !== undefined) {
      params.append("userId", filters.userId.toString());
    }
    if (filters?.showId !== undefined) {
      params.append("showId", filters.showId.toString());
    }

    const url = params.toString()
      ? `${API_BASE_URL}/cues?${params.toString()}`
      : `${API_BASE_URL}/cues`;

    const response = await fetch(url);
    return handleResponse<Cue[]>(response);
  },

  /**
   * Get cue by ID
   */
  async getById(id: number): Promise<Cue> {
    const response = await fetch(`${API_BASE_URL}/cues/${id}`);
    return handleResponse<Cue>(response);
  },

  /**
   * Create a new cue
   */
  async create(cue: CreateCueRequest): Promise<Cue> {
    const response = await fetch(`${API_BASE_URL}/cues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cue),
    });
    return handleResponse<Cue>(response);
  },

  /**
   * Update a cue
   */
  async update(id: number, cue: UpdateCueRequest): Promise<Cue> {
    console.log("[Frontend] Updating cue:", id, cue);
    const response = await fetch(`${API_BASE_URL}/cues/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cue),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error("[Frontend] Update cue error response:", errorData);
      throw new Error(errorData.details ? JSON.stringify(errorData.details) : errorData.error || "Failed to update cue");
    }
    
    return handleResponse<Cue>(response);
  },

  /**
   * Delete a cue
   */
  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cues/${id}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },

  /**
   * Execute a cue
   */
  async execute(id: number): Promise<{ message: string; cueId: number }> {
    console.log("[Frontend] Executing cue:", id);
    const response = await fetch(`${API_BASE_URL}/cues/${id}/execute`, {
      method: "POST",
    });
    const result = await handleResponse<{ message: string; cueId: number }>(response);
    console.log("[Frontend] Cue execution started:", result);
    return result;
  },
};

/**
 * Execution API
 */
export const executionApi = {
  /**
   * Get current execution status
   */
  async getStatus(): Promise<ExecutionStatus> {
    const response = await fetch(`${API_BASE_URL}/execution/status`);
    return handleResponse<ExecutionStatus>(response);
  },

  /**
   * Stop current execution
   */
  async stop(): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/execution/stop`, {
      method: "POST",
    });
    return handleResponse<{ message: string }>(response);
  },

  /**
   * Apply preset to devices
   */
  async applyPreset(presetId: number, deviceIds: number[]): Promise<{
    message: string;
    presetId: number;
    deviceIds: number[];
  }> {
    const response = await fetch(`${API_BASE_URL}/execution/apply-preset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ presetId, deviceIds }),
    });
    return handleResponse<{
      message: string;
      presetId: number;
      deviceIds: number[];
    }>(response);
  },
};

/**
 * Connection API
 */
export const connectionApi = {
  /**
   * Get connection status for all devices
   */
  async getAllStatuses(): Promise<ConnectionStatus[]> {
    const response = await fetch(`${API_BASE_URL}/devices/connection-status`);
    return handleResponse<ConnectionStatus[]>(response);
  },

  /**
   * Get connection status for a specific device
   */
  async getStatus(deviceId: number): Promise<ConnectionStatus> {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/connection-status`);
    return handleResponse<ConnectionStatus>(response);
  },

  /**
   * Force reconnection check for a device
   */
  async reconnect(deviceId: number): Promise<{
    deviceId: number;
    isConnected: boolean;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/reconnect`, {
      method: "POST",
    });
    return handleResponse<{
      deviceId: number;
      isConnected: boolean;
      message: string;
    }>(response);
  },
};

/**
 * Cue List Cue item
 */
export interface CueListCueItem {
  id: number;
  cueListId: number;
  cueId: number;
  order: number;
  createdAt: string;
  cue: {
    id: number;
    name: string;
    description: string | null;
  };
}

/**
 * Cue List
 */
export interface CueList {
  id: number;
  name: string;
  description: string | null;
  showId: number;
  userId: number | null;
  currentPosition: number;
  createdAt: string;
  updatedAt: string;
  show?: {
    id: number;
    name: string;
    description: string | null;
  };
  cueListCues: CueListCueItem[];
  currentCueId?: number | null;
}

/**
 * Create cue list request
 */
export interface CreateCueListRequest {
  name: string;
  description?: string | null;
  showId: number; // Required - cue list must belong to a show
  userId?: number;
  cueIds?: number[];
}

/**
 * Update cue list request
 */
export interface UpdateCueListRequest {
  name?: string;
  description?: string | null;
  showId?: number; // Optional - allow changing show
  userId?: number;
  cueIds?: number[];
}

/**
 * Shows API
 */
export const showsApi = {
  /**
   * Get all shows
   */
  async getAll(userId?: number): Promise<Show[]> {
    const params = new URLSearchParams();
    if (userId !== undefined) {
      params.append("userId", userId.toString());
    }

    const url = params.toString()
      ? `${API_BASE_URL}/shows?${params.toString()}`
      : `${API_BASE_URL}/shows`;

    const response = await fetch(url);
    return handleResponse<Show[]>(response);
  },

  /**
   * Get show by ID
   */
  async getById(id: number): Promise<Show> {
    const response = await fetch(`${API_BASE_URL}/shows/${id}`);
    return handleResponse<Show>(response);
  },

  /**
   * Create a new show
   */
  async create(show: CreateShowRequest): Promise<Show> {
    const response = await fetch(`${API_BASE_URL}/shows`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(show),
    });
    return handleResponse<Show>(response);
  },

  /**
   * Update a show
   */
  async update(id: number, show: UpdateShowRequest): Promise<Show> {
    const response = await fetch(`${API_BASE_URL}/shows/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(show),
    });
    return handleResponse<Show>(response);
  },

  /**
   * Delete a show
   */
  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/shows/${id}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },
};

/**
 * Cue Lists API
 */
export const cueListsApi = {
  /**
   * Get all cue lists
   */
  async getAll(filters?: { userId?: number; showId?: number }): Promise<CueList[]> {
    const params = new URLSearchParams();
    if (filters?.userId !== undefined) {
      params.append("userId", filters.userId.toString());
    }
    if (filters?.showId !== undefined) {
      params.append("showId", filters.showId.toString());
    }

    const url = params.toString()
      ? `${API_BASE_URL}/cue-lists?${params.toString()}`
      : `${API_BASE_URL}/cue-lists`;

    const response = await fetch(url);
    return handleResponse<CueList[]>(response);
  },

  /**
   * Get cue list by ID
   */
  async getById(id: number): Promise<CueList> {
    const response = await fetch(`${API_BASE_URL}/cue-lists/${id}`);
    return handleResponse<CueList>(response);
  },

  /**
   * Create a new cue list
   */
  async create(cueList: CreateCueListRequest): Promise<CueList> {
    const response = await fetch(`${API_BASE_URL}/cue-lists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cueList),
    });
    return handleResponse<CueList>(response);
  },

  /**
   * Update a cue list
   */
  async update(id: number, cueList: UpdateCueListRequest): Promise<CueList> {
    const response = await fetch(`${API_BASE_URL}/cue-lists/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cueList),
    });
    return handleResponse<CueList>(response);
  },

  /**
   * Delete a cue list
   */
  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cue-lists/${id}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },

  /**
   * Step forward to next cue in list
   */
  async stepForward(id: number): Promise<CueList> {
    const response = await fetch(`${API_BASE_URL}/cue-lists/${id}/step-forward`, {
      method: "POST",
    });
    return handleResponse<CueList>(response);
  },

  /**
   * Step backward to previous cue in list
   */
  async stepBackward(id: number): Promise<CueList> {
    const response = await fetch(`${API_BASE_URL}/cue-lists/${id}/step-backward`, {
      method: "POST",
    });
    return handleResponse<CueList>(response);
  },

  /**
   * Go to a specific position in the list
   */
  async goTo(id: number, position: number): Promise<CueList> {
    const response = await fetch(`${API_BASE_URL}/cue-lists/${id}/go-to`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ position }),
    });
    return handleResponse<CueList>(response);
  },
};

