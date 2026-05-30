import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
export default function AIChatFAB() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue:1.08, duration:1200, useNativeDriver:true }),
      Animated.timing(pulse, { toValue:1,    duration:1200, useNativeDriver:true }),
    ]));
    a.start(); return () => a.stop();
  }, []);
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.tooltip}><Text style={styles.tooltipText}>Tanya AI</Text></View>
      <Animated.View style={{ transform:[{ scale:pulse }] }}>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/(app)/chat')} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>🤖</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper:     { position:'absolute', bottom:90, right:20, alignItems:'center', gap:6 },
  tooltip:     { backgroundColor:Colors.primaryDark, paddingHorizontal:10, paddingVertical:4, borderRadius:12, elevation:3 },
  tooltipText: { color:Colors.white, fontSize:11, fontWeight:'600' },
  fab:         { width:60, height:60, borderRadius:30, backgroundColor:Colors.primary, alignItems:'center', justifyContent:'center', elevation:8 },
  fabIcon:     { fontSize:28 },
});
