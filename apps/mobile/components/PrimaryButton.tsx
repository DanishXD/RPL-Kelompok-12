import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  title:    string;
  onPress:  () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  style?:   ViewStyle;
}

export default function PrimaryButton({ title, onPress, loading = false, disabled = false, variant = 'primary', style }: Props) {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.btn, variant === 'outline' && styles.outline, off && styles.disabled, style]}
      onPress={onPress} disabled={off} activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={variant === 'outline' ? Colors.primary : Colors.white} size="small" />
        : <Text style={[styles.text, variant === 'outline' && styles.textOutline, off && styles.textOff]}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:         { backgroundColor: Colors.primary, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  outline:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary, shadowOpacity: 0, elevation: 0 },
  disabled:    { backgroundColor: Colors.border, shadowOpacity: 0, elevation: 0 },
  text:        { fontSize: 16, fontWeight: '700', color: Colors.white },
  textOutline: { color: Colors.primary },
  textOff:     { color: Colors.textMuted },
});
