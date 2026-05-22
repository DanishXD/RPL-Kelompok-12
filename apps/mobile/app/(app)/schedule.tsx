import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import ScreenHeader from '../../components/ScreenHeader';
import AIChatFAB from '../../components/AIChatFAB';
import { Colors } from '../../constants/colors';

// Schedule sudah diintegrasikan ke halaman Control
// Halaman ini redirect ke Control supaya tidak ada tab yang kosong

export default function ScheduleScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Jadwal Pakan" subtitle="Manajemen jadwal otomatis" showBack />
      <View style={styles.body}>
        <Text style={styles.icon}>📅</Text>
        <Text style={styles.title}>Jadwal Pakan</Text>
        <Text style={styles.sub}>
          Kelola jadwal pemberian pakan otomatis di halaman Kontrol.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace('/(app)/control')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Buka Halaman Kontrol →</Text>
        </TouchableOpacity>
      </View>
      <AIChatFAB />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  icon:  { fontSize: 56 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  sub:   { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  btn:   { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
  btnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
