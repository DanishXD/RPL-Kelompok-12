import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import { useSensorStore } from '../../stores/sensorStore';
import { Colors } from '../../constants/colors';

interface Message {
  id:      string;
  role:    'user' | 'assistant';
  content: string;
  time:    string;
}

const SUGGESTIONS = [
  'Apakah suhu kolam aman?',
  'Kapan sebaiknya beri pakan?',
  'Kenapa pH harus dijaga?',
  'Berapa level pakan minimum?',
  'Analisis kondisi kolam saya',
];

function fmt(d: Date) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// ── Simulasi AI reply berbasis sensor context ─────────────────────────────────
// Nanti diganti dengan call ke Groq API (Step 9)
function getBotReply(msg: string, sensor: any): string {
  const m = msg.toLowerCase();
  const temp = sensor?.temperature;
  const ph   = sensor?.phLevel;
  const feed = sensor?.feedLevel;

  if (m.includes('analisis') || m.includes('kondisi')) {
    const tempStatus = !temp ? '—' : temp > 30 ? '⚠️ Tinggi' : temp < 26 ? '⚠️ Rendah' : '✅ Normal';
    const phStatus   = !ph   ? '—' : (ph < 6.5 || ph > 8.5) ? '⚠️ Abnormal' : '✅ Normal';
    const feedStatus = !feed ? '—' : feed < 20 ? '🔴 Kritis' : feed < 40 ? '⚠️ Rendah' : '✅ Aman';
    return `📊 Analisis Kondisi Kolam:\n\n🌡️ Suhu: ${temp ?? '—'}°C → ${tempStatus}\n💧 pH: ${ph ?? '—'} → ${phStatus}\n🌾 Pakan: ${feed ?? '—'}% → ${feedStatus}\n\n${
      (!temp && !ph && !feed)
        ? 'Sensor belum terhubung. Pastikan ESP32 sudah aktif dan terdaftar.'
        : 'Secara keseluruhan kondisi kolam perlu diperhatikan. Pantau terus dan segera ambil tindakan jika ada sensor yang abnormal.'
    }`;
  }
  if (m.includes('suhu')) {
    if (!temp) return 'Sensor suhu belum terhubung. Pastikan ESP32 sudah aktif.';
    if (temp > 32) return `🌡️ Suhu ${temp}°C terlalu tinggi! Segera periksa sistem aerasi dan kurangi kepadatan ikan. Suhu ideal untuk lele: 26–30°C.`;
    if (temp < 24) return `🌡️ Suhu ${temp}°C terlalu rendah! Pertimbangkan pemanas air atau tutup kolam agar suhu naik ke rentang 26–30°C.`;
    return `🌡️ Suhu ${temp}°C masih dalam batas normal (26–30°C). Kondisi baik untuk pertumbuhan ikan lele. Pantau terus jika cuaca sedang panas.`;
  }
  if (m.includes('ph')) {
    if (!ph) return 'Sensor pH belum terhubung. Pastikan ESP32 sudah aktif.';
    if (ph < 6.5) return `💧 pH ${ph} terlalu asam! Tambahkan kapur pertanian (CaCO₃) untuk menaikkan pH ke rentang 6.5–8.5.`;
    if (ph > 8.5) return `💧 pH ${ph} terlalu basa! Lakukan pergantian air sebagian (20–30%) untuk menurunkan pH.`;
    return `💧 pH ${ph} normal (rentang ideal 6.5–8.5). Air kolam dalam kondisi baik untuk ikan.`;
  }
  if (m.includes('pakan') || m.includes('jadwal')) {
    if (!feed) return 'Sensor level pakan belum terhubung.';
    if (feed < 10) return `🌾 DARURAT! Level pakan ${feed}% hampir habis. Segera isi ulang wadah pakan sebelum jadwal pemberian berikutnya!`;
    if (feed < 20) return `🌾 Level pakan ${feed}% sudah rendah. Sebaiknya isi ulang dalam 24 jam ke depan untuk menghindari kehabisan.`;
    return `🌾 Level pakan ${feed}% masih cukup. Estimasi sisa: ${((feed / 100) * 5).toFixed(1)} kg. Isi ulang saat level turun ke 20%.`;
  }
  if (m.includes('rekomendasi') || m.includes('saran')) {
    return `💡 Rekomendasi untuk kondisi saat ini:\n\n1. ${!temp || (temp >= 26 && temp <= 30) ? '✅ Suhu normal, pertahankan' : '⚠️ Atasi masalah suhu terlebih dahulu'}\n2. ${!ph || (ph >= 6.5 && ph <= 8.5) ? '✅ pH normal, tidak perlu tindakan' : '⚠️ Perbaiki pH air'}\n3. ${!feed || feed > 20 ? '✅ Pakan cukup' : '⚠️ Segera isi ulang pakan'}\n4. Jadwalkan pengecekan rutin 2x sehari\n5. Catat data harian untuk analisis jangka panjang`;
  }
  return `Saya memahami pertanyaan tentang "${msg}".\n\nData sensor saat ini:\n🌡️ Suhu: ${temp ?? '—'}°C\n💧 pH: ${ph ?? '—'}\n🌾 Pakan: ${feed ?? '—'}%\n\nAda yang ingin ditanyakan lebih spesifik tentang kondisi kolam?`;
}

