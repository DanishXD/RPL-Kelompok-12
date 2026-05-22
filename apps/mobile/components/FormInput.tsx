import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface Props extends TextInputProps { label: string; error?: string; isPassword?: boolean; }

export default function FormInput({ label, error, isPassword = false, ...props }: Props) {
  const [show,    setShow]    = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.focused, !!error && styles.errBorder]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isPassword && !show}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShow(v => !v)} style={styles.eye} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {!!error && (
        <View style={styles.errRow}>
          <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
          <Text style={styles.errText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:      { marginBottom: 16 },
  label:     { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgPage, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, height: 52 },
  focused:   { borderColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  errBorder: { borderColor: Colors.danger },
  input:     { flex: 1, fontSize: 15, color: Colors.textPrimary, paddingVertical: 0 },
  eye:       { paddingLeft: 8 },
  errRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errText:   { fontSize: 12, color: Colors.danger, flex: 1 },
});
