import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import AIChatFAB from '../../components/AIChatFAB';
import { useSensorStore } from '../../stores/sensorStore';
import { Colors } from '../../constants/colors';

const INITIAL_SCHEDULES = [
  { id: '1', time: '07:00', amount: '100g', freq: 'Setiap hari',    active: true  },
  { id: '2', time: '12:00', amount: '120g', freq: 'Setiap hari',    active: true  },
  { id: '3', time: '18:00', amount: '150g', freq: 'Sen, Rab, Jum',  active: false },
];

export default function ControlScreen() {
  const { data } = useSensorStore();
  const [schedules,     setSchedules]     = useState(INITIAL_SCHEDULES);
  const [overrideActive, setOverride]     = useState(false);
  const [relayOn,        setRelayOn]      = useState(true);
  const [motorOn,        setMotorOn]      = useState(false);
  const [feeding,        setFeeding]      = useState(false);
  const [countdown,      setCountdown]    = useState(0);

  const feedLevel = data?.feedLevel;
  const relayReady = !feeding && relayOn;

  const handleFeedNow = () => {
    if (feedLevel !== undefined && feedLevel < 5) {
      Alert.alert(
        '⚠️ Pakan Hampir Habis',
        `Level pakan hanya ${feedLevel}%. Yakin ingin tetap memberi pakan?`,
        [
          { text: 'Batal',    style: 'cancel' },
          { text: 'Lanjutkan', onPress: executeFeed },
        ]
      );
      return;
    }
    Alert.alert(
      'Beri Pakan',
      'Yakin ingin memberi pakan sekarang?',
      [
        { text: 'Batal',        style: 'cancel' },
        { text: 'Ya, Beri Pakan', onPress: executeFeed },
      ]
    );
  };

  const executeFeed = () => {
    setFeeding(true);
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setFeeding(false);
          Alert.alert('✅ Berhasil', 'Pakan berhasil diberikan!');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const toggleSchedule = (id: string) =>
    setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, active: !s.active } : s));

  const addSchedule = () => {
    Alert.alert('Tambah Jadwal', 'Fitur ini akan aktif setelah backend terhubung.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Kontrol Pakan" subtitle="Jadwal & Pemberian Manual" showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Pemberian Manual ── */}
        <Text style={styles.sectionTitle}>Pemberian Manual</Text>
        <View style={styles.card}>
          <View style={styles.manualRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.manualTitle}>Beri Pakan Sekarang</Text>
              <Text style={styles.manualSub}>Trigger relay + servo instan</Text>
            </View>
            <View style={[
              styles.readyBadge,
              { borderColor: relayReady ? Colors.primary : Colors.textMuted,
                backgroundColor: relayReady ? Colors.primaryBg : Colors.borderLight }
            ]}>
              <Text style={[styles.readyText, { color: relayReady ? Colors.primary : Colors.textMuted }]}>
                {relayReady ? 'Relay Siap' : feeding ? `${countdown}s...` : 'Relay OFF'}
              </Text>
            </View>
          </View>

          {/* Feed level warning */}
          {feedLevel !== undefined && feedLevel < 20 && (
            <View style={styles.feedWarn}>
              <Text style={styles.feedWarnIcon}>⚠️</Text>
              <Text style={styles.feedWarnText}>
                Level pakan {feedLevel}% — {feedLevel < 10 ? 'KRITIS! Segera isi ulang!' : 'Hampir habis'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.feedNowBtn, (feeding || !relayReady) && styles.feedNowBtnOff]}
            onPress={handleFeedNow}
            disabled={feeding || !relayReady}
            activeOpacity={0.85}
          >
            {feeding ? (
              <Text style={styles.feedNowBtnText}>⏳ Memberi Pakan... {countdown}s</Text>
            ) : (
              <Text style={styles.feedNowBtnText}>⚡ Beri Pakan Sekarang</Text>
            )}
          </TouchableOpacity>

          {/* Progress bar saat feeding */}
          {feeding && (
            <View style={styles.feedProgressBg}>
              <View style={[styles.feedProgressFill, { width: `${((5 - countdown) / 5) * 100}%` }]} />
            </View>
          )}
        </View>

        {/* ── Override ── */}
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Override Jadwal Otomatis</Text>
              <Text style={styles.switchSub}>Nonaktifkan sementara semua jadwal</Text>
            </View>
            <Switch
              value={overrideActive}
              onValueChange={setOverride}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={overrideActive ? Colors.primary : Colors.white}
            />
          </View>
          {overrideActive && (
            <View style={styles.overrideWarn}>
              <Text style={styles.overrideWarnText}>
                ⚠️ Semua jadwal otomatis dinonaktifkan sementara
              </Text>
            </View>
          )}
        </View>

        {/* ── Status Relay & Motor ── */}
        <Text style={styles.sectionTitle}>Status Relay & Motor</Text>
        <View style={styles.card}>
          {[
            { label: 'Relay Pakan',    sub: 'Servo motor pembuka',  val: relayOn, set: setRelayOn },
            { label: 'Motor Conveyor', sub: 'Penyalur pakan',       val: motorOn, set: setMotorOn },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>{item.label}</Text>
                  <Text style={styles.switchSub}>{item.sub}</Text>
                </View>
                <View style={[
                  styles.statusPill,
                  { backgroundColor: item.val ? Colors.primaryBg : Colors.borderLight }
                ]}>
                  <Text style={[styles.statusPillText, { color: item.val ? Colors.primary : Colors.textMuted }]}>
                    {item.val ? 'ON' : 'OFF'}
                  </Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Jadwal Otomatis ── */}
        <Text style={styles.sectionTitle}>Jadwal Otomatis</Text>
        <View style={styles.card}>
          {schedules.map((s, i, arr) => (
            <React.Fragment key={s.id}>
              <View style={styles.scheduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scheduleTime, overrideActive && { color: Colors.textMuted }]}>
                    {s.time}
                  </Text>
                  <Text style={styles.scheduleSub}>{s.amount} — {s.freq}</Text>
                </View>
                <View style={[
                  styles.statusPill,
                  { backgroundColor: (s.active && !overrideActive) ? Colors.primaryBg : Colors.borderLight, marginRight: 10 }
                ]}>
                  <Text style={[
                    styles.statusPillText,
                    { color: (s.active && !overrideActive) ? Colors.primary : Colors.textMuted }
                  ]}>
                    {overrideActive ? 'Override' : s.active ? 'Aktif' : 'Nonaktif'}
                  </Text>
                </View>
                <Switch
                  value={s.active && !overrideActive}
                  onValueChange={() => !overrideActive && toggleSchedule(s.id)}
                  disabled={overrideActive}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={(s.active && !overrideActive) ? Colors.primary : Colors.white}
                />
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={addSchedule}>
          <Text style={styles.addBtnText}>+ Tambah Jadwal Baru</Text>
        </TouchableOpacity>

      </ScrollView>
      <AIChatFAB />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bgPage },
  scroll:       { padding: 16, paddingBottom: 120, gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  card:         { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  manualRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manualTitle:  { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  manualSub:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  readyBadge:   { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5 },
  readyText:    { fontSize: 12, fontWeight: '600' },
  feedWarn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warningBg, borderRadius: 10, padding: 10 },
  feedWarnIcon: { fontSize: 16 },
  feedWarnText: { fontSize: 13, color: '#92400E', fontWeight: '500', flex: 1 },
  feedNowBtn:   { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  feedNowBtnOff:{ backgroundColor: Colors.border, shadowOpacity: 0, elevation: 0 },
  feedNowBtnText:{ fontSize: 16, fontWeight: '700', color: Colors.white },
  feedProgressBg:{ height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  feedProgressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  switchRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchTitle:  { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  switchSub:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  overrideWarn: { backgroundColor: Colors.warningBg, borderRadius: 10, padding: 10 },
  overrideWarnText: { fontSize: 13, color: '#92400E', fontWeight: '500' },
  statusPill:   { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  divider:      { height: 1, backgroundColor: Colors.borderLight },
  scheduleRow:  { flexDirection: 'row', alignItems: 'center' },
  scheduleTime: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  scheduleSub:  { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  addBtn:       { backgroundColor: Colors.bgCard, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  addBtnText:   { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
});
