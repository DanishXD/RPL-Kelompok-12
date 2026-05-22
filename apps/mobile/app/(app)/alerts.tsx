import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import AIChatFAB from '../../components/AIChatFAB';
import { useSensorStore } from '../../stores/sensorStore';
import { Colors } from '../../constants/colors';

const HISTORY = [
  { id: 'h1', title: 'Level Pakan < 20%',    time: '12 Apr · 08:15 — Terselesaikan' },
  { id: 'h2', title: 'Suhu 31°C (Overheat)', time: '10 Apr · 13:40 — Terselesaikan' },
];

export default function AlertsScreen() {
  const { alerts, dismissAlert } = useSensorStore();
  const [tMax, setTMax] = useState('30');
  const [tMin, setTMin] = useState('18');
  const [fMin, setFMin] = useState('20');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    Alert.alert('✅ Tersimpan', 'Pengaturan threshold berhasil disimpan.');
    setTimeout(() => setSaved(false), 2000);
  };

  const activeCount = alerts.length;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Notifikasi & Alert"
        subtitle={`${activeCount} alert aktif saat ini`}
        showBack
        rightElement={
          activeCount > 0
            ? <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>{activeCount} Aktif</Text></View>
            : undefined
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Alert Aktif */}
        <Text style={styles.sectionTitle}>Alert Aktif</Text>

        {activeCount === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>Tidak ada alert aktif</Text>
            <Text style={styles.emptySub}>Semua kondisi sensor dalam batas normal</Text>
          </View>
        )}

        {alerts.map((alert, i) => {
          const isCritical = alert.alerts.some(a =>
            (a.field === 'feedLevel' && a.value < 10) ||
            (a.field === 'temperature' && (a.value > 34 || a.value < 22))
          );
          return (
            <View key={i} style={[styles.alertCard, isCritical ? styles.alertDanger : styles.alertWarning]}>
              <View style={styles.alertHeader}>
                <View style={[styles.alertDot, { backgroundColor: isCritical ? Colors.danger : Colors.warning }]} />
                <Text style={styles.alertTitle}>
                  {alert.alerts.map(a => {
                    if (a.field === 'temperature') return a.status === 'high' ? 'Suhu Terlalu Tinggi' : 'Suhu Terlalu Rendah';
                    if (a.field === 'phLevel')     return a.status === 'high' ? 'pH Terlalu Tinggi'   : 'pH Terlalu Rendah';
                    if (a.field === 'feedLevel')   return 'Level Pakan Rendah';
                    return a.field;
                  }).join(', ')}
                </Text>
                <View style={[styles.levelBadge, {
                  backgroundColor: isCritical ? Colors.dangerBg  : Colors.warningBg,
                  borderColor:     isCritical ? Colors.danger     : Colors.warning,
                }]}>
                  <Text style={[styles.levelText, { color: isCritical ? Colors.danger : Colors.warning }]}>
                    {isCritical ? 'Kritis' : 'Peringatan'}
                  </Text>
                </View>
              </View>
              <Text style={styles.alertTime}>{alert.timestamp ? new Date(alert.timestamp).toLocaleString('id-ID') : '—'}</Text>
              <Text style={styles.alertDesc}>
                {alert.alerts.map(a =>
                  `${a.field === 'temperature' ? 'Suhu' : a.field === 'phLevel' ? 'pH' : 'Pakan'}: ${a.value} (${a.status === 'high' ? 'melebihi' : 'di bawah'} batas)`
                ).join('\n')}
              </Text>
              <TouchableOpacity onPress={() => dismissAlert(i)}>
                <Text style={[styles.alertAction, { color: isCritical ? Colors.danger : Colors.primary }]}>
                  → Tandai selesai
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Threshold */}
        <Text style={styles.sectionTitle}>Pengaturan Threshold</Text>
        <View style={styles.threshCard}>
          {[
            { label: 'Suhu Maksimum',       val: tMax, set: setTMax, unit: '°C' },
            { label: 'Suhu Minimum',        val: tMin, set: setTMin, unit: '°C' },
            { label: 'Level Pakan Minimum', val: fMin, set: setFMin, unit: '%'  },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={styles.threshRow}>
                <Text style={styles.threshLabel}>{item.label}</Text>
                <View style={styles.threshInputRow}>
                  <TextInput
                    style={styles.threshInput}
                    value={item.val}
                    onChangeText={item.set}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={styles.threshUnit}>{item.unit}</Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saved && { backgroundColor: Colors.success }]}
          onPress={handleSave} activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{saved ? '✅ Tersimpan' : 'Simpan Pengaturan'}</Text>
        </TouchableOpacity>

        {/* History */}
        <Text style={styles.sectionTitle}>Riwayat Alert</Text>
        <View style={styles.histCard}>
          {HISTORY.map((h, i, arr) => (
            <React.Fragment key={h.id}>
              <View style={styles.histRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histTitle}>{h.title}</Text>
                  <Text style={styles.histTime}>{h.time}</Text>
                </View>
                <View style={styles.resolvedBadge}>
                  <Text style={styles.resolvedText}>Selesai</Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

      </ScrollView>
      <AIChatFAB />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bgPage },
  scroll:       { padding: 16, paddingBottom: 120, gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  activeBadge:  { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  activeBadgeText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  emptyCard:    { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { fontSize: 15, fontWeight: '700', color: Colors.success },
  emptySub:     { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  alertCard:    { borderRadius: 16, padding: 16, borderWidth: 1.5, gap: 6 },
  alertWarning: { backgroundColor: Colors.warningBg, borderColor: Colors.warning },
  alertDanger:  { backgroundColor: Colors.dangerBg,  borderColor: Colors.danger  },
  alertHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertDot:     { width: 10, height: 10, borderRadius: 5 },
  alertTitle:   { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  levelBadge:   { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  levelText:    { fontSize: 11, fontWeight: '600' },
  alertTime:    { fontSize: 12, color: Colors.textMuted, marginLeft: 18 },
  alertDesc:    { fontSize: 13, color: Colors.textPrimary, marginLeft: 18, lineHeight: 20 },
  alertAction:  { fontSize: 13, fontWeight: '700', marginLeft: 18, marginTop: 4 },
  threshCard:   { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  threshRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threshLabel:  { fontSize: 14, color: Colors.textPrimary, fontWeight: '500', flex: 1 },
  threshInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  threshInput:  { width: 56, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.textPrimary, backgroundColor: Colors.bgPage },
  threshUnit:   { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', width: 24 },
  divider:      { height: 1, backgroundColor: Colors.borderLight },
  saveBtn:      { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText:  { fontSize: 16, fontWeight: '700', color: Colors.white },
  histCard:     { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  histRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  histTitle:    { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  histTime:     { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  resolvedBadge:{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.success },
  resolvedText: { fontSize: 12, fontWeight: '600', color: Colors.success },
});
