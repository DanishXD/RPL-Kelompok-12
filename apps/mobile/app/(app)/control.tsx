import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import ScreenHeader from "../../components/ScreenHeader";
import AIChatFAB from "../../components/AIChatFAB";
import { useSensorStore } from "../../stores/sensorStore";
import { useScheduleStore } from "../../stores/scheduleStore";
import { DEVICE_KEYS } from "./setup-device";
import api from "../../lib/api";
import { Colors } from "../../constants/colors";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Schedule {
  id: string;
  time: string;
  amount: string;
  days: string[];
  isActive: boolean;
  note?: string;
}

interface DayOption {
  key: string;
  label: string;
  short: string;
}

const DAY_OPTIONS: DayOption[] = [
  { key: "everyday", label: "Setiap Hari", short: "Tiap" },
  { key: "monday", label: "Senin", short: "Sen" },
  { key: "tuesday", label: "Selasa", short: "Sel" },
  { key: "wednesday", label: "Rabu", short: "Rab" },
  { key: "thursday", label: "Kamis", short: "Kam" },
  { key: "friday", label: "Jum'at", short: "Jum" },
  { key: "saturday", label: "Sabtu", short: "Sab" },
  { key: "sunday", label: "Minggu", short: "Min" },
];

const AMOUNT_PRESETS = ["50g", "75g", "100g", "120g", "150g", "200g"];

function formatDays(days: string[]): string {
  if (days.includes("everyday")) return "Setiap hari";
  return days
    .map((d) => DAY_OPTIONS.find((o) => o.key === d)?.short ?? d)
    .join(", ");
}

// ── Add/Edit Schedule Modal ───────────────────────────────────────────────────

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Schedule, "id">) => Promise<void>;
  editData?: Schedule | null;
}

