import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { Colors } from '../../constants/colors';

interface FormErrors { name?: string; email?: string; password?: string; confirm?: string; }

function validate(name: string, email: string, password: string, confirm: string): FormErrors {
  const e: FormErrors = {};
  if (!name.trim() || name.trim().length < 2) e.name = 'Nama minimal 2 karakter';
  if (!email.trim()) e.email = 'Email wajib diisi';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Format email tidak valid';
  if (!password) e.password = 'Password wajib diisi';
  else if (password.length < 8) e.password = 'Password minimal 8 karakter';
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) e.password = 'Harus ada huruf besar, kecil, dan angka';
  if (confirm !== password) e.confirm = 'Password tidak cocok';
  return e;
}

function getStrength(p: string): { level: number; label: string; color: string } {
  if (!p) return { level: 0, label: '', color: Colors.border };
  let s = 0;
  if (p.length >= 8)           s++;
  if (/[A-Z]/.test(p))         s++;
  if (/[0-9]/.test(p))         s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  if (s <= 1) return { level: 1, label: 'Lemah',  color: Colors.danger  };
  if (s === 2) return { level: 2, label: 'Sedang', color: Colors.warning };
  return              { level: 3, label: 'Kuat',   color: Colors.success };
}

export default function SignupScreen() {
  const { register } = useAuthStore();
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const strength = getStrength(pass);
  const clear = (f: keyof FormErrors) => setErrors((e) => ({ ...e, [f]: undefined }));

  const handleRegister = async () => {
    const errs = validate(name, email, pass, confirm);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), pass);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Gagal daftar. Cek koneksi internet.';
      if (msg.toLowerCase().includes('sudah')) setErrors({ email: 'Email sudah terdaftar' });
      else Alert.alert('Pendaftaran Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>🐟</Text>
          </View>
          <Text style={styles.appName}>Buat Akun Baru</Text>
          <Text style={styles.tagline}>Mulai monitoring kolam ikanmu sekarang</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Diri</Text>

          <FormInput label="Nama Lengkap" placeholder="Budi Suryanto" value={name}
            onChangeText={(t) => { setName(t); clear('name'); }} error={errors.name}
            returnKeyType="next" autoCapitalize="words" />

          <FormInput label="Email" placeholder="budi@example.com" keyboardType="email-address"
            value={email} onChangeText={(t) => { setEmail(t); clear('email'); }}
            error={errors.email} returnKeyType="next" />

          <FormInput label="Password" placeholder="Min. 8 karakter" isPassword
            value={pass} onChangeText={(t) => { setPass(t); clear('password'); }}
            error={errors.password} returnKeyType="next" />

          {/* Strength bar */}
          {pass.length > 0 && (
            <View style={styles.strengthRow}>
              <View style={styles.strengthBars}>
                {[1, 2, 3].map((l) => (
                  <View key={l} style={[styles.strengthBar,
                    { backgroundColor: strength.level >= l ? strength.color : Colors.border }]} />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}

          <FormInput label="Konfirmasi Password" placeholder="Ulangi password" isPassword
            value={confirm} onChangeText={(t) => { setConfirm(t); clear('confirm'); }}
            error={errors.confirm} returnKeyType="done" onSubmitEditing={handleRegister} />

          {/* Requirements */}
          <View style={styles.reqs}>
            {[
              { text: 'Minimal 8 karakter',    met: pass.length >= 8 },
              { text: 'Ada huruf besar',        met: /[A-Z]/.test(pass) },
              { text: 'Ada angka',              met: /[0-9]/.test(pass) },
            ].map((r) => (
              <View key={r.text} style={styles.reqRow}>
                <Ionicons
                  name={r.met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={r.met ? Colors.success : Colors.textMuted}
                />
                <Text style={[styles.reqText, { color: r.met ? Colors.success : Colors.textMuted }]}>
                  {r.text}
                </Text>
              </View>
            ))}
          </View>

          <PrimaryButton title="Buat Akun" onPress={handleRegister} loading={loading} style={{ marginBottom: 16 }} />

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLink}>Masuk di sini</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bgPage },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 60, paddingBottom: 52,
    alignItems: 'center', gap: 8,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
  },
  backBtn: {
    position: 'absolute', top: 60, left: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  logoEmoji: { fontSize: 36 },
  appName:  { fontSize: 22, fontWeight: '800', color: Colors.white },
  tagline:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingHorizontal: 32 },
  card: {
    marginHorizontal: 20, marginTop: -24,
    backgroundColor: Colors.bgCard, borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, marginBottom: 12 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar:  { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 48, textAlign: 'right' },
  reqs: { backgroundColor: Colors.bgPage, borderRadius: 10, padding: 12, gap: 6, marginBottom: 20 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { fontSize: 12 },
  loginRow: { flexDirection: 'row', justifyContent: 'center' },
  loginText: { fontSize: 14, color: Colors.textSecondary },
  loginLink: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
