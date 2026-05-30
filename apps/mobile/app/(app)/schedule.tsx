import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
export default function ScheduleScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Jadwal Pakan" subtitle="Manajemen jadwal otomatis" showBack />
      <View style={styles.body}>
        <Text style={styles.icon}>📅</Text>
        <Text style={styles.title}>Jadwal Pakan</Text>
        <Text style={styles.sub}>Kelola jadwal di halaman Kontrol.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(app)/control')} activeOpacity={0.85}>
          <Text style={styles.btnText}>Buka Halaman Kontrol →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:Colors.bgPage },
  body:      { flex:1, alignItems:'center', justifyContent:'center', padding:32, gap:14 },
  icon:      { fontSize:56 },
  title:     { fontSize:20, fontWeight:'700', color:Colors.textPrimary },
  sub:       { fontSize:14, color:Colors.textSecondary, textAlign:'center' },
  btn:       { backgroundColor:Colors.primary, borderRadius:14, paddingHorizontal:28, paddingVertical:14, marginTop:8 },
  btnText:   { fontSize:15, fontWeight:'700', color:Colors.white },
});