function ScheduleModal({
  visible,
  onClose,
  onSave,
  editData,
}: ScheduleModalProps) {
  const [timeHour, setTimeHour] = useState("07");
  const [timeMinute, setTimeMinute] = useState("00");
  const [amount, setAmount] = useState("100g");
  const [customAmt, setCustomAmt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [days, setDays] = useState<string[]>(["everyday"]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill kalau edit
  useEffect(() => {
    if (editData) {
      const [h, m] = editData.time.split(":");
      setTimeHour(h);
      setTimeMinute(m);
      if (AMOUNT_PRESETS.includes(editData.amount)) {
        setAmount(editData.amount);
        setUseCustom(false);
      } else {
        setUseCustom(true);
        setCustomAmt(editData.amount);
      }
      setDays(editData.days);
      setNote(editData.note ?? "");
    } else {
      setTimeHour("07");
      setTimeMinute("00");
      setAmount("100g");
      setCustomAmt("");
      setUseCustom(false);
      setDays(["everyday"]);
      setNote("");
    }
  }, [editData, visible]);

  const toggleDay = (key: string) => {
    if (key === "everyday") {
      setDays(["everyday"]);
      return;
    }
    setDays((prev) => {
      const without = prev.filter((d) => d !== "everyday");
      if (without.includes(key)) {
        const next = without.filter((d) => d !== key);
        return next.length === 0 ? ["everyday"] : next;
      }
      return [...without, key];
    });
  };

  const handleSave = async () => {
    const h = parseInt(timeHour);
    const m = parseInt(timeMinute);
    if (isNaN(h) || h < 0 || h > 23) {
      Alert.alert("Error", "Jam harus antara 00–23");
      return;
    }
    if (isNaN(m) || m < 0 || m > 59) {
      Alert.alert("Error", "Menit harus antara 00–59");
      return;
    }
    const finalAmount = useCustom ? customAmt.trim() : amount;
    if (!finalAmount) {
      Alert.alert("Error", "Jumlah pakan wajib diisi");
      return;
    }
    if (days.length === 0) {
      Alert.alert("Error", "Pilih minimal 1 hari");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        time: `${timeHour.padStart(2, "0")}:${timeMinute.padStart(2, "0")}`,
        amount: finalAmount,
        days,
        isActive: true,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Gagal",
        err?.response?.data?.error ?? "Gagal menyimpan jadwal",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={modal.container}>
        {/* Header */}
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.cancelBtn}>
            <Text style={modal.cancelText}>Batal</Text>
          </TouchableOpacity>
          <Text style={modal.headerTitle}>
            {editData ? "Edit Jadwal" : "Tambah Jadwal"}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={modal.saveBtn}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={modal.saveText}>Simpan</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={modal.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Waktu */}
          <Text style={modal.sectionLabel}>WAKTU PEMBERIAN</Text>
          <View style={modal.card}>
            <View style={modal.timeRow}>
              <View style={modal.timeGroup}>
                <Text style={modal.timeLabel}>Jam</Text>
                <View style={modal.timeInputWrap}>
                  <TouchableOpacity
                    onPress={() =>
                      setTimeHour((h) =>
                        String(Math.max(0, parseInt(h) - 1)).padStart(2, "0"),
                      )
                    }
                    style={modal.timeArrow}
                  >
                    <Text style={modal.timeArrowText}>▲</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={modal.timeInput}
                    value={timeHour}
                    onChangeText={(v) =>
                      setTimeHour(v.replace(/\D/, "").slice(0, 2))
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setTimeHour((h) =>
                        String(Math.min(23, parseInt(h) + 1)).padStart(2, "0"),
                      )
                    }
                    style={modal.timeArrow}
                  >
                    <Text style={modal.timeArrowText}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={modal.timeSeparator}>:</Text>

              <View style={modal.timeGroup}>
                <Text style={modal.timeLabel}>Menit</Text>
                <View style={modal.timeInputWrap}>
                  <TouchableOpacity
                    onPress={() =>
                      setTimeMinute((m) =>
                        String(Math.max(0, parseInt(m) - 1)).padStart(2, "0"),
                      )
                    }
                    style={modal.timeArrow}
                  >
                    <Text style={modal.timeArrowText}>▲</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={modal.timeInput}
                    value={timeMinute}
                    onChangeText={(v) =>
                      setTimeMinute(v.replace(/\D/, "").slice(0, 2))
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setTimeMinute((m) =>
                        String(Math.min(59, parseInt(m) + 1)).padStart(2, "0"),
                      )
                    }
                    style={modal.timeArrow}
                  >
                    <Text style={modal.timeArrowText}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={modal.timePreview}>
                <Text style={modal.timePreviewLabel}>Jadwal</Text>
                <Text style={modal.timePreviewValue}>
                  {timeHour.padStart(2, "0")}:{timeMinute.padStart(2, "0")}
                </Text>
              </View>
            </View>
          </View>

          {/* Jumlah Pakan */}
          <Text style={modal.sectionLabel}>JUMLAH PAKAN</Text>
          <View style={modal.card}>
            <View style={modal.amountGrid}>
              {AMOUNT_PRESETS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[
                    modal.amountChip,
                    !useCustom && amount === a && modal.amountChipActive,
                  ]}
                  onPress={() => {
                    setAmount(a);
                    setUseCustom(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      modal.amountChipText,
                      !useCustom && amount === a && modal.amountChipTextActive,
                    ]}
                  >
                    {a}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[modal.amountChip, useCustom && modal.amountChipActive]}
                onPress={() => setUseCustom(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    modal.amountChipText,
                    useCustom && modal.amountChipTextActive,
                  ]}
                >
                  Custom
                </Text>
              </TouchableOpacity>
            </View>
            {useCustom && (
              <View style={modal.customAmtRow}>
                <TextInput
                  style={modal.customAmtInput}
                  value={customAmt}
                  onChangeText={setCustomAmt}
                  placeholder="Contoh: 250g"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                />
              </View>
            )}
          </View>

          {/* Hari */}
          <Text style={modal.sectionLabel}>HARI PEMBERIAN</Text>
          <View style={modal.card}>
            <View style={modal.daysGrid}>
              {DAY_OPTIONS.map((opt) => {
                const isSelected = days.includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      modal.dayChip,
                      isSelected && modal.dayChipActive,
                      opt.key === "everyday" && modal.dayChipEveryday,
                    ]}
                    onPress={() => toggleDay(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        modal.dayChipText,
                        isSelected && modal.dayChipTextActive,
                      ]}
                    >
                      {opt.short}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={modal.daysSelected}>Terpilih: {formatDays(days)}</Text>
          </View>

          {/* Catatan */}
          <Text style={modal.sectionLabel}>CATATAN (OPSIONAL)</Text>
          <View style={modal.card}>
            <TextInput
              style={modal.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Contoh: Pakan setelah filter bersih"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={200}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main Control Screen ───────────────────────────────────────────────────────

export default function ControlScreen() {
  const { data } = useSensorStore();
  const { setSchedules: syncToStore } = useScheduleStore();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadingSched, setLoadingSched] = useState(true);
  const [override, setOverride] = useState(false);
  const [relayOn, setRelayOn] = useState(true);
  const [motorOn, setMotorOn] = useState(false);
  const [feeding, setFeeding] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    const loadDevice = async () => {
      const id = await SecureStore.getItemAsync(DEVICE_KEYS.DEVICE_ID);
      setDeviceId(id);
      if (id) loadSchedules(id);
      else setLoadingSched(false);
    };
    loadDevice();
  }, []);

  const loadSchedules = useCallback(
    async (id: string) => {
      setLoadingSched(true);
      try {
        const { data: res } = await api.get(`/schedules?deviceId=${id}`);
        setSchedules(res.data);
        syncToStore(res.data); // sync ke global store
      } catch {
        // API gagal — tampilkan kosong, bukan data palsu
        setSchedules([]);
        syncToStore([]);
      } finally {
        setLoadingSched(false);
      }
    },
    [syncToStore],
  );

  const handleAddSchedule = async (data: Omit<Schedule, "id">) => {
    if (!deviceId) throw new Error("Device belum terhubung");
    const { data: res } = await api.post("/schedules", { deviceId, ...data });
    setSchedules((prev) => {
      const updated = [...prev, res.data].sort((a, b) =>
        a.time.localeCompare(b.time),
      );
      syncToStore(updated);
      return updated;
    });
  };

  const handleEditSchedule = async (data: Omit<Schedule, "id">) => {
    if (!editSchedule) return;
    const { data: res } = await api.patch(
      `/schedules/${editSchedule.id}`,
      data,
    );
    setSchedules((prev) => {
      const updated = prev.map((s) =>
        s.id === editSchedule.id ? res.data : s,
      );
      syncToStore(updated);
      return updated;
    });
    setEditSchedule(null);
  };

  const handleToggleSchedule = async (schedule: Schedule) => {
    try {
      await api.patch(`/schedules/${schedule.id}`, {
        isActive: !schedule.isActive,
      });
      setSchedules((prev) => {
        const updated = prev.map((s) =>
          s.id === schedule.id ? { ...s, isActive: !s.isActive } : s,
        );
        syncToStore(updated);
        return updated;
      });
    } catch {
      Alert.alert("Error", "Gagal mengubah status jadwal");
    }
  };

  const handleDeleteSchedule = (schedule: Schedule) => {
    Alert.alert("Hapus Jadwal", `Hapus jadwal ${schedule.time}?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/schedules/${schedule.id}`);
            setSchedules((prev) => {
              const updated = prev.filter((s) => s.id !== schedule.id);
              syncToStore(updated);
              return updated;
            });
          } catch {
            Alert.alert("Error", "Gagal menghapus jadwal");
          }
        },
      },
    ]);
  };

  const executeFeed = () => {
    setFeeding(true);
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setFeeding(false);
          Alert.alert("✅ Berhasil", "Pakan berhasil diberikan!");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleFeedNow = () => {
    if (data?.feedLevel !== undefined && data.feedLevel < 5) {
      Alert.alert(
        "⚠️ Pakan Hampir Habis",
        `Level pakan hanya ${data.feedLevel}%. Lanjutkan?`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjutkan", onPress: executeFeed },
        ],
      );
    } else {
      Alert.alert("Beri Pakan", "Yakin ingin memberi pakan sekarang?", [
        { text: "Batal", style: "cancel" },
        { text: "Ya, Beri Pakan", onPress: executeFeed },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Kontrol Pakan"
        subtitle="Jadwal & Pemberian Manual"
        showBack
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Pemberian Manual */}
        <Text style={styles.sectionTitle}>Pemberian Manual</Text>
        <View style={styles.card}>
          <View style={styles.manualRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.manualTitle}>Beri Pakan Sekarang</Text>
              <Text style={styles.manualSub}>
                Kontrol manual pemberian pakan
              </Text>
            </View>
            <View
              style={[
                styles.readyBadge,
                {
                  borderColor:
                    !feeding && relayOn ? Colors.primary : Colors.textMuted,
                  backgroundColor:
                    !feeding && relayOn ? Colors.primaryBg : Colors.borderLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.readyText,
                  {
                    color:
                      !feeding && relayOn ? Colors.primary : Colors.textMuted,
                  },
                ]}
              >
                {!feeding && relayOn
                  ? "Relay Siap"
                  : feeding
                    ? `${countdown}s...`
                    : "Relay OFF"}
              </Text>
            </View>
          </View>
          {data?.feedLevel !== undefined && data.feedLevel < 20 && (
            <View style={styles.feedWarn}>
              <Text style={styles.feedWarnIcon}>⚠️</Text>
              <Text style={styles.feedWarnText}>
                Level pakan {data.feedLevel}% —{" "}
                {data.feedLevel < 10 ? "KRITIS!" : "Hampir habis"}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.feedNowBtn,
              (feeding || !relayOn) && styles.feedNowBtnOff,
            ]}
            onPress={handleFeedNow}
            disabled={feeding || !relayOn}
            activeOpacity={0.85}
          >
            <Text style={styles.feedNowBtnText}>
              {feeding
                ? `⏳ Memberi Pakan... ${countdown}s`
                : "⚡ Beri Pakan Sekarang"}
            </Text>
          </TouchableOpacity>
          {feeding && (
            <View style={styles.feedProgressBg}>
              <View
                style={[
                  styles.feedProgressFill,
                  { width: `${((5 - countdown) / 5) * 100}%` as any },
                ]}
              />
            </View>
          )}
        </View>

        {/* Override */}
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Override Jadwal Otomatis</Text>
              <Text style={styles.switchSub}>
                Nonaktifkan sementara semua jadwal
              </Text>
            </View>
            <Switch
              value={override}
              onValueChange={setOverride}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={override ? Colors.primary : Colors.white}
            />
          </View>
          {override && (
            <View style={styles.overrideWarn}>
              <Text style={styles.overrideWarnText}>
                ⚠️ Semua jadwal otomatis dinonaktifkan sementara
              </Text>
            </View>
          )}
        </View>

        {/* Status Relay */}
        <Text style={styles.sectionTitle}>Status Relay & Motor</Text>
        <View style={styles.card}>
          {[
            {
              label: "Relay Pakan",
              sub: "Servo motor pembuka",
              val: relayOn,
              set: setRelayOn,
            },
            {
              label: "Motor Conveyor",
              sub: "Penyalur pakan",
              val: motorOn,
              set: setMotorOn,
            },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>{item.label}</Text>
                  <Text style={styles.switchSub}>{item.sub}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: item.val
                        ? Colors.primaryBg
                        : Colors.borderLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: item.val ? Colors.primary : Colors.textMuted },
                    ]}
                  >
                    {item.val ? "ON" : "OFF"}
                  </Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Jadwal Otomatis */}
        <View style={styles.schedulesHeader}>
          <Text style={styles.sectionTitle}>
            Jadwal Otomatis ({schedules.length})
          </Text>
          {deviceId && (
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => loadSchedules(deviceId)}
            >
              <Text style={styles.refreshBtnText}>🔄</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingSched ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Memuat jadwal...</Text>
          </View>
        ) : schedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>
              Belum ada jadwal. Tambah jadwal pertama kamu!
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {schedules.map((s, i, arr) => (
              <React.Fragment key={s.id}>
                <View style={styles.scheduleRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.scheduleTime,
                        (override || !s.isActive) && {
                          color: Colors.textMuted,
                        },
                      ]}
                    >
                      {s.time}
                    </Text>
                    <Text style={styles.scheduleSub}>
                      {s.amount} — {formatDays(s.days)}
                    </Text>
                    {s.note && (
                      <Text style={styles.scheduleNote}>📝 {s.note}</Text>
                    )}
                  </View>

                  {/* Edit button */}
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => {
                      setEditSchedule(s);
                      setModalVisible(true);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.editBtnText}>✏️</Text>
                  </TouchableOpacity>

                  {/* Delete button */}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteSchedule(s)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deleteBtnText}>🗑️</Text>
                  </TouchableOpacity>

                  {/* Toggle switch */}
                  <Switch
                    value={s.isActive && !override}
                    onValueChange={() => !override && handleToggleSchedule(s)}
                    disabled={override}
                    trackColor={{
                      false: Colors.border,
                      true: Colors.primaryLight,
                    }}
                    thumbColor={
                      s.isActive && !override ? Colors.primary : Colors.white
                    }
                  />
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Tombol tambah jadwal */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setEditSchedule(null);
            setModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnIcon}>+</Text>
          <Text style={styles.addBtnText}>Tambah Jadwal Baru</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Tambah/Edit */}
      <ScheduleModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditSchedule(null);
        }}
        onSave={editSchedule ? handleEditSchedule : handleAddSchedule}
        editData={editSchedule}
      />

      <AIChatFAB />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  manualRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  manualTitle: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary },
  manualSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  readyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  readyText: { fontSize: 12, fontWeight: "600" },
  feedWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warningBg,
    borderRadius: 10,
    padding: 10,
  },
  feedWarnIcon: { fontSize: 16 },
  feedWarnText: { fontSize: 13, color: "#92400E", fontWeight: "500", flex: 1 },
  feedNowBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    elevation: 4,
  },
  feedNowBtnOff: { backgroundColor: Colors.border, elevation: 0 },
  feedNowBtnText: { fontSize: 16, fontWeight: "700", color: Colors.white },
  feedProgressBg: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: "hidden",
  },
  feedProgressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchTitle: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
  switchSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  overrideWarn: {
    backgroundColor: Colors.warningBg,
    borderRadius: 10,
    padding: 10,
  },
  overrideWarnText: { fontSize: 13, color: "#92400E", fontWeight: "500" },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  divider: { height: 1, backgroundColor: Colors.borderLight },

  schedulesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  refreshBtnText: { fontSize: 16 },

  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },

  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scheduleTime: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary },
  scheduleSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  scheduleNote: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: { fontSize: 14 },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { fontSize: 14 },

  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    elevation: 4,
  },
  addBtnIcon: { fontSize: 22, color: Colors.white, fontWeight: "700" },
  addBtnText: { fontSize: 15, fontWeight: "700", color: Colors.white },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: Colors.primary,
  },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  cancelText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.white },
  saveBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 64,
    alignItems: "center",
  },
  saveText: { fontSize: 15, color: Colors.white, fontWeight: "700" },

  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: -6,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  timeRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  timeGroup: { alignItems: "center", gap: 8 },
  timeLabel: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  timeInputWrap: { alignItems: "center", gap: 6 },
  timeArrow: {
    width: 44,
    height: 32,
    backgroundColor: Colors.bgPage,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeArrowText: { fontSize: 12, color: Colors.primary, fontWeight: "700" },
  timeInput: {
    width: 64,
    height: 56,
    backgroundColor: Colors.bgPage,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  timePreview: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    padding: 12,
  },
  timePreviewLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  timePreviewValue: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 4,
  },

  amountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amountChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.bgPage,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  amountChipActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  amountChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  amountChipTextActive: { color: Colors.primary },
  customAmtRow: { marginTop: 10 },
  customAmtInput: {
    backgroundColor: Colors.bgPage,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },

  daysGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgPage,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dayChipActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  dayChipEveryday: { borderStyle: "dashed" },
  dayChipText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  dayChipTextActive: { color: Colors.primary },
  daysSelected: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
    fontStyle: "italic",
  },

  noteInput: {
    minHeight: 80,
    backgroundColor: Colors.bgPage,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: "top",
  },
});
