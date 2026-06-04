import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface ThresholdConfig {
  tempMax:  number;  // Suhu maksimum (°C)
  tempMin:  number;  // Suhu minimum (°C)
  feedMin:  number;  // Level pakan minimum (%)
  phMax:    number;  // pH maksimum
  phMin:    number;  // pH minimum
}

export const DEFAULT_THRESHOLD: ThresholdConfig = {
  tempMax: 32,
  tempMin: 24,
  feedMin: 20,
  phMax:   8.5,
  phMin:   6.5,
};

const STORAGE_KEY = 'ecosmart_thresholds';

interface ThresholdState {
  config: ThresholdConfig;
  setConfig: (c: ThresholdConfig) => Promise<void>;
  loadConfig: () => Promise<void>;
}

export const useThresholdStore = create<ThresholdState>((set) => ({
  config: DEFAULT_THRESHOLD,

  setConfig: async (config) => {
    set({ config });
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(config));
  },

  loadConfig: async () => {
    try {
      const saved = await SecureStore.getItemAsync(STORAGE_KEY);
      if (saved) set({ config: JSON.parse(saved) });
    } catch {}
  },
}));

// ── Helper: cek apakah nilai sensor melewati threshold ────────────────────────
export function checkThreshold(
  field: 'temperature' | 'phLevel' | 'feedLevel',
  value: number,
  config: ThresholdConfig
): { triggered: boolean; status: 'high' | 'low' | null } {
  switch (field) {
    case 'temperature':
      if (value > config.tempMax) return { triggered: true,  status: 'high' };
      if (value < config.tempMin) return { triggered: true,  status: 'low'  };
      return { triggered: false, status: null };
    case 'phLevel':
      if (value > config.phMax)   return { triggered: true,  status: 'high' };
      if (value < config.phMin)   return { triggered: true,  status: 'low'  };
      return { triggered: false, status: null };
    case 'feedLevel':
      if (value < config.feedMin) return { triggered: true,  status: 'low'  };
      return { triggered: false, status: null };
    default:
      return { triggered: false, status: null };
  }
}
