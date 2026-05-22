import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import AIChatFAB from '../../components/AIChatFAB';
import { useSensorStore } from '../../stores/sensorStore';
import { Colors } from '../../constants/colors';

const RANGE_OPTIONS = ['1J', '24J', '7H', '30H'] as const;
type Range = typeof RANGE_OPTIONS[number];

// Data dummy untuk grafik — nanti diganti dengan data real dari API
const TEMP_DATA = [
  { label: '06', val: 25 }, { label: '08', val: 26 },
  { label: '10', val: 27 }, { label: '12', val: 28 },
  { label: '14', val: 28 }, { label: '16', val: 27 },
  { label: '18', val: 26 }, { label: '20', val: 25 },
];
const FEED_DATA = [
  { label: 'Sen', val: 85 }, { label: 'Sel', val: 72 },
  { label: 'Rab', val: 60 }, { label: 'Kam', val: 74 },
  { label: 'Jum', val: 65 }, { label: 'Sab', val: 55 },
  { label: 'Min', val: 47 },
];

function BarChart({ data, maxVal, color = Colors.primary }: {
  data: { label: string; val: number }[];
  maxVal: number;
  color?: string;
}) {
  return (
    <View style={chart.wrap}>
      {data.map((item) => {
        const barH = Math.max((item.val / maxVal) * 110, 6);
        return (
          <View key={item.label} style={chart.col}>
            <Text style={chart.valLabel}>{item.val}</Text>
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
  bar:       { width: '70%', borderRadius: 5, minHeight: 6 },
  valLabel:  { fontSize: 9, fontWeight: '600', color: Colors.textSecondary },
  timeLabel: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },
});

export default function MonitoringScreen() {
  const { data, isConnected, lastUpdated } = useSensorStore();
  const [activeChart, setActiveChart] = useState<'suhu' | 'pakan'>('suhu');
  const [range, setRange] = useState<Range>('24J');

  const sensorRows = [
    {
      icon: '🌡️', label: 'Suhu Udara',
      value: data?.temperature !== undefined ? `${data.temperature}°C` : '—',
      badge: data?.temperature !== undefined
        ? (data.temperature > 30 ? 'Tinggi' : data.temperature < 26 ? 'Rendah' : 'Normal')
        : '—',
      badgeColor: data?.temperature !== undefined
        ? (data.temperature > 30 ? Colors.danger : data.temperature < 26 ? Colors.info : Colors.success)
        : Colors.textMuted,
    },
    {
      icon: '🌾', label: 'Level Pakan',
      value: data?.feedLevel !== undefined ? `${data.feedLevel}%` : '—',
      badge: data?.feedLevel !== undefined
        ? (data.feedLevel < 20 ? 'Kritis' : data.feedLevel < 40 ? 'Rendah' : 'Aman')
        : '—',
      badgeColor: data?.feedLevel !== undefined
        ? (data.feedLevel < 20 ? Colors.danger : data.feedLevel < 40 ? Colors.warning : Colors.success)
        : Colors.textMuted,
    },
    {
      icon: '☀️', label: 'Cahaya (LDR)',
      value: data?.lightLevel !== undefined ? `${data.lightLevel} lx` : '—',
      badge: data?.lightLevel !== undefined
        ? (data.lightLevel > 500 ? 'Terang' : data.lightLevel > 200 ? 'Redup' : 'Gelap')
        : '—',
      badgeColor: data?.lightLevel !== undefined
        ? (data.lightLevel > 200 ? Colors.warning : Colors.info)
        : Colors.textMuted,
    },
    {
      icon: '💧', label: 'pH Air',
      value: data?.phLevel !== undefined ? `${data.phLevel}` : '—',
      badge: data?.phLevel !== undefined
        ? (data.phLevel < 6.5 || data.phLevel > 8.5 ? 'Abnormal' : 'Normal')
        : '—',
      badgeColor: data?.phLevel !== undefined
        ? (data.phLevel < 6.5 || data.phLevel > 8.5 ? Colors.danger : Colors.success)
        : Colors.textMuted,
    },
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

        {/* Sensor Real-time */}
        <Text style={styles.sectionTitle}>Sensor Real-time</Text>
        {lastUpdated && <Text style={styles.lastUpdate}>Update terakhir: {lastUpdated}</Text>}

        <View style={styles.sensorList}>
          {sensorRows.map((item) => (
            <View key={item.label} style={styles.sensorRow}>
              <Text style={styles.sensorIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sensorLabel}>{item.label}</Text>
                <Text style={styles.sensorValue}>{item.value}</Text>
              </View>
              <View style={[styles.badge, { borderColor: item.badgeColor }]}>
                <Text style={[styles.badgeText, { color: item.badgeColor }]}>{item.badge}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Chart tabs */}
        <View style={styles.tabRow}>
          {(['suhu', 'pakan'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeChart === t && styles.tabActive]}
              onPress={() => setActiveChart(t)}
            >
              <Text style={[styles.tabText, activeChart === t && styles.tabTextActive]}>
                {t === 'suhu' ? '🌡️ Suhu' : '🌾 Pakan'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Range filter */}
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            {activeChart === 'suhu'
              ? `Grafik Trend Suhu (${range})`
              : `Grafik Level Pakan (${range})`}
          </Text>
          <BarChart
            data={activeChart === 'suhu' ? TEMP_DATA : FEED_DATA}
            maxVal={activeChart === 'suhu' ? 35 : 100}
            color={activeChart === 'suhu' ? Colors.danger : Colors.primary}
          />
        </View>

        {/* Statistik */}
        <Text style={styles.sectionTitle}>Statistik Hari Ini</Text>
        <View style={styles.statsCard}>
          {[
            { label: 'Rata-rata', val: data?.temperature !== undefined ? `${data.temperature}°C` : '—' },
            { label: 'Tertinggi', val: '31°C' },
            { label: 'Terendah', val: '22°C' },
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

      </ScrollView>
      <AIChatFAB />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bgPage },
  scroll:      { padding: 16, paddingBottom: 120, gap: 12 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  lastUpdate:  { fontSize: 12, color: Colors.textMuted, marginTop: -8 },
  connBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  connDot:     { width: 7, height: 7, borderRadius: 4 },
  connText:    { fontSize: 12, fontWeight: '600' },
  sensorList:  { gap: 10 },
  sensorRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  sensorIcon:  { fontSize: 26 },
  sensorLabel: { fontSize: 13, color: Colors.textSecondary },
  sensorValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5 },
  badgeText:   { fontSize: 12, fontWeight: '600' },
  tabRow:      { flexDirection: 'row', gap: 8 },
  tab:         { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  tabActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  rangeRow:    { flexDirection: 'row', gap: 8 },
  rangeBtn:    { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  rangeBtnActive: { backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  rangeBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  rangeBtnTextActive: { color: Colors.primary },
  chartCard:   { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  chartTitle:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  statsCard:   { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  statItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statLabel:   { fontSize: 12, color: Colors.textSecondary },
  statValue:   { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
});
