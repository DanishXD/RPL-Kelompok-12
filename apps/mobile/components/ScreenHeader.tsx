import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
interface Props { title: string; subtitle?: string; showBack?: boolean; rightElement?: React.ReactNode; }
export default function ScreenHeader({ title, subtitle, showBack=false, rightElement }: Props) {
  return (
    <View style={styles.header}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.row}>
        {showBack && <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>}
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {rightElement && <View style={styles.right}>{rightElement}</View>}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header:    { backgroundColor:Colors.primary, paddingTop:52, paddingBottom:20, paddingHorizontal:20 },
  row:       { flexDirection:'row', alignItems:'center', gap:12 },
  backBtn:   { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' },
  backIcon:  { fontSize:18, color:Colors.white, fontWeight:'600' },
  textBlock: { flex:1 },
  title:     { fontSize:22, fontWeight:'700', color:Colors.white },
  subtitle:  { fontSize:13, color:'rgba(255,255,255,0.75)', marginTop:2 },
  right:     { alignItems:'flex-end' },
});
