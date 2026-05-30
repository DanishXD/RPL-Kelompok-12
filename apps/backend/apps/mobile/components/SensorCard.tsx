import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/colors';
interface Props { icon: string; label: string; value: string; status?: 'normal'|'warning'|'danger'; statusLabel?: string; active?: boolean; onPress?: () => void; }
export default function SensorCard({ icon, label, value, status='normal', statusLabel, active=false, onPress }: Props) {
  const sc = { normal: { bg: Colors.successBg, text: Colors.success }, warning: { bg: Colors.warningBg, text: Colors.warning }, danger: { bg: Colors.dangerBg, text: Colors.danger } };
  return (
    <TouchableOpacity style={[styles.card, active && styles.cardActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, active && styles.valueActive]}>{value}</Text>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {statusLabel && <View style={[styles.badge, { backgroundColor: sc[status].bg }]}><Text style={[styles.badgeText, { color: sc[status].text }]}>{statusLabel}</Text></View>}
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  card:        { flex:1, backgroundColor:Colors.bgCard, borderRadius:16, padding:14, alignItems:'center', gap:4, borderWidth:1.5, borderColor:Colors.border, elevation:2 },
  cardActive:  { borderColor:Colors.primary, borderWidth:2 },
  icon:        { fontSize:26, marginBottom:2 },
  value:       { fontSize:18, fontWeight:'700', color:Colors.textPrimary },
  valueActive: { color:Colors.primary },
  label:       { fontSize:11, color:Colors.textSecondary, fontWeight:'500', textAlign:'center' },
  labelActive: { color:Colors.primary },
  badge:       { paddingHorizontal:7, paddingVertical:2, borderRadius:20, marginTop:3 },
  badgeText:   { fontSize:10, fontWeight:'600' },
});
