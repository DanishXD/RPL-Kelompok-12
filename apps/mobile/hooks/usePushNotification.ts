import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

// ── Tampilkan notifikasi saat app di foreground ───────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ── Minta izin notifikasi ─────────────────────────────────────────────────────
async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Kirim local notification langsung ────────────────────────────────────────
export async function sendLocalNotification(title: string, body: string) {
  const granted = await requestPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // tampil langsung
  });
}

// ── Hook: setup listener tap notifikasi ──────────────────────────────────────
// Pemanggilan notifikasi dilakukan langsung dari sensorStore.addAlert()
// sehingga tidak ada race condition
export function usePushNotification(_deviceId: string | null) {
  const tapListenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Minta izin saat pertama kali mount
    requestPermission();

    // Listener: user tap notifikasi → bisa navigasi ke alerts
    tapListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Notifikasi di-tap:', response.notification.request.content.title);
        // TODO: router.push('/(app)/alerts')
      }
    );

    return () => {
      tapListenerRef.current?.remove();
    };
  }, []);
}
