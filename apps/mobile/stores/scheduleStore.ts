import { create } from 'zustand';

export interface Schedule {
  id:       string;
  time:     string;
  amount:   string;
  days:     string[];
  isActive: boolean;
  note?:    string;
}

interface ScheduleState {
  schedules:   Schedule[];
  setSchedules: (s: Schedule[]) => void;
  addSchedule:  (s: Schedule) => void;
  updateSchedule: (s: Schedule) => void;
  removeSchedule: (id: string) => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  setSchedules:   (schedules)  => set({ schedules }),
  addSchedule:    (s)          => set((state) => ({
    schedules: [...state.schedules, s].sort((a, b) => a.time.localeCompare(b.time)),
  })),
  updateSchedule: (updated)    => set((state) => ({
    schedules: state.schedules.map(s => s.id === updated.id ? updated : s),
  })),
  removeSchedule: (id)         => set((state) => ({
    schedules: state.schedules.filter(s => s.id !== id),
  })),
}));

// ── Helper: cari jadwal berikutnya yang aktif ─────────────────────────────────
export function getNextSchedule(schedules: Schedule[]): Schedule | null {
  const now      = new Date();
  const nowMins  = now.getHours() * 60 + now.getMinutes();
  const today    = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][now.getDay()];

  const active = schedules.filter(s => {
    if (!s.isActive) return false;
    if (s.days.includes('everyday')) return true;
    return s.days.includes(today);
  });

  if (active.length === 0) return null;

  // Cari jadwal hari ini yang belum lewat
  const upcoming = active.filter(s => {
    const [h, m] = s.time.split(':').map(Number);
    return h * 60 + m > nowMins;
  }).sort((a, b) => a.time.localeCompare(b.time));

  // Kalau ada yang belum lewat hari ini, ambil yang paling dekat
  if (upcoming.length > 0) return upcoming[0];

  // Kalau semua sudah lewat hari ini, ambil yang pertama besok
  return active.sort((a, b) => a.time.localeCompare(b.time))[0];
}
