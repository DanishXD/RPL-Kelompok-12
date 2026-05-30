import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEYS } from '../lib/api';
import { useSensorStore } from '../stores/sensorStore';

// Ganti IP sesuai komputer kamu
// Emulator Android → 10.0.2.2 | HP fisik → IP komputer
const SOCKET_URL = 'http://10.0.2.2:3000';

export function useWebSocket(deviceId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const { setSensorData, addAlert, setConnected, setActiveDevice } = useSensorStore();

  const connect = useCallback(async () => {
    if (!deviceId || socketRef.current?.connected) return;
    const token  = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
    const socket = io(SOCKET_URL, {
      auth: { token }, reconnectionDelay: 1000,
      reconnectionAttempts: 10, timeout: 10_000, transports: ['websocket'],
    });
    socket.on('connect', () => {
      setConnected(true); setActiveDevice(deviceId);
      socket.emit('join:device',    deviceId);
      socket.emit('request:latest', deviceId);
    });
    socket.on('sensor:update',   (data)  => setSensorData(data));
    socket.on('alert:triggered', (alert) => addAlert(alert));
    socket.on('disconnect',      ()      => setConnected(false));
    socket.on('connect_error',   ()      => setConnected(false));
    socketRef.current = socket;
  }, [deviceId]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => { connect(); return () => { disconnect(); }; }, [deviceId]);
  return { socket: socketRef.current, connect, disconnect };
}
