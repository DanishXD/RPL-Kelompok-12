import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import ScreenHeader from "../../components/ScreenHeader";
import { useSensorStore } from "../../stores/sensorStore";
import { DEVICE_KEYS } from "./setup-device";
import api from "../../lib/api";
import { Colors } from "../../constants/colors";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
}

const SUGGESTIONS = [
  "Analisis kondisi kolam saya",
  "Apakah suhu kolam aman?",
  "Kapan sebaiknya beri pakan?",
  "pH air saya normal tidak?",
  "Level pakan aman?",
  "Berikan rekomendasi hari ini",
];

function fmt(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const { data: sensorData, activeDeviceId } = useSensorStore();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [apiReady, setApiReady] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Baca deviceId dari SecureStore otomatis
  useEffect(() => {
    const load = async () => {
      const id = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_ID);
      setDeviceId(id);
    };
    load();
  }, []);

  // Welcome message
  useEffect(() => {
    setMessages([
      {
        id: "0",
        role: "assistant",
        time: fmt(new Date()),
        content:
          `Halo! 👋 Saya asisten AI EcoSmart Feeder.\n\n` +
          `Data sensor kolam saat ini:\n` +
          `🌡️ Suhu   : ${sensorData?.temperature ?? "—"}°C\n` +
          `💧 pH     : ${sensorData?.phLevel ?? "—"}\n` +
          `🌾 Pakan  : ${sensorData?.feedLevel ?? "—"}%\n` +
          `☀️ Cahaya : ${sensorData?.lightLevel ?? "—"} lx\n\n` +
          `Tanyakan apa saja tentang kondisi kolam kamu!`,
      },
    ]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: msg,
        time: fmt(new Date()),
      },
    ]);
    setLoading(true);

    try {
      const { data } = await api.post("/chat/message", {
        message: msg,
        sessionId: sessionId,
        ...((activeDeviceId ?? deviceId)
          ? { deviceId: activeDeviceId ?? deviceId }
          : {}),
      });

      if (data.data.sessionId && !sessionId) setSessionId(data.data.sessionId);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.data.reply,
          time: fmt(new Date()),
        },
      ]);
      setApiReady(true);
    } catch (err: any) {
      console.log("❌ Chat error status:", err?.response?.status);
      console.log("❌ Chat error data:", JSON.stringify(err?.response?.data));
      console.log("❌ Chat error:", err?.code, err?.message);

      const status = err?.response?.status;
      const errData = err?.response?.data?.error ?? "";

      let errorMsg: string;
      if (!err?.response) {
        errorMsg =
          err?.code === "ECONNABORTED"
            ? "⏱️ Server terlalu lama merespons. Coba lagi dalam 30 detik (Render cold start)."
            : "❌ Tidak bisa terhubung ke server. Cek koneksi internet kamu.";
      } else if (status === 401) {
        errorMsg = "❌ Sesi login expired. Silakan logout dan login ulang.";
      } else if (errData.includes("GROQ")) {
        errorMsg = "⚠️ GROQ_API_KEY belum diisi di .env backend.";
      } else {
        errorMsg = `❌ Error ${status ?? "unknown"}: ${errData || err?.message}`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          time: fmt(new Date()),
          content: errorMsg,
        },
      ]);
      setApiReady(false);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setSessionId(undefined);
    setMessages([
      {
        id: Date.now().toString(),
        role: "assistant",
        time: fmt(new Date()),
        content:
          "Percakapan baru dimulai! Ada yang ingin ditanyakan tentang kolam kamu?",
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="AI Chatbot"
        subtitle="Tanya kondisi kolam ke AI"
        showBack
        rightElement={
          <View style={styles.headerRight}>
            <View
              style={[
                styles.aiBadge,
                {
                  backgroundColor: apiReady
                    ? Colors.successBg
                    : Colors.dangerBg,
                },
              ]}
            >
              <View
                style={[
                  styles.aiDot,
                  {
                    backgroundColor: apiReady ? Colors.success : Colors.danger,
                  },
                ]}
              />
              <Text
                style={[
                  styles.aiText,
                  { color: apiReady ? Colors.success : Colors.danger },
                ]}
              >
                {apiReady ? "Groq AI" : "Error"}
              </Text>
            </View>
            <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Baru</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Sensor context bar */}
        <View style={styles.ctxBar}>
          {[
            {
              icon: "🌡️",
              val:
                sensorData?.temperature !== undefined
                  ? `${sensorData.temperature}°C`
                  : "—",
            },
            {
              icon: "💧",
              val:
                sensorData?.phLevel !== undefined
                  ? `pH ${sensorData.phLevel}`
                  : "—",
            },
            {
              icon: "🌾",
              val:
                sensorData?.feedLevel !== undefined
                  ? `${sensorData.feedLevel}%`
                  : "—",
            },
            {
              icon: "☀️",
              val:
                sensorData?.lightLevel !== undefined
                  ? `${sensorData.lightLevel}lx`
                  : "—",
            },
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
            <View
              key={m.id}
              style={[styles.msgRow, m.role === "user" && styles.msgRowUser]}
            >
              {m.role === "assistant" && (
                <View style={styles.botAvatar}>
                  <Text style={{ fontSize: 16 }}>🤖</Text>
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  m.role === "user" ? styles.bubbleUser : styles.bubbleBot,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleTxt,
                    m.role === "user" && styles.bubbleTxtUser,
                  ]}
                >
                  {m.content}
                </Text>
                <Text
                  style={[
                    styles.bubbleTime,
                    m.role === "user" && styles.bubbleTimeUser,
                  ]}
                >
                  {m.time}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={styles.msgRow}>
              <View style={styles.botAvatar}>
                <Text style={{ fontSize: 16 }}>🤖</Text>
              </View>
              <View style={styles.bubbleBot}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
                    AI sedang memproses...
                  </Text>
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
                  <TouchableOpacity
                    key={s}
                    style={styles.suggBtn}
                    onPress={() => send(s)}
                    activeOpacity={0.7}
                  >
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
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || loading) && styles.sendBtnOff,
            ]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  aiDot: { width: 7, height: 7, borderRadius: 4 },
  aiText: { fontSize: 11, fontWeight: "700" },
  clearBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearBtnText: { fontSize: 12, color: Colors.white, fontWeight: "600" },
  ctxBar: {
    flexDirection: "row",
    backgroundColor: Colors.primaryBg,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ctxItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  ctxIcon: { fontSize: 13 },
  ctxVal: { fontSize: 11, fontWeight: "600", color: Colors.primary },
  msgs: { flex: 1 },
  msgsContent: { padding: 16, gap: 12, paddingBottom: 8 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowUser: { flexDirection: "row-reverse" },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: 12 },
  bubbleBot: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTxt: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
  bubbleTxtUser: { color: Colors.white },
  bubbleTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: "right",
  },
  bubbleTimeUser: { color: "rgba(255,255,255,0.65)" },
  suggs: { marginTop: 8, gap: 8 },
  suggsLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  suggsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggTxt: { fontSize: 13, color: Colors.primary, fontWeight: "500" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: Colors.bgPage,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnOff: { backgroundColor: Colors.border },
  sendIcon: {
    fontSize: 20,
    color: Colors.white,
    fontWeight: "700",
    marginTop: -2,
  },
});
