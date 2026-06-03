import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export function usePushNotification(deviceId: string | null) {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener     = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!deviceId) return;
    registerForPushNotifications(deviceId);
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => console.log('🔔 Notif:', n));
    responseListener.current     = Notifications.addNotificationResponseReceivedListener((r) => console.log('👆 Tap:', r));
    return () => { notificationListener.current?.remove(); responseListener.current?.remove(); };
  }, [deviceId]);
}

async function registerForPushNotifications(deviceId: string) {
  if (!Device.isDevice) { console.log('Push notification tidak jalan di emulator'); return; }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') { console.log('Izin notifikasi ditolak'); return; }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ecosmart-alerts', {
      name: 'EcoSmart Alerts', importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250], lightColor: '#1B5E37',
    });
  }
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '94eb9e5f-0d12-4abf-8e33-c0354f286463',
    });
    console.log('📲 Push Token:', tokenData.data);
    await api.post('/alerts/push-token', { pushToken: tokenData.data, deviceId });
    console.log('✅ Push token registered');
  } catch (err) { console.error('Push token error:', err); }
}
