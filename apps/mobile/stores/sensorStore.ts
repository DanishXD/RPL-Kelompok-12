import { create } from 'zustand';
import { sendLocalNotification } from '../hooks/usePushNotification';
import { useThresholdStore, checkThreshold } from './thresholdStore';

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

  setSensorData: (data) => {
    // Cek threshold dari store saat data sensor baru masuk
    const config = useThresholdStore.getState().config;
    const triggered: AlertData['alerts'] = [];

    (['temperature', 'phLevel', 'feedLevel'] as const).forEach(field => {
      const value = data[field];
      if (value === undefined) return;
      const result = checkThreshold(field, value, config);
      if (result.triggered && result.status) {
        triggered.push({ field, value, status: result.status });
      }
    });

    // Kalau ada yang melewati threshold → tambah alert dan kirim notifikasi
    if (triggered.length > 0) {
      const alertData: AlertData = {
        deviceId:  data.deviceId,
        alerts:    triggered,
        timestamp: new Date().toISOString(),
      };
      // Panggil addAlert langsung via set
      const messages = triggered.map(a => {
        const label = a.field === 'temperature' ? 'Suhu'
          : a.field === 'phLevel' ? 'pH Air' : 'Level Pakan';
        return `${label} ${a.status === 'high' ? 'terlalu tinggi' : 'terlalu rendah'} (${a.value})`;
      });
      const isCritical = triggered.some(a =>
        (a.field === 'feedLevel'   && a.value < config.feedMin * 0.5) ||
        (a.field === 'temperature' && (a.value > config.tempMax + 4 || a.value < config.tempMin - 4))
      );
      sendLocalNotification(
        isCritical ? '🚨 Alert Kritis EcoSmart' : '⚠️ Peringatan EcoSmart',
        messages.join(', ')
      );
      set(state => ({
        data,
        lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        alerts: [alertData, ...state.alerts].slice(0, 20),
      }));
    } else {
      set({
        data,
        lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  },

  addAlert: (alert) => {
    // Buat pesan notifikasi dari data alert
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

    // Trigger local notification
    sendLocalNotification(
      isCritical ? '🚨 Alert Kritis EcoSmart' : '⚠️ Peringatan EcoSmart',
      messages.join(', ')
    );

    set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 20) }));
  },

  dismissAlert:    (index) => set((s) => ({ alerts: s.alerts.filter((_, i) => i !== index) })),
  setConnected:    (isConnected)    => set({ isConnected }),
  setActiveDevice: (activeDeviceId) => set({ activeDeviceId }),
  reset:           () => set({ data: null, alerts: [], isConnected: false, lastUpdated: null }),
}));
