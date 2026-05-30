import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import ScreenHeader from '../../components/ScreenHeader';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../lib/api';
import { Colors } from '../../constants/colors';

// Key untuk simpan deviceId & deviceToken di SecureStore
export const DEVICE_KEYS = {
  DEVICE_ID:    'ecosmart_device_id',
  DEVICE_TOKEN: 'ecosmart_device_token',
  DEVICE_NAME:  'ecosmart_device_name',
} as const;

interface RegisteredDevice {
  id:          string;
  name:        string;
  location:    string;
  status:      string;
  deviceToken: string;
  createdAt:   string;
}

export default function SetupDeviceScreen() {
  const [name,       setName]       = useState('');
  const [location,   setLocation]   = useState('');
  const [nameError,  setNameError]  = useState('');
  const [loading,    setLoading]    = useState(false);
  const [loadingList,setLoadingList]= useState(true);
  const [devices,    setDevices]    = useState<RegisteredDevice[]>([]);
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [step,       setStep]       = useState<'list' | 'add'>('list');

  // Load daftar device saat pertama buka
  useEffect(() => {
    loadDevices();
    loadActiveDevice();
  }, []);

  const loadActiveDevice = async () => {
    const saved = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_ID);
    if (saved) setActiveId(saved);
  };

  const loadDevices = async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/devices');
      setDevices(data.data);
    } catch (err: any) {
      Alert.alert('Error', 'Gagal memuat daftar device. Pastikan backend berjalan.');
    } finally {
      setLoadingList(false);
    }
  };

  const handleAddDevice = async () => {
    if (!name.trim()) { setNameError('Nama kolam wajib diisi'); return; }
    if (name.trim().length < 2) { setNameError('Nama minimal 2 karakter'); return; }
    setNameError('');
    setLoading(true);

    try {
      const { data } = await api.post('/devices', {
        name:     name.trim(),
        location: location.trim() || undefined,
      });

      const newDevice: RegisteredDevice = data.data;

      // Simpan otomatis ke SecureStore
      await SecureStore.setItemAsync(DEVICE_KEYS.DEVICE_ID,    newDevice.id);
      await SecureStore.setItemAsync(DEVICE_KEYS.DEVICE_TOKEN, newDevice.deviceToken);
      await SecureStore.setItemAsync(DEVICE_KEYS.DEVICE_NAME,  newDevice.name);

      setActiveId(newDevice.id);
      setDevices(prev => [...prev, newDevice]);
      setStep('list');
      setName('');
      setLocation('');

      Alert.alert(
        '✅ Device Berhasil Didaftarkan!',
        `Nama: ${newDevice.name}\n\nDevice ID dan Token sudah tersimpan otomatis di aplikasi.\n\nSekarang masukkan nilai berikut ke config.h ESP32:\n\nDEVICE_ID:\n${newDevice.id}\n\nDEVICE_TOKEN:\n${newDevice.deviceToken}`,
        [{ text: 'OK, Mengerti!' }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Gagal daftarkan device. Cek koneksi.';
      Alert.alert('Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (device: RegisteredDevice) => {
    await SecureStore.setItemAsync(DEVICE_KEYS.DEVICE_ID,    device.id);
    await SecureStore.setItemAsync(DEVICE_KEYS.DEVICE_TOKEN, device.deviceToken);
    await SecureStore.setItemAsync(DEVICE_KEYS.DEVICE_NAME,  device.name);
    setActiveId(device.id);
    Alert.alert('✅ Device Aktif', `${device.name} sekarang menjadi device aktif.\n\nRestart app untuk melihat data real-time dari device ini.`);
  };

  const handleDeleteDevice = (device: RegisteredDevice) => {
    Alert.alert(
      'Hapus Device',
      `Yakin ingin menghapus "${device.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/devices/${device.id}`);
              setDevices(prev => prev.filter(d => d.id !== device.id));
              if (activeId === device.id) {
                await SecureStore.deleteItemAsync(DEVICE_KEYS.DEVICE_ID);
                await SecureStore.deleteItemAsync(DEVICE_KEYS.DEVICE_TOKEN);
                await SecureStore.deleteItemAsync(DEVICE_KEYS.DEVICE_NAME);
                setActiveId(null);
              }
            } catch {
              Alert.alert('Error', 'Gagal menghapus device.');
            }
          },
        },
      ]
    );
  };

  // ── Render: Form Tambah Device ──────────────────────────────────────────────
  if (step === 'add') {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader
          title="Tambah Perangkat"
          subtitle="Daftarkan ESP32 baru"
          showBack
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Cara Kerja</Text>
              <Text style={styles.infoText}>
                Daftarkan perangkat ESP32 kamu di sini. Setelah berhasil, Device ID dan Token akan otomatis tersimpan dan ditampilkan untuk dimasukkan ke config.h ESP32.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informasi Perangkat</Text>

            <FormInput
              label="Nama Kolam / Perangkat"
              placeholder="Contoh: Kolam Lele Budi #1"
              value={name}
              onChangeText={(t) => { setName(t); if (nameError) setNameError(''); }}
              error={nameError}
              returnKeyType="next"
              autoCapitalize="words"
            />

            <FormInput
              label="Lokasi (opsional)"
              placeholder="Contoh: Desa Cirebon, Jawa Barat"
              value={location}
              onChangeText={setLocation}
              returnKeyType="done"
            />

            <PrimaryButton
              title="Daftarkan Perangkat"
              onPress={handleAddDevice}
              loading={loading}
            />

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setStep('list'); setName(''); setLocation(''); setNameError(''); }}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </View>

          {/* Panduan config.h */}
          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>📋 Setelah Daftarkan, Isi ke config.h</Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>#define DEVICE_ID    "uuid-dari-app"</Text>
              <Text style={styles.codeText}>#define DEVICE_TOKEN "token-dari-app"</Text>
            </View>
            <Text style={styles.guideNote}>
              Device ID dan Token akan muncul di popup setelah pendaftaran berhasil.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Daftar Device ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Manajemen Perangkat"
        subtitle="Kelola ESP32 terdaftar"
        showBack
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Device aktif saat ini */}
        {activeId && (
          <View style={styles.activeCard}>
            <View style={styles.activeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeLabel}>PERANGKAT AKTIF</Text>
              <Text style={styles.activeName}>
                {devices.find(d => d.id === activeId)?.name ?? 'Loading...'}
              </Text>
            </View>
            <Text style={styles.activeIcon}>📡</Text>
          </View>
        )}

        {/* Loading */}
        {loadingList && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Memuat daftar perangkat...</Text>
          </View>
        )}

        {/* Empty state */}
        {!loadingList && devices.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>Belum Ada Perangkat</Text>
            <Text style={styles.emptySub}>
              Daftarkan ESP32 pertama kamu untuk mulai monitoring kolam secara real-time.
            </Text>
          </View>
        )}

        {/* Daftar device */}
        {!loadingList && devices.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Perangkat Terdaftar ({devices.length})</Text>
            {devices.map((device) => {
              const isActive = device.id === activeId;
              return (
                <View key={device.id} style={[styles.deviceCard, isActive && styles.deviceCardActive]}>
                  {/* Header */}
                  <View style={styles.deviceHeader}>
                    <View style={[styles.deviceStatusDot, { backgroundColor: device.status === 'active' ? Colors.success : Colors.textMuted }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      {device.location && <Text style={styles.deviceLocation}>📍 {device.location}</Text>}
                    </View>
                    {isActive && (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Aktif</Text>
                      </View>
                    )}
                  </View>

                  {/* Device ID (truncated) */}
                  <View style={styles.deviceIdRow}>
                    <Text style={styles.deviceIdLabel}>ID:</Text>
                    <Text style={styles.deviceIdValue} numberOfLines={1}>
                      {device.id}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.deviceActions}>
                    {!isActive && (
                      <TouchableOpacity
                        style={styles.actionBtnPrimary}
                        onPress={() => handleSetActive(device)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.actionBtnPrimaryText}>Jadikan Aktif</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.actionBtnDanger}
                      onPress={() => handleDeleteDevice(device)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnDangerText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Tombol tambah device */}
        <TouchableOpacity
          style={styles.addDeviceBtn}
          onPress={() => setStep('add')}
          activeOpacity={0.85}
        >
          <Text style={styles.addDeviceBtnIcon}>+</Text>
          <Text style={styles.addDeviceBtnText}>Tambah Perangkat Baru</Text>
        </TouchableOpacity>

        {/* Refresh */}
        <TouchableOpacity style={styles.refreshBtn} onPress={loadDevices}>
          <Text style={styles.refreshBtnText}>🔄 Refresh Daftar</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  scroll:    { padding: 16, paddingBottom: 40, gap: 14 },

  // Active banner
  activeCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryBg, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.primary, gap: 10 },
  activeDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  activeLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 0.8 },
  activeName:  { fontSize: 16, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  activeIcon:  { fontSize: 28 },

  // Loading / empty
  loadingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  emptyCard:   { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 32, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.border },
  emptyIcon:   { fontSize: 52 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptySub:    { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Section
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },

  // Device card
  deviceCard:       { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  deviceCardActive: { borderColor: Colors.primary, borderWidth: 2 },
  deviceHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deviceStatusDot:  { width: 8, height: 8, borderRadius: 4 },
  deviceName:       { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  deviceLocation:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  activePill:       { backgroundColor: Colors.primaryBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary },
  activePillText:   { fontSize: 11, fontWeight: '700', color: Colors.primary },
  deviceIdRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.bgPage, borderRadius: 8, padding: 8 },
  deviceIdLabel:    { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  deviceIdValue:    { fontSize: 11, color: Colors.textSecondary, flex: 1, fontFamily: 'monospace' },
  deviceActions:    { flexDirection: 'row', gap: 8 },
  actionBtnPrimary: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  actionBtnDanger:  { paddingHorizontal: 16, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: Colors.dangerBg, borderWidth: 1, borderColor: Colors.danger },
  actionBtnDangerText: { fontSize: 13, fontWeight: '700', color: Colors.danger },

  // Add button
  addDeviceBtn:     { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 4 },
  addDeviceBtnIcon: { fontSize: 22, color: Colors.white, fontWeight: '700' },
  addDeviceBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  refreshBtn:       { borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  refreshBtnText:   { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  // Form (step add)
  infoBanner:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.infoBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.info },
  infoIcon:    { fontSize: 24 },
  infoTitle:   { fontSize: 14, fontWeight: '700', color: Colors.info, marginBottom: 4 },
  infoText:    { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  card:        { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  cardTitle:   { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  cancelBtn:   { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelBtnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  guideCard:   { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  guideTitle:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  codeBlock:   { backgroundColor: '#0d1117', borderRadius: 10, padding: 12, gap: 4 },
  codeText:    { fontFamily: 'monospace', fontSize: 12, color: '#79c0ff' },
  guideNote:   { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
