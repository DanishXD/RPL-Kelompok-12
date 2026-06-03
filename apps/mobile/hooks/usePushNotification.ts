import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '../lib/api';

// ── Handler notifikasi saat app di foreground ─────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// ── Kirim local notification ──────────────────────────────────────────────────
export async function sendLocalNotification(title: string, body: string) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (err) {
    console.log('❌ Notification error:', err);
  }
}

// ── Hook utama ────────────────────────────────────────────────────────────────
export function usePushNotification(deviceId: string | null) {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener     = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Minta izin notifikasi saat pertama mount
    registerForPushNotifications(deviceId ?? undefined);

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (n) => console.log('🔔 Notif diterima:', n.request.content.title)
    );
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (r) => console.log('👆 Notif di-tap:', r.notification.request.content.title)
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [deviceId]);
}

async function registerForPushNotifications(deviceId?: string) {
  if (!Device.isDevice) {
    console.log('ℹ️ Push notification tidak jalan di emulator');
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('❌ Izin notifikasi ditolak');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ecosmart-alerts', {
      name:             'EcoSmart Alerts',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#1B5E37',
    });
  }

  // Daftarkan Expo push token ke backend (untuk notifikasi remote)
  if (deviceId) {
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '94eb9e5f-0d12-4abf-8e33-c0354f286463',
      });
      console.log('📲 Push Token:', tokenData.data);
      await api.post('/alerts/push-token', { pushToken: tokenData.data, deviceId });
      console.log('✅ Push token registered');
    } catch (err) {
      console.log('⚠️ Push token error (non-fatal):', err);
    }
  }
}
