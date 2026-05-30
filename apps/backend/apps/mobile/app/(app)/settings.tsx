import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import ScreenHeader from '../../components/ScreenHeader';
import { useAuthStore } from '../../stores/authStore';
import { useSensorStore } from '../../stores/sensorStore';
import { DEVICE_KEYS } from './setup-device';
import { Colors } from '../../constants/colors';

function Row({ icon, title, subtitle, onPress, right }: {
  icon: string; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {right ?? (onPress && <Text style={styles.chevron}>›</Text>)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { isConnected, activeDeviceId, reset } = useSensorStore();
  const [darkMode,     setDarkMode]     = useState(false);
  const [deviceName,   setDeviceName]   = useState<string | null>(null);
  const [deviceId,     setDeviceId]     = useState<string | null>(null);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'EC';

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    const name = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_NAME);
    const id   = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_ID);
    setDeviceName(name);
    setDeviceId(id);
  };

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar', style: 'destructive',
        onPress: () => { reset(); logout(); },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Setelan" subtitle="Akun, Perangkat & Preferensi" showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.8}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name ?? 'EcoSmart User'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedDot} />
              <Text style={styles.verifiedText}>Terverifikasi</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Device Status */}
        <View style={styles.deviceStatusCard}>
          <Text style={styles.deviceStatusLabel}>STATUS PERANGKAT</Text>
          <View style={styles.deviceStatusRow}>
            <View style={[styles.connDot, { backgroundColor: isConnected ? Colors.success : Colors.textMuted }]} />
            <Text style={styles.deviceStatusText}>
              {isConnected ? 'Terhubung — Real-time aktif' : 'Tidak terhubung'}
            </Text>
          </View>
          {deviceName && <Text style={styles.deviceNameText}>📡 {deviceName}</Text>}
          {deviceId && <Text style={styles.deviceIdText} numberOfLines={1}>ID: {deviceId}</Text>}
        </View>

        {/* Akun */}
        <Text style={styles.groupLabel}>Akun</Text>
        <View style={styles.group}>
          <Row icon="👤" title="Profil Pengguna"       subtitle="Nama, email, preferensi"        onPress={() => Alert.alert('Info', 'Fitur segera hadir')} />
          <View style={styles.divider} />
          <Row icon="🔔" title="Preferensi Notifikasi" subtitle="Atur jenis notifikasi"           onPress={() => Alert.alert('Info', 'Fitur segera hadir')} />
        </View>

        {/* Perangkat */}
        <Text style={styles.groupLabel}>Perangkat</Text>
        <View style={styles.group}>
          {/* Tombol utama — Setup Device */}
          <TouchableOpacity
            style={styles.setupDeviceBtn}
            onPress={() => router.push('/(app)/setup-device')}
            activeOpacity={0.85}
          >
            <View style={styles.setupDeviceBtnLeft}>
              <Text style={styles.setupDeviceBtnIcon}>📡</Text>
              <View>
                <Text style={styles.setupDeviceBtnTitle}>Manajemen Perangkat</Text>
                <Text style={styles.setupDeviceBtnSub}>
                  {deviceName ? `Aktif: ${deviceName}` : 'Belum ada device terdaftar'}
                </Text>
              </View>
            </View>
            <View style={styles.setupDeviceBtnBadge}>
              <Text style={styles.setupDeviceBtnBadgeText}>
                {deviceId ? 'Kelola' : 'Setup'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />
          <Row icon="🕐" title="Sinkronisasi Waktu" subtitle="Terakhir sync: hari ini"
            onPress={() => { loadDeviceInfo(); Alert.alert('Sync', 'Info perangkat berhasil diperbarui!'); }} />
        </View>

        {/* Preferensi */}
        <Text style={styles.groupLabel}>Preferensi Tampilan</Text>
        <View style={styles.group}>
          <Row
            icon="🌙" title="Mode Gelap" subtitle="Tema aplikasi"
            right={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={darkMode ? Colors.primary : Colors.white}
              />
            }
          />
          <View style={styles.divider} />
          <Row icon="🌐" title="Bahasa" subtitle="Indonesia" onPress={() => {}} />
        </View>

        {/* Bantuan */}
        <Text style={styles.groupLabel}>Bantuan</Text>
        <View style={styles.group}>
          <View style={styles.helpRow}>
            <TouchableOpacity style={styles.helpBtn} activeOpacity={0.7}
              onPress={() => Alert.alert('Manual', 'Dokumentasi akan segera tersedia')}>
              <Text style={styles.helpIcon}>📖</Text>
              <Text style={styles.helpText}>Manual & FAQ</Text>
            </TouchableOpacity>
            <View style={styles.helpDivider} />
            <TouchableOpacity style={styles.helpBtn} activeOpacity={0.7}
              onPress={() => Alert.alert('Support', 'Email: support@ecosmart.id')}>
              <Text style={styles.helpIcon}>📞</Text>
              <Text style={styles.helpText}>Kontak Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </TouchableOpacity>

        <Text style={styles.version}>EcoSmart Feeder v1.0.0  •  Step 1-9 ✅</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bgPage },
  scroll:           { padding: 16, paddingBottom: 40, gap: 10 },
  profileCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  avatar:           { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 20, fontWeight: '700', color: Colors.primary },
  profileName:      { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  profileEmail:     { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  verifiedRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verifiedDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  verifiedText:     { fontSize: 12, color: Colors.success, fontWeight: '600' },
  deviceStatusCard: { backgroundColor: Colors.primaryBg, borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: Colors.primary + '40' },
  deviceStatusLabel:{ fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.8 },
  deviceStatusRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connDot:          { width: 8, height: 8, borderRadius: 4 },
  deviceStatusText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  deviceNameText:   { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  deviceIdText:     { fontSize: 11, color: Colors.textMuted },
  groupLabel:       { fontSize: 13, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.5, marginTop: 6 },
  group:            { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  divider:          { height: 1, backgroundColor: Colors.borderLight, marginLeft: 52 },
  row:              { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowIcon:          { fontSize: 22, width: 30, textAlign: 'center' },
  rowText:          { flex: 1 },
  rowTitle:         { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowSub:           { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  chevron:          { fontSize: 20, color: Colors.textMuted },

  // Setup device button (highlighted)
  setupDeviceBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 12 },
  setupDeviceBtnLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  setupDeviceBtnIcon:   { fontSize: 22, width: 30, textAlign: 'center' },
  setupDeviceBtnTitle:  { fontSize: 15, fontWeight: '700', color: Colors.primary },
  setupDeviceBtnSub:    { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  setupDeviceBtnBadge:  { backgroundColor: Colors.primaryBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary },
  setupDeviceBtnBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  helpRow:      { flexDirection: 'row' },
  helpBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  helpIcon:     { fontSize: 18 },
  helpText:     { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  helpDivider:  { width: 1, backgroundColor: Colors.borderLight },
  logoutBtn:    { backgroundColor: Colors.dangerBg, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.danger, marginTop: 8 },
  logoutText:   { fontSize: 15, fontWeight: '700', color: Colors.danger },
  version:      { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
});