export default function ChatScreen() {
  const { data: sensorData } = useSensorStore();

  const [messages, setMessages] = useState<Message[]>([{
    id: '0', role: 'assistant', time: fmt(new Date()),
    content: `Halo! 👋 Saya asisten AI EcoSmart Feeder.\n\nSaya terhubung dengan sensor kolam kamu secara real-time:\n🌡️ Suhu: ${sensorData?.temperature ?? '—'}°C\n💧 pH: ${sensorData?.phLevel ?? '—'}\n🌾 Pakan: ${sensorData?.feedLevel ?? '—'}%\n☀️ Cahaya: ${sensorData?.lightLevel ?? '—'} lx\n\nTanyakan apa saja tentang kondisi kolam!`,
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, time: fmt(new Date()) };
    setMessages((p) => [...p, userMsg]);
    setLoading(true);
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: getBotReply(msg, sensorData), time: fmt(new Date()),
      };
      setMessages((p) => [...p, reply]);
      setLoading(false);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="AI Chatbot"
        subtitle="Tanya kondisi kolam ke AI"
        showBack
        rightElement={
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>

        {/* Sensor context bar */}
        <View style={styles.ctxBar}>
          {[
            { icon: '🌡️', val: sensorData?.temperature !== undefined ? `${sensorData.temperature}°C` : '—' },
            { icon: '💧', val: sensorData?.phLevel      !== undefined ? `pH ${sensorData.phLevel}`   : '—' },
            { icon: '🌾', val: sensorData?.feedLevel    !== undefined ? `${sensorData.feedLevel}%`   : '—' },
            { icon: '☀️', val: sensorData?.lightLevel   !== undefined ? `${sensorData.lightLevel}lx` : '—' },
          ].map((item) => (
            <View key={item.icon} style={styles.ctxItem}>
              <Text style={styles.ctxIcon}>{item.icon}</Text>
              <Text style={styles.ctxVal}>{item.val}</Text>
            </View>
          ))}
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.msgs}
          contentContainerStyle={styles.msgsContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => (
            <View key={m.id} style={[styles.msgRow, m.role === 'user' && styles.msgRowUser]}>
              {m.role === 'assistant' && (
                <View style={styles.botAvatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
              )}
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleTxt, m.role === 'user' && styles.bubbleTxtUser]}>{m.content}</Text>
                <Text style={[styles.bubbleTime, m.role === 'user' && styles.bubbleTimeUser]}>{m.time}</Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={styles.msgRow}>
              <View style={styles.botAvatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
              <View style={styles.bubbleBot}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={{ fontSize: 13, color: Colors.textSecondary }}>AI sedang memproses...</Text>
                </View>
              </View>
            </View>
          )}

          {/* Suggestions */}
          {messages.length === 1 && (
            <View style={styles.suggs}>
              <Text style={styles.suggsLabel}>Coba tanya:</Text>
              <View style={styles.suggsGrid}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity key={s} style={styles.suggBtn} onPress={() => send(s)} activeOpacity={0.7}>
                    <Text style={styles.suggTxt}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Tanya kondisi kolam..."
            placeholderTextColor={Colors.textMuted}
            multiline maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
            onPress={() => send()} disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  onlineDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  onlineText:  { fontSize: 12, color: Colors.white, fontWeight: '600' },
  ctxBar:      { flexDirection: 'row', backgroundColor: Colors.primaryBg, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  ctxItem:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  ctxIcon:     { fontSize: 13 },
  ctxVal:      { fontSize: 11, fontWeight: '600', color: Colors.primary },
  msgs:        { flex: 1 },
  msgsContent: { padding: 16, gap: 12, paddingBottom: 8 },
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser:  { flexDirection: 'row-reverse' },
  botAvatar:   { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  bubble:      { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleBot:   { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleUser:  { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTxt:   { fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
  bubbleTxtUser:  { color: Colors.white },
  bubbleTime:  { fontSize: 11, color: Colors.textMuted, marginTop: 6, textAlign: 'right' },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.65)' },
  suggs:       { marginTop: 8, gap: 8 },
  suggsLabel:  { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  suggsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  suggTxt:     { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  inputBar:    { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.border },
  input:       { flex: 1, minHeight: 44, maxHeight: 100, backgroundColor: Colors.bgPage, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  sendBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff:  { backgroundColor: Colors.border },
  sendIcon:    { fontSize: 20, color: Colors.white, fontWeight: '700', marginTop: -2 },
});
