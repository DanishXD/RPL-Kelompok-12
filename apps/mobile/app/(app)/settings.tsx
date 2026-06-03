import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Modal, TextInput, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import ScreenHeader from '../../components/ScreenHeader';
import { useAuthStore } from '../../stores/authStore';
import { useSensorStore } from '../../stores/sensorStore';
import { DEVICE_KEYS } from './setup-device';
import { Colors } from '../../constants/colors';
import api from '../../lib/api';

// ── Row komponen ──────────────────────────────────────────────────────────────

function Row({ icon, title, subtitle, onPress, right }: {
  icon: string; title: string; subtitle?: string;
  onPress?: () => void; right?: React.ReactNode;
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

// ── Modal Edit Profil ─────────────────────────────────────────────────────────

function ProfileModal({ visible, currentName, onClose, onSave }: {
  visible: boolean; currentName: string;
  onClose: () => void; onSave: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  useEffect(() => { setName(currentName); }, [currentName]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={modal.overlay} onPress={onClose}>
        <Pressable style={modal.sheet} onPress={e => e.stopPropagation()}>
          <Text style={modal.title}>Edit Profil</Text>
          <Text style={modal.label}>Nama Lengkap</Text>
          <TextInput
            style={modal.input}
            value={name}
            onChangeText={setName}
            placeholder="Nama kamu"
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
          <View style={modal.btnRow}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
              <Text style={modal.cancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.saveBtn, !name.trim() && { opacity: 0.5 }]}
              onPress={() => { if (name.trim()) { onSave(name.trim()); onClose(); } }}
              disabled={!name.trim()}
            >
              <Text style={modal.saveText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Modal Notifikasi ──────────────────────────────────────────────────────────

function NotifModal({ visible, prefs, onClose, onSave }: {
  visible: boolean;
  prefs: NotifPrefs;
  onClose: () => void;
  onSave: (p: NotifPrefs) => void;
}) {
  const [local, setLocal] = useState<NotifPrefs>(prefs);
  useEffect(() => { setLocal(prefs); }, [prefs]);

  const toggle = (key: keyof NotifPrefs) =>
    setLocal(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={modal.overlay} onPress={onClose}>
        <Pressable style={modal.sheet} onPress={e => e.stopPropagation()}>
          <Text style={modal.title}>Preferensi Notifikasi</Text>
          {([
            { key: 'temperature', label: '🌡️ Alert Suhu',       sub: 'Notifikasi saat suhu di luar batas' },
            { key: 'feedLevel',   label: '🌾 Alert Level Pakan', sub: 'Notifikasi saat pakan hampir habis' },
            { key: 'phLevel',     label: '💧 Alert pH Air',      sub: 'Notifikasi saat pH tidak normal' },
            { key: 'sound',       label: '🔔 Suara Notifikasi',  sub: 'Aktifkan suara saat notifikasi masuk' },
          ] as { key: keyof NotifPrefs; label: string; sub: string }[]).map((item, i, arr) => (
            <React.Fragment key={item.key}>
              <View style={modal.notifRow}>
                <View style={{ flex: 1 }}>
                  <Text style={modal.notifLabel}>{item.label}</Text>
                  <Text style={modal.notifSub}>{item.sub}</Text>
                </View>
                <Switch
                  value={local[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={local[item.key] ? Colors.primary : Colors.white}
                />
              </View>
              {i < arr.length - 1 && <View style={modal.notifDivider} />}
            </React.Fragment>
          ))}
          <View style={modal.btnRow}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
              <Text style={modal.cancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.saveBtn} onPress={() => { onSave(local); onClose(); }}>
              <Text style={modal.saveText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Modal Bahasa ──────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'id', label: '🇮🇩  Indonesia' },
  { code: 'en', label: '🇺🇸  English'   },
];

function LangModal({ visible, current, onClose, onSelect }: {
  visible: boolean; current: string;
  onClose: () => void; onSelect: (code: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={modal.overlay} onPress={onClose}>
        <Pressable style={modal.sheet} onPress={e => e.stopPropagation()}>
          <Text style={modal.title}>Pilih Bahasa</Text>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[modal.langRow, current === lang.code && modal.langRowActive]}
              onPress={() => { onSelect(lang.code); onClose(); }}
            >
              <Text style={modal.langLabel}>{lang.label}</Text>
              {current === lang.code && <Text style={{ color: Colors.primary, fontSize: 18 }}>✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[modal.cancelBtn, { marginTop: 8 }]} onPress={onClose}>
            <Text style={modal.cancelText}>Batal</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotifPrefs {
  temperature: boolean;
  feedLevel:   boolean;
  phLevel:     boolean;
  sound:       boolean;
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  temperature: true,
  feedLevel:   true,
  phLevel:     true,
  sound:       true,
};

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuthStore();
  const { isConnected, activeDeviceId, reset } = useSensorStore();

  const [deviceName,    setDeviceName]    = useState<string | null>(null);
  const [deviceId,      setDeviceId]      = useState<string | null>(null);
  const [notifPrefs,    setNotifPrefs]    = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [language,      setLanguage]      = useState('id');
  const [showProfile,   setShowProfile]   = useState(false);
  const [showNotif,     setShowNotif]     = useState(false);
  const [showLang,      setShowLang]      = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'EC';

  useEffect(() => {
    loadDeviceInfo();
    loadPrefs();
  }, []);

  const loadDeviceInfo = async () => {
    const name = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_NAME);
    const id   = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_ID);
    setDeviceName(name);
    setDeviceId(id);
  };

  const loadPrefs = async () => {
    try {
      const saved = await SecureStore.getItemAsync('notif_prefs');
      if (saved) setNotifPrefs(JSON.parse(saved));
      const lang = await SecureStore.getItemAsync('language');
      if (lang) setLanguage(lang);
    } catch {}
  };

  const handleSaveName = async (newName: string) => {
    try {
      await api.patch('/auth/profile', { name: newName });
      updateUser?.({ name: newName });
      Alert.alert('✅ Berhasil', 'Nama berhasil diperbarui');
    } catch {
      // Simpan lokal saja kalau API gagal
      updateUser?.({ name: newName });
      Alert.alert('✅ Tersimpan', 'Nama diperbarui secara lokal');
    }
  };

  const handleSaveNotif = async (prefs: NotifPrefs) => {
    setNotifPrefs(prefs);
    await SecureStore.setItemAsync('notif_prefs', JSON.stringify(prefs));
    Alert.alert('✅ Tersimpan', 'Preferensi notifikasi berhasil disimpan');
  };

  const handleSelectLang = async (code: string) => {
    setLanguage(code);
    await SecureStore.setItemAsync('language', code);
    const label = LANGUAGES.find(l => l.code === code)?.label ?? code;
    Alert.alert('✅ Bahasa diubah', `Bahasa diset ke ${label}`);
  };

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => { reset(); logout(); } },
    ]);
  };

  const langLabel = LANGUAGES.find(l => l.code === language)?.label ?? 'Indonesia';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Setelan" subtitle="Akun, Perangkat & Preferensi" showBack />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Profil ── */}
        <TouchableOpacity style={styles.profileCard} onPress={() => setShowProfile(true)} activeOpacity={0.8}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name ?? 'EcoSmart User'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedDot} />
              <Text style={styles.verifiedText}>Tap untuk edit profil</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* ── Status Perangkat ── */}
        <View style={styles.deviceStatusCard}>
          <Text style={styles.deviceStatusLabel}>STATUS PERANGKAT</Text>
          <View style={styles.deviceStatusRow}>
            <View style={[styles.connDot, { backgroundColor: isConnected ? Colors.success : Colors.textMuted }]} />
            <Text style={styles.deviceStatusText}>
              {isConnected ? 'Terhubung — Real-time aktif' : 'Tidak terhubung'}
            </Text>
          </View>
          {deviceName && <Text style={styles.deviceNameText}>📡 {deviceName}</Text>}
          {deviceId   && <Text style={styles.deviceIdText} numberOfLines={1}>ID: {deviceId}</Text>}
        </View>

        {/* ── Akun ── */}
        <Text style={styles.groupLabel}>Akun</Text>
        <View style={styles.group}>
          <Row
            icon="👤" title="Profil Pengguna"
            subtitle={user?.name ?? 'Tap untuk edit nama'}
            onPress={() => setShowProfile(true)}
          />
          <View style={styles.divider} />
          <Row
            icon="🔔" title="Preferensi Notifikasi"
            subtitle={`Aktif: ${[
              notifPrefs.temperature && 'Suhu',
              notifPrefs.feedLevel   && 'Pakan',
              notifPrefs.phLevel     && 'pH',
            ].filter(Boolean).join(', ') || 'Semua nonaktif'}`}
            onPress={() => setShowNotif(true)}
          />
        </View>

        {/* ── Perangkat ── */}
        <Text style={styles.groupLabel}>Perangkat</Text>
        <View style={styles.group}>
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
              <Text style={styles.setupDeviceBtnBadgeText}>{deviceId ? 'Kelola' : 'Setup'}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <Row
            icon="🕐" title="Sinkronisasi Waktu"
            subtitle="Perbarui info perangkat"
            onPress={() => {
              loadDeviceInfo();
              Alert.alert('✅ Sync', 'Info perangkat berhasil diperbarui!');
            }}
          />
        </View>

        {/* ── Preferensi ── */}
        <Text style={styles.groupLabel}>Preferensi Tampilan</Text>
        <View style={styles.group}>
          <Row
            icon="🌐" title="Bahasa"
            subtitle={langLabel}
            onPress={() => setShowLang(true)}
          />
          <View style={styles.divider} />
          <Row
            icon="📊" title="Satuan Suhu"
            subtitle="Celcius (°C)"
            onPress={() => Alert.alert('Info', 'Saat ini hanya mendukung Celcius (°C)')}
          />
        </View>

        {/* ── Bantuan ── */}
        <Text style={styles.groupLabel}>Bantuan</Text>
        <View style={styles.group}>
          <Row
            icon="📖" title="Panduan Penggunaan"
            subtitle="Cara setup ESP32 & fitur app"
            onPress={() => Alert.alert(
              '📖 Panduan Singkat',
              '1. Daftarkan perangkat di menu Setelan\n2. Isi Device ID & Token ke config.h ESP32\n3. Jalankan ESP32 — data langsung masuk\n4. Pantau di Dashboard & Monitor\n5. Set jadwal pakan di menu Kontrol',
              [{ text: 'Mengerti' }]
            )}
          />
          <View style={styles.divider} />
          <Row
            icon="❓" title="FAQ"
            subtitle="Pertanyaan yang sering ditanyakan"
            onPress={() => Alert.alert(
              '❓ FAQ',
              'Q: Data sensor tidak muncul?\nA: Pastikan ESP32 sudah terhubung WiFi dan Device ID/Token benar.\n\nQ: Notifikasi tidak muncul?\nA: Izinkan notifikasi di Pengaturan iPhone.\n\nQ: AI Chat tidak merespons?\nA: Server mungkin sedang cold start, tunggu 30 detik.',
              [{ text: 'Mengerti' }]
            )}
          />
          <View style={styles.divider} />
          <Row
            icon="📧" title="Kontak Support"
            subtitle="danishafidwibisono@apps.ipb.ac.id"
            onPress={() => Alert.alert('Kontak Support', 'Email: danishafidwibisono@apps.ipb.ac.id\n\nWaktu respons: 1-2 hari kerja')}
          />
        </View>

        {/* ── Tentang ── */}
        <Text style={styles.groupLabel}>Tentang</Text>
        <View style={styles.group}>
          <Row icon="ℹ️"  title="Versi Aplikasi" subtitle="EcoSmart Feeder v1.0.0" />
          <View style={styles.divider} />
          <Row icon="🏫" title="Dikembangkan oleh" subtitle="Kelompok 12 — RPL IPB University" />
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </TouchableOpacity>

        <Text style={styles.version}>EcoSmart Feeder v1.0.0 · RPL Kelompok 12</Text>

      </ScrollView>

      {/* ── Modals ── */}
      <ProfileModal
        visible={showProfile}
        currentName={user?.name ?? ''}
        onClose={() => setShowProfile(false)}
        onSave={handleSaveName}
      />
      <NotifModal
        visible={showNotif}
        prefs={notifPrefs}
        onClose={() => setShowNotif(false)}
        onSave={handleSaveNotif}
      />
      <LangModal
        visible={showLang}
        current={language}
        onClose={() => setShowLang(false)}
        onSelect={handleSelectLang}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: Colors.bgPage },
  scroll:               { padding: 16, paddingBottom: 40, gap: 10 },
  profileCard:          { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  avatar:               { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:           { fontSize: 20, fontWeight: '700', color: Colors.primary },
  profileName:          { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  profileEmail:         { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  verifiedRow:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verifiedDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  verifiedText:         { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  deviceStatusCard:     { backgroundColor: Colors.primaryBg, borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: Colors.primary + '40' },
  deviceStatusLabel:    { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.8 },
  deviceStatusRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connDot:              { width: 8, height: 8, borderRadius: 4 },
  deviceStatusText:     { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  deviceNameText:       { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  deviceIdText:         { fontSize: 11, color: Colors.textMuted },
  groupLabel:           { fontSize: 13, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.5, marginTop: 6 },
  group:                { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  divider:              { height: 1, backgroundColor: Colors.borderLight, marginLeft: 52 },
  row:                  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowIcon:              { fontSize: 22, width: 30, textAlign: 'center' },
  rowText:              { flex: 1 },
  rowTitle:             { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowSub:               { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  chevron:              { fontSize: 20, color: Colors.textMuted },
  setupDeviceBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 12 },
  setupDeviceBtnLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  setupDeviceBtnIcon:   { fontSize: 22, width: 30, textAlign: 'center' },
  setupDeviceBtnTitle:  { fontSize: 15, fontWeight: '700', color: Colors.primary },
  setupDeviceBtnSub:    { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  setupDeviceBtnBadge:  { backgroundColor: Colors.primaryBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary },
  setupDeviceBtnBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  logoutBtn:            { backgroundColor: Colors.dangerBg, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.danger, marginTop: 8 },
  logoutText:           { fontSize: 15, fontWeight: '700', color: Colors.danger },
  version:              { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
});

const modal = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  title:       { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  label:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  input:       { backgroundColor: Colors.bgPage, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  btnRow:      { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn:   { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.bgPage, borderWidth: 1, borderColor: Colors.border },
  cancelText:  { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn:     { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.primary },
  saveText:    { fontSize: 15, fontWeight: '700', color: Colors.white },
  notifRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifLabel:  { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  notifSub:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  notifDivider:{ height: 1, backgroundColor: Colors.borderLight },
  langRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderRadius: 10 },
  langRowActive:{ backgroundColor: Colors.primaryBg },
  langLabel:   { fontSize: 16, color: Colors.textPrimary, fontWeight: '500' },
});
