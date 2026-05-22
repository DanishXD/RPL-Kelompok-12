import { create } from 'zustand';
import { sendLocalNotification } from '../hooks/usePushNotification';

export interface SensorData {
  deviceId:     string;
  temperature?: number;
  phLevel?:     number;
  feedLevel?:   number;
  lightLevel?:  number;
  timestamp:    string;
}

export interface AlertData {
  deviceId:  string;
  alerts:    Array<{ field: string; value: number; status: 'low' | 'high' }>;
  timestamp: string;
}

interface SensorState {
  data:           SensorData | null;
  alerts:         AlertData[];
  isConnected:    boolean;
  lastUpdated:    string | null;
  activeDeviceId: string | null;
  setSensorData:   (data: SensorData) => void;
  addAlert:        (alert: AlertData) => void;
  dismissAlert:    (index: number) => void;
  setConnected:    (v: boolean) => void;
  setActiveDevice: (deviceId: string) => void;
  reset:           () => void;
}

export const useSensorStore = create<SensorState>((set) => ({
  data:           null,
  alerts:         [],
  isConnected:    false,
  lastUpdated:    null,
  activeDeviceId: null,

  setSensorData: (data) => set({
    data,
    lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  }),

  addAlert: (alert) => {
    // Kirim local notification langsung saat alert masuk dari WebSocket
    const messages = alert.alerts.map((a) => {
      const label =
        a.field === 'temperature' ? 'Suhu'
        : a.field === 'phLevel'   ? 'pH Air'
        : 'Level Pakan';
      const dir = a.status === 'high' ? 'terlalu tinggi' : 'terlalu rendah';
      return `${label} ${dir} (${a.value})`;
    });

    const isCritical = alert.alerts.some(
      (a) =>
        (a.field === 'feedLevel'   && a.value < 10) ||
        (a.field === 'temperature' && (a.value > 34 || a.value < 22))
    );

    sendLocalNotification(
      isCritical ? '🚨 Alert Kritis EcoSmart' : '⚠️ Peringatan EcoSmart',
      messages.join(', ')
    );

    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 20),
    }));
  },

  dismissAlert: (index) => set((state) => ({
    alerts: state.alerts.filter((_, i) => i !== index),
  })),

  setConnected:    (isConnected)    => set({ isConnected }),
  setActiveDevice: (activeDeviceId) => set({ activeDeviceId }),
  reset:           () => set({ data: null, alerts: [], isConnected: false, lastUpdated: null }),
}));
