import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import ScreenHeader from '../../components/ScreenHeader';
import AIChatFAB from '../../components/AIChatFAB';
import { useSensorStore } from '../../stores/sensorStore';
import { DEVICE_KEYS } from './setup-device';
import { Colors } from '../../constants/colors';
import api from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Range    = '1h' | '24h' | '7d' | '30d';
type ChartTab = 'suhu' | 'pakan' | 'ph';

interface HistoryPoint {
  time:        string;
  temperature?: number;
  feedLevel?:  number;
  phLevel?:    number;
  lightLevel?: number;
}

interface Stats {
  avg: number;
  min: number;
  max: number;
  last: number;
}

const RANGE_OPTIONS: Range[] = ['1h', '24h', '7d', '30d'];
const RANGE_LABEL: Record<Range, string> = { '1h': '1 Jam', '24h': '24 Jam', '7d': '7 Hari', '30d': '30 Hari' };

// ── Bar Chart Component ────────────────────────────────────────────────────────

function BarChart({ data, maxVal, color }: {
  data:   { label: string; val: number }[];
  maxVal: number;
  color:  string;
}) {
  if (!data.length) return (
    <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 13, color: Colors.textMuted }}>Belum ada data historis</Text>
    </View>
  );

  return (
    <View style={chart.wrap}>
      {data.map((item, i) => {
        const barH = Math.max((item.val / maxVal) * 110, 4);
        return (
          <View key={i} style={chart.col}>
            <Text style={chart.valLabel}>
              {item.val % 1 === 0 ? item.val : item.val.toFixed(1)}
            </Text>
            <View style={[chart.bar, { height: barH, backgroundColor: color }]} />
            <Text style={chart.timeLabel}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const chart = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, paddingTop: 24 },
  col:       { alignItems: 'center', gap: 4, flex: 1 },
  bar:       { width: '70%', borderRadius: 5, minHeight: 4 },
  valLabel:  { fontSize: 9, fontWeight: '600', color: Colors.textSecondary },
  timeLabel: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },
});

// ── Format label waktu untuk sumbu X ─────────────────────────────────────────

function formatLabel(timeStr: string, range: Range): string {
  try {
    const d = new Date(timeStr);
    if (range === '1h' || range === '24h') {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MonitoringScreen() {
  const { data, isConnected, lastUpdated } = useSensorStore();

  const [deviceId,    setDeviceId]    = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<ChartTab>('suhu');
  const [range,       setRange]       = useState<Range>('24h');
  const [history,     setHistory]     = useState<HistoryPoint[]>([]);
  const [stats,       setStats]       = useState<Record<string, Stats>>({});
  const [loading,     setLoading]     = useState(false);

  // Ambil deviceId dari SecureStore
  useEffect(() => {
    SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_ID).then(id => setDeviceId(id));
  }, []);

  // Fetch data historis
  const fetchHistory = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const fieldMap: Record<ChartTab, string> = {
        suhu: 'temperature', pakan: 'feed_level', ph: 'ph_level',
      };
      const [histRes, statsRes] = await Promise.all([
        api.get(`/iot/sensors/history?deviceId=${deviceId}&range=${range}&field=${fieldMap[activeChart]}`),
        api.get(`/iot/sensors/stats?deviceId=${deviceId}&range=${range}`),
      ]);
      setHistory(histRes.data?.data ?? []);

      // Konversi stats array ke object
      const statsObj: Record<string, Stats> = {};
      (statsRes.data?.data ?? []).forEach((s: any) => {
        statsObj[s.field] = s;
      });
      setStats(statsObj);
    } catch (err) {
      console.log('⚠️ Fetch history error:', err);
    } finally {
      setLoading(false);
    }
  }, [deviceId, range, activeChart]);

  useEffect(() => {
    fetchHistory();
    // Auto-refresh setiap 30 detik
    const interval = setInterval(fetchHistory, 30_000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // Konversi data historis ke format chart
  const chartPoints = history
    .filter(p => {
      if (activeChart === 'suhu')  return p.temperature !== undefined;
      if (activeChart === 'pakan') return p.feedLevel   !== undefined;
      return p.phLevel !== undefined;
    })
    .map(p => ({
      label: formatLabel(p.time, range),
      val:   activeChart === 'suhu'  ? (p.temperature ?? 0)
           : activeChart === 'pakan' ? (p.feedLevel   ?? 0)
           : (p.phLevel ?? 0),
    }))
    .slice(-12); // max 12 bar agar tidak terlalu padat

  const chartConfig: Record<ChartTab, { color: string; maxVal: number; unit: string; statsField: string }> = {
    suhu:  { color: Colors.danger,  maxVal: 40,  unit: '°C', statsField: 'temperature' },
    pakan: { color: Colors.primary, maxVal: 100, unit: '%',  statsField: 'feed_level'  },
    ph:    { color: Colors.info,    maxVal: 14,  unit: '',   statsField: 'ph_level'    },
  };
  const cfg      = chartConfig[activeChart];
  const statData = stats[cfg.statsField];

  // Sensor rows real-time
  const sensorRows = [
    { icon: '🌡️', label: 'Suhu Udara',  value: data?.temperature !== undefined ? `${data.temperature}°C` : '—', badge: data?.temperature !== undefined ? (data.temperature > 30 ? 'Tinggi' : data.temperature < 26 ? 'Rendah' : 'Normal') : '—', color: data?.temperature !== undefined ? (data.temperature > 30 ? Colors.danger : data.temperature < 26 ? Colors.info : Colors.success) : Colors.textMuted },
    { icon: '🌾', label: 'Level Pakan', value: data?.feedLevel !== undefined ? `${data.feedLevel}%` : '—',       badge: data?.feedLevel !== undefined ? (data.feedLevel < 20 ? 'Kritis' : data.feedLevel < 40 ? 'Rendah' : 'Aman') : '—', color: data?.feedLevel !== undefined ? (data.feedLevel < 20 ? Colors.danger : data.feedLevel < 40 ? Colors.warning : Colors.success) : Colors.textMuted },
    { icon: '☀️', label: 'Cahaya (LDR)',value: data?.lightLevel !== undefined ? `${data.lightLevel} lx` : '—',  badge: data?.lightLevel !== undefined ? (data.lightLevel > 500 ? 'Terang' : 'Redup') : '—', color: Colors.warning },
    { icon: '💧', label: 'pH Air',      value: data?.phLevel !== undefined ? `${data.phLevel}` : '—',            badge: data?.phLevel !== undefined ? ((data.phLevel < 6.5 || data.phLevel > 8.5) ? 'Abnormal' : 'Normal') : '—', color: data?.phLevel !== undefined ? ((data.phLevel < 6.5 || data.phLevel > 8.5) ? Colors.danger : Colors.success) : Colors.textMuted },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Monitoring"
        subtitle="Data Sensor & Grafik Historis"
        showBack
        rightElement={
          <View style={[styles.connBadge, { backgroundColor: isConnected ? Colors.successBg : Colors.borderLight }]}>
            <View style={[styles.connDot, { backgroundColor: isConnected ? Colors.success : Colors.textMuted }]} />
            <Text style={[styles.connText, { color: isConnected ? Colors.success : Colors.textMuted }]}>
              {isConnected ? 'Live' : 'Offline'}
            </Text>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Sensor Real-time ── */}
        <Text style={styles.sectionTitle}>Sensor Real-time</Text>
        {lastUpdated && <Text style={styles.lastUpdate}>Update terakhir: {lastUpdated}</Text>}
        <View style={styles.sensorList}>
          {sensorRows.map(item => (
            <View key={item.label} style={styles.sensorRow}>
              <Text style={styles.sensorIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sensorLabel}>{item.label}</Text>
                <Text style={styles.sensorValue}>{item.value}</Text>
              </View>
              <View style={[styles.badge, { borderColor: item.color }]}>
                <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Chart tabs ── */}
        <View style={styles.tabRow}>
          {(['suhu', 'pakan', 'ph'] as ChartTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeChart === t && styles.tabActive]}
              onPress={() => setActiveChart(t)}
            >
              <Text style={[styles.tabText, activeChart === t && styles.tabTextActive]}>
                {t === 'suhu' ? '🌡️ Suhu' : t === 'pakan' ? '🌾 Pakan' : '💧 pH'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Range filter ── */}
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>
                {RANGE_LABEL[r]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Chart ── */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>
              {activeChart === 'suhu' ? `Suhu (${RANGE_LABEL[range]})`
               : activeChart === 'pakan' ? `Level Pakan (${RANGE_LABEL[range]})`
               : `pH Air (${RANGE_LABEL[range]})`}
            </Text>
            <TouchableOpacity onPress={fetchHistory} style={styles.refreshBtn}>
              <Text style={styles.refreshText}>↻ Refresh</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ height: 140, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={{ fontSize: 13, color: Colors.textMuted }}>Memuat data...</Text>
            </View>
          ) : (
            <BarChart data={chartPoints} maxVal={cfg.maxVal} color={cfg.color} />
          )}
        </View>

        {/* ── Statistik ── */}
        <Text style={styles.sectionTitle}>Statistik ({RANGE_LABEL[range]})</Text>
        <View style={styles.statsCard}>
          {[
            { label: 'Rata-rata', val: statData ? `${statData.avg}${cfg.unit}` : (data?.temperature !== undefined ? `${data.temperature}${cfg.unit}` : '—') },
            { label: 'Tertinggi', val: statData ? `${statData.max}${cfg.unit}` : '—' },
            { label: 'Terendah',  val: statData ? `${statData.min}${cfg.unit}` : '—' },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={styles.statValue}>{s.val}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {!deviceId && (
          <View style={styles.noDeviceCard}>
            <Text style={styles.noDeviceText}>
              📡 Daftarkan perangkat dulu untuk melihat data historis
            </Text>
          </View>
        )}

      </ScrollView>
      <AIChatFAB />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bgPage },
  scroll:          { padding: 16, paddingBottom: 120, gap: 12 },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  lastUpdate:      { fontSize: 12, color: Colors.textMuted, marginTop: -8 },
  connBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  connDot:         { width: 7, height: 7, borderRadius: 4 },
  connText:        { fontSize: 12, fontWeight: '600' },
  sensorList:      { gap: 10 },
  sensorRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  sensorIcon:      { fontSize: 26 },
  sensorLabel:     { fontSize: 13, color: Colors.textSecondary },
  sensorValue:     { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  badge:           { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5 },
  badgeText:       { fontSize: 12, fontWeight: '600' },
  tabRow:          { flexDirection: 'row', gap: 8 },
  tab:             { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  tabActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText:         { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive:   { color: Colors.white },
  rangeRow:        { flexDirection: 'row', gap: 8 },
  rangeBtn:        { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  rangeBtnActive:  { backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  rangeBtnText:    { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  rangeBtnTextActive: { color: Colors.primary },
  chartCard:       { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  chartHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chartTitle:      { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  refreshBtn:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: Colors.primaryBg },
  refreshText:     { fontSize: 12, fontWeight: '600', color: Colors.primary },
  statsCard:       { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  statItem:        { flex: 1, alignItems: 'center', gap: 4 },
  statLabel:       { fontSize: 12, color: Colors.textSecondary },
  statValue:       { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  statDivider:     { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  noDeviceCard:    { backgroundColor: Colors.infoBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.info },
  noDeviceText:    { fontSize: 13, color: Colors.info, textAlign: 'center' },
});
