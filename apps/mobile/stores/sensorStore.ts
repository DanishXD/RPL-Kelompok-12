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

  // ── Dipanggil saat data sensor baru masuk (polling / WebSocket) ─────────────
  setSensorData: (data) => {
    const config    = useThresholdStore.getState().config;
    const triggered: AlertData['alerts'] = [];

    // Cek setiap field sensor terhadap threshold user
    (['temperature', 'phLevel', 'feedLevel'] as const).forEach(field => {
      const value = data[field];
      if (value === undefined) return;
      const result = checkThreshold(field, value, config);
      if (result.triggered && result.status) {
        triggered.push({ field, value, status: result.status });
      }
    });

    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (triggered.length > 0) {
      // Cek apakah alert untuk timestamp yang sama sudah pernah dikirim
      const currentTimestamp = data.timestamp;
      const lastTimestamp    = useSensorStore.getState().data?.timestamp;

      const isNewData = currentTimestamp !== lastTimestamp;

      if (isNewData) {
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

        const alertData: AlertData = {
          deviceId:  data.deviceId,
          alerts:    triggered,
          timestamp: new Date().toISOString(),
        };

        set(state => ({
          data,
          lastUpdated: now,
          alerts: [alertData, ...state.alerts].slice(0, 20),
        }));
        return;
      }
    }

    // Update tampilan saja, tidak kirim notifikasi
    set({ data, lastUpdated: now });
  },

  // ── Dipanggil saat alert masuk dari WebSocket backend ──────────────────────
  addAlert: (alert) => {
    const config = useThresholdStore.getState().config;

    // Filter hanya alert yang benar-benar melewati threshold user
    const filtered = alert.alerts.filter(a => {
      const result = checkThreshold(
        a.field as 'temperature' | 'phLevel' | 'feedLevel',
        a.value,
        config
      );
      return result.triggered;
    });

    if (filtered.length === 0) return;  // tidak melewati threshold user

    const messages = filtered.map(a => {
      const label = a.field === 'temperature' ? 'Suhu'
        : a.field === 'phLevel' ? 'pH Air' : 'Level Pakan';
      return `${label} ${a.status === 'high' ? 'terlalu tinggi' : 'terlalu rendah'} (${a.value})`;
    });

    const isCritical = filtered.some(a =>
      (a.field === 'feedLevel'   && a.value < config.feedMin * 0.5) ||
      (a.field === 'temperature' && (a.value > config.tempMax + 4 || a.value < config.tempMin - 4)) ||
      (a.field === 'phLevel'     && (a.value > config.phMax + 1   || a.value < config.phMin - 1))
    );

    sendLocalNotification(
      isCritical ? '🚨 Alert Kritis EcoSmart' : '⚠️ Peringatan EcoSmart',
      messages.join(', ')
    );

    const filteredAlert: AlertData = { ...alert, alerts: filtered };
    set(s => ({ alerts: [filteredAlert, ...s.alerts].slice(0, 20) }));
  },

  dismissAlert:    (index) => set(s => ({ alerts: s.alerts.filter((_, i) => i !== index) })),
  setConnected:    (v)              => set({ isConnected: v }),
  setActiveDevice: (activeDeviceId) => set({ activeDeviceId }),
  reset:           ()               => set({ data: null, alerts: [], isConnected: false, lastUpdated: null }),
}));
