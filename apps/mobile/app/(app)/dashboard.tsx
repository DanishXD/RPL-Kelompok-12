import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useSensorStore } from '../../stores/sensorStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { usePushNotification } from '../../hooks/usePushNotification';
import { useAuthStore } from '../../stores/authStore';
import SensorCard from '../../components/SensorCard';
import AIChatFAB from '../../components/AIChatFAB';
import { DEVICE_KEYS } from './setup-device';
import { Colors } from '../../constants/colors';
import api from '../../lib/api';

function getTempStatus(t?: number): 'normal'|'warning'|'danger' {
  if (!t) return 'normal';
  if (t > 32 || t < 24) return 'danger';
  if (t > 30 || t < 26) return 'warning';
  return 'normal';
}
function getFeedStatus(f?: number): 'normal'|'warning'|'danger' {
  if (!f) return 'normal';
  if (f < 10) return 'danger';
  if (f < 20) return 'warning';
  return 'normal';
}
function getPhStatus(p?: number): 'normal'|'warning'|'danger' {
  if (!p) return 'normal';
  if (p < 6 || p > 9) return 'danger';
  if (p < 6.5 || p > 8.5) return 'warning';
  return 'normal';
}

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { data, isConnected, lastUpdated, alerts } = useSensorStore();

  // Baca deviceId dari SecureStore — tidak perlu hardcode lagi!
  const [deviceId,   setDeviceId]   = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  useEffect(() => {
    const loadDevice = async () => {
      const id   = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_ID);
      const name = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_NAME);
      setDeviceId(id);
      setDeviceName(name);
    };
    loadDevice();
  }, []);

  useWebSocket(deviceId);
  usePushNotification(deviceId);

  // Polling fallback — fetch data terbaru setiap 3 detik
  // Berjalan paralel dengan WebSocket, memastikan data selalu up to date
  const { setSensorData } = useSensorStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    const poll = async () => {
      try {
        const res = await api.get(`/iot/sensors/latest?deviceId=${deviceId}`);
        if (res.data?.data) setSensorData(res.data.data);
      } catch {
        // Gagal polling — WebSocket mungkin masih aktif, tidak masalah
      }
    };

    // Poll pertama langsung
    poll();

    // Poll setiap 3 detik
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [deviceId]);

  const tempVal  = data?.temperature !== undefined ? `${data.temperature}°C` : '—';
  const feedVal  = data?.feedLevel   !== undefined ? `${data.feedLevel}%`    : '—';
  const lightVal = data?.lightLevel  !== undefined ? `${data.lightLevel}lx`  : '—';
  const feedPct  = data?.feedLevel ?? 0;
  const feedKg   = ((feedPct / 100) * 5).toFixed(1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appName}>EcoSmart Feeder</Text>
            <Text style={styles.deviceName}>{deviceName ?? (deviceId ? 'Kandang Aktif' : 'Belum ada device')}</Text>
            <View style={styles.onlineRow}>
              <View style={[styles.onlineDot, { backgroundColor: isConnected ? Colors.accent : Colors.textMuted }]} />
              <Text style={styles.onlineText}>{isConnected ? 'Online' : 'Offline'}</Text>
              {lastUpdated && <Text style={styles.updateText}>  Update: {lastUpdated}</Text>}
            </View>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/(app)/alerts')}>
            <Text style={styles.bellIcon}>🔔</Text>
            {alerts.length > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{alerts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

          {/* No device — arahkan ke Setup Device */}
          {!deviceId && (
            <TouchableOpacity
              style={styles.noDeviceBanner}
              onPress={() => router.push('/(app)/setup-device')}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 28 }}>📡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.noDeviceTitle}>Belum ada perangkat terdaftar</Text>
                <Text style={styles.noDeviceSub}>Tap di sini untuk daftarkan ESP32 kamu →</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Loading sensor */}
          {deviceId && !data && (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.loadingText}>Menghubungkan ke sensor...</Text>
            </View>
          )}

          {/* Sensor Cards */}
          <Text style={styles.sectionTitle}>Status Sensor Real-time</Text>
          <View style={styles.sensorRow}>
            <SensorCard icon="🌡️" label="Suhu"        value={tempVal}  status={getTempStatus(data?.temperature)} />
            <SensorCard icon="🌾" label="Level Pakan" value={feedVal}  status={getFeedStatus(data?.feedLevel)} active />
            <SensorCard icon="☀️" label="Cahaya"      value={lightVal} status="normal" />
          </View>

          {/* Feed detail */}
          <View style={styles.feedCard}>
            <Text style={styles.feedCardLabel}>LEVEL PAKAN</Text>
            <View style={styles.feedCardRow}>
              <Text style={[styles.feedPercent, {
                color: getFeedStatus(data?.feedLevel) === 'danger'  ? Colors.danger
                     : getFeedStatus(data?.feedLevel) === 'warning' ? Colors.warning
                     : Colors.primary
              }]}>{feedVal}</Text>
              <Text style={styles.feedKg}>Tersisa ±{feedKg} kg</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {
                width: `${Math.min(feedPct, 100)}%` as any,
                backgroundColor: getFeedStatus(data?.feedLevel) === 'danger'  ? Colors.danger
                               : getFeedStatus(data?.feedLevel) === 'warning' ? Colors.warning
                               : Colors.primary,
              }]} />
            </View>
            <Text style={styles.feedLastText}>
              {data ? `Data terbaru: ${lastUpdated ?? '—'}` : 'Menunggu data sensor...'}
            </Text>
          </View>

          {/* pH */}
          {data?.phLevel !== undefined && (
            <View style={[styles.feedCard, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
              <Text style={{ fontSize: 30 }}>💧</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.feedCardLabel}>pH AIR</Text>
                <Text style={[styles.feedPercent, { fontSize: 26, color: getPhStatus(data.phLevel) === 'normal' ? Colors.primary : Colors.danger }]}>
                  {data.phLevel}
                </Text>
              </View>
              <View style={[styles.phBadge, { backgroundColor: getPhStatus(data.phLevel) === 'normal' ? Colors.successBg : Colors.dangerBg }]}>
                <Text style={[styles.phBadgeText, { color: getPhStatus(data.phLevel) === 'normal' ? Colors.success : Colors.danger }]}>
                  {getPhStatus(data.phLevel) === 'normal' ? 'Normal' : 'Abnormal'}
                </Text>
              </View>
            </View>
          )}

          {/* Alert banner */}
          {alerts.length > 0 && (
            <TouchableOpacity style={styles.alertBanner} onPress={() => router.push('/(app)/alerts')} activeOpacity={0.8}>
              <View style={styles.alertDot} />
              <Text style={styles.alertText} numberOfLines={1}>
                {alerts[0].alerts.map(a =>
                  `${a.field === 'temperature' ? 'Suhu' : a.field === 'phLevel' ? 'pH' : 'Pakan'} ${a.status === 'high' ? 'terlalu tinggi' : 'terlalu rendah'} (${a.value})`
                ).join(', ')}
              </Text>
              <Text style={styles.alertTime}>Baru</Text>
            </TouchableOpacity>
          )}

          {/* Aksi Cepat */}
          <Text style={styles.sectionTitle}>Aksi Cepat</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnFeedNow} onPress={() => router.push('/(app)/control')} activeOpacity={0.85}>
              <Text style={styles.btnFeedNowText}>⚡ Beri Pakan Sekarang</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSchedule} onPress={() => router.push('/(app)/control')} activeOpacity={0.85}>
              <Text style={styles.btnScheduleText}>📅 Lihat Jadwal</Text>
            </TouchableOpacity>
          </View>

          {/* Next Schedule */}
          <View style={styles.nextCard}>
            <View>
              <Text style={styles.nextLabel}>JADWAL BERIKUTNYA</Text>
              <Text style={styles.nextTime}>18:00 — 150g</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Aktif</Text>
            </View>
          </View>

        </View>
      </ScrollView>
      <AIChatFAB />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bgPage },
  scroll:         { paddingBottom: 120 },
  header:         { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  appName:        { fontSize: 22, fontWeight: '800', color: Colors.white },
  deviceName:     { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  onlineRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  onlineDot:      { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  onlineText:     { fontSize: 13, color: Colors.white, fontWeight: '600' },
  updateText:     { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  bellBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  bellIcon:       { fontSize: 20 },
  bellBadge:      { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText:  { fontSize: 9, color: Colors.white, fontWeight: '700' },
  body:           { padding: 16, gap: 14 },
  sectionTitle:   { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  sensorRow:      { flexDirection: 'row', gap: 10 },
  noDeviceBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.primaryBg, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.primary },
  noDeviceTitle:  { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  noDeviceSub:    { fontSize: 12, color: Colors.textSecondary },
  loadingCard:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  loadingText:    { fontSize: 14, color: Colors.textSecondary },
  feedCard:       { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  feedCardLabel:  { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8 },
  feedCardRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  feedPercent:    { fontSize: 32, fontWeight: '800', color: Colors.primary },
  feedKg:         { fontSize: 14, color: Colors.textSecondary },
  progressBg:     { height: 10, backgroundColor: Colors.borderLight, borderRadius: 5, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 5 },
  feedLastText:   { fontSize: 12, color: Colors.textMuted },
  phBadge:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  phBadgeText:    { fontSize: 12, fontWeight: '700' },
  alertBanner:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warningBg, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: '#FDE68A' },
  alertDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning },
  alertText:      { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '500' },
  alertTime:      { fontSize: 12, color: Colors.textMuted },
  actionRow:      { flexDirection: 'row', gap: 10 },
  btnFeedNow:     { flex: 1.4, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', elevation: 4 },
  btnFeedNowText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  btnSchedule:    { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary },
  btnScheduleText:{ fontSize: 14, fontWeight: '600', color: Colors.primary },
  nextCard:       { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  nextLabel:      { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  nextTime:       { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  activeBadge:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primary },
  activeBadgeText:{ fontSize: 13, fontWeight: '600', color: Colors.primary },
});
