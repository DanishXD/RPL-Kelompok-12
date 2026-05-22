import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEYS } from '../lib/api';
import { useSensorStore } from '../stores/sensorStore';

// ── Ganti IP sesuai komputer kamu ─────────────────────────────────────────────
// Emulator Android  → 10.0.2.2
// HP fisik / Expo Go → IP komputer (ipconfig)
const SOCKET_URL = 'http://192.168.1.42:3000';

const EVENTS = {
  SENSOR_UPDATE:   'sensor:update',
  ALERT_TRIGGERED: 'alert:triggered',
  DEVICE_STATUS:   'device:status',
  JOIN_DEVICE:     'join:device',
  REQUEST_LATEST:  'request:latest',
} as const;

export function useWebSocket(deviceId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const { setSensorData, addAlert, setConnected, setActiveDevice } = useSensorStore();

  const connect = useCallback(async () => {
    if (!deviceId || socketRef.current?.connected) return;

    const token = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);

    const socket = io(SOCKET_URL, {
      auth:                 { token },
      reconnectionDelay:    1000,
      reconnectionAttempts: 10,
      timeout:              10_000,
      transports:           ['websocket'],
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket connected, joining device room:', deviceId);
      setConnected(true);
      setActiveDevice(deviceId);
      socket.emit(EVENTS.JOIN_DEVICE,    deviceId);
      socket.emit(EVENTS.REQUEST_LATEST, deviceId);
    });

    socket.on('joined', (info) => {
      console.log('🏠 Joined room:', info);
    });

    socket.on(EVENTS.SENSOR_UPDATE,   (data)  => {
      console.log('📊 Sensor update received:', data);
      setSensorData(data);
    });
    socket.on(EVENTS.ALERT_TRIGGERED, (alert) => {
      console.log('🚨 Alert received:', alert);
      addAlert(alert);
    });
    socket.on('error',      (err) => { console.log('❌ Socket error:', err.message ?? err); });
    socket.on('disconnect', ()    => { console.log('🔌 Disconnected'); setConnected(false); });
    socket.on('connect_error', (err) => { console.log('❌ Connect error:', err.message); setConnected(false); });

    socketRef.current = socket;
  }, [deviceId]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => { disconnect(); };
  }, [deviceId]);

  return { socket: socketRef.current, connect, disconnect };
}
