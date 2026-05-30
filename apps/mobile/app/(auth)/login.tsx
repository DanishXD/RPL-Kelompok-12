import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { Colors } from '../../constants/colors';
interface FormErrors { email?: string; password?: string; }
function validate(email: string, password: string): FormErrors {
  const e: FormErrors = {};
  if (!email.trim()) e.email = 'Email wajib diisi';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Format email tidak valid';
  if (!password) e.password = 'Password wajib diisi';
  else if (password.length < 8) e.password = 'Password minimal 8 karakter';
  return e;
}
export default function LoginScreen() {
  const { login } = useAuthStore();
  const [email,   setEmail]   = useState('');
  const [password,setPassword]= useState('');
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    const errs = validate(email, password);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({}); setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Gagal login. Cek koneksi internet.';
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('email')) setErrors({ email:'Email atau password salah', password:'Email atau password salah' });
      else Alert.alert('Login Gagal', msg);
    } finally { setLoading(false); }
  };
  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoWrap}><Text style={styles.logoEmoji}>🐟</Text></View>
          <Text style={styles.appName}>EcoSmart Feeder</Text>
          <Text style={styles.tagline}>Monitoring kolam ikan otomatis</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Masuk ke Akun</Text>
          <Text style={styles.cardSub}>Masukkan email dan password untuk melanjutkan</Text>
          <View style={styles.form}>
            <FormInput label="Email" placeholder="budi@example.com" keyboardType="email-address" value={email} onChangeText={(t)=>{setEmail(t); if(errors.email) setErrors(e=>({...e,email:undefined}));}} error={errors.email} returnKeyType="next" />
            <FormInput label="Password" placeholder="Masukkan password" isPassword value={password} onChangeText={(t)=>{setPassword(t); if(errors.password) setErrors(e=>({...e,password:undefined}));}} error={errors.password} returnKeyType="done" onSubmitEditing={handleLogin} />
          </View>
          <PrimaryButton title="Masuk" onPress={handleLogin} loading={loading} />
          <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>atau</Text><View style={styles.dividerLine} /></View>
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Belum punya akun? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}><Text style={styles.signupLink}>Daftar sekarang</Text></TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scroll:        { flex:1, backgroundColor:Colors.bgPage },
  scrollContent: { flexGrow:1, paddingBottom:40 },
  header:        { backgroundColor:Colors.primary, paddingTop:80, paddingBottom:52, alignItems:'center', gap:8, borderBottomLeftRadius:32, borderBottomRightRadius:32 },
  logoWrap:      { width:80, height:80, borderRadius:40, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center', marginBottom:4 },
  logoEmoji:     { fontSize:40 },
  appName:       { fontSize:26, fontWeight:'800', color:Colors.white },
  tagline:       { fontSize:14, color:'rgba(255,255,255,0.75)' },
  card:          { marginHorizontal:20, marginTop:-24, backgroundColor:Colors.bgCard, borderRadius:24, padding:24, elevation:6 },
  cardTitle:     { fontSize:22, fontWeight:'700', color:Colors.textPrimary, marginBottom:4 },
  cardSub:       { fontSize:14, color:Colors.textSecondary, marginBottom:24, lineHeight:20 },
  form:          { marginBottom:8 },
  divider:       { flexDirection:'row', alignItems:'center', marginVertical:20 },
  dividerLine:   { flex:1, height:1, backgroundColor:Colors.border },
  dividerText:   { marginHorizontal:12, fontSize:13, color:Colors.textMuted },
  signupRow:     { flexDirection:'row', justifyContent:'center', alignItems:'center' },
  signupText:    { fontSize:14, color:Colors.textSecondary },
  signupLink:    { fontSize:14, fontWeight:'700', color:Colors.primary },
});
