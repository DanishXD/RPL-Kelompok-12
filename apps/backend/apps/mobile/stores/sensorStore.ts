import { create } from 'zustand';

export interface SensorData { deviceId: string; temperature?: number; phLevel?: number; feedLevel?: number; lightLevel?: number; timestamp: string; }
export interface AlertData  { deviceId: string; alerts: Array<{ field: string; value: number; status: 'low' | 'high' }>; timestamp: string; }

interface SensorState {
  data: SensorData | null; alerts: AlertData[]; isConnected: boolean;
  lastUpdated: string | null; activeDeviceId: string | null;
  setSensorData:   (data: SensorData) => void;
  addAlert:        (alert: AlertData) => void;
  dismissAlert:    (index: number) => void;
  setConnected:    (v: boolean) => void;
  setActiveDevice: (deviceId: string) => void;
  reset:           () => void;
}

export const useSensorStore = create<SensorState>((set) => ({
  data: null, alerts: [], isConnected: false, lastUpdated: null, activeDeviceId: null,
  setSensorData:   (data) => set({ data, lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }),
  addAlert:        (alert) => set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 20) })),
  dismissAlert:    (index) => set((s) => ({ alerts: s.alerts.filter((_, i) => i !== index) })),
  setConnected:    (isConnected)    => set({ isConnected }),
  setActiveDevice: (activeDeviceId) => set({ activeDeviceId }),
  reset:           () => set({ data: null, alerts: [], isConnected: false, lastUpdated: null }),
}));
