"""
EcoSmart Feeder — Generate Synthetic Dataset
=============================================
Membuat dataset sintetis untuk training model klasifikasi
rekomendasi waktu dan jumlah pakan ikan lele.

Logika domain budidaya lele:
  - Suhu optimal   : 26–30°C
  - pH optimal     : 6.5–8.0
  - Cahaya redup   : ikan lebih aktif makan
  - Waktu ideal    : pagi (06–08), siang (12–13), sore (17–18)

Jalankan:
  python generate_dataset.py
"""

import os
import pandas as pd
import numpy as np

# ── Seed untuk hasil yang konsisten ──────────────────────────────────────────
SEED = 42
np.random.seed(SEED)

# ── Konfigurasi dataset ───────────────────────────────────────────────────────
N_SAMPLES  = 2000
NOISE_RATE = 0.05   # 5% sampel diberi label acak untuk realisme


# ── Generate fitur input ──────────────────────────────────────────────────────

temperature = np.random.normal(loc=28,  scale=3,   size=N_SAMPLES).clip(20, 36)
ph_level    = np.random.normal(loc=7.2, scale=0.8, size=N_SAMPLES).clip(5.0, 9.5)
feed_level  = np.random.uniform(10, 100,            size=N_SAMPLES)
light_level = np.random.randint(50, 800,            size=N_SAMPLES)
hour        = np.random.randint(0, 24,              size=N_SAMPLES)


# ── Fungsi pelabelan waktu pakan ──────────────────────────────────────────────
# Kelas:
#   0 = Pagi  (06–08)
#   1 = Siang (12–13)
#   2 = Sore  (17–18)
#   3 = Tidak Direkomendasikan

def label_time_slot(row):
    temp = row['temperature']
    ph   = row['ph_level']
    h    = row['hour']

    temp_ok = 26 <= temp <= 30
    ph_ok   = 6.5 <= ph <= 8.0

    # Kondisi optimal → waktu ideal
    if temp_ok and ph_ok:
        if 6 <= h <= 8:
            return 0   # Pagi
        if 12 <= h <= 13:
            return 1   # Siang
        if 17 <= h <= 18:
            return 2   # Sore

    # Kondisi cukup baik → masih bisa makan, dipilih acak
    if temp_ok and (5.5 <= ph <= 9.0):
        if (6 <= h <= 9) or (11 <= h <= 14) or (16 <= h <= 19):
            return np.random.choice([0, 1, 2], p=[0.4, 0.3, 0.3])

    return 3   # Tidak Direkomendasikan


# ── Fungsi pelabelan jumlah pakan ─────────────────────────────────────────────
# Kelas:
#   0 = 50g  (kondisi buruk)
#   1 = 100g (kondisi normal)
#   2 = 150g (kondisi baik)
#   3 = 200g (kondisi sangat optimal)

def label_amount(row):
    temp  = row['temperature']
    ph    = row['ph_level']
    feed  = row['feed_level']
    light = row['light_level']

    temp_score  = 1.0 if 26 <= temp <= 30 else (0.5 if 24 <= temp <= 32 else 0.0)
    ph_score    = 1.0 if 6.5 <= ph <= 8.0 else (0.5 if 6.0 <= ph <= 8.5 else 0.0)
    feed_score  = 1.0 if feed  > 40 else (0.5 if feed  > 20 else 0.0)
    light_score = 1.0 if light < 300 else (0.5 if light < 500 else 0.0)

    total = temp_score + ph_score + feed_score + light_score  # maks = 4.0

    if total >= 3.5:
        return 3   # 200g
    if total >= 2.5:
        return 2   # 150g
    if total >= 1.5:
        return 1   # 100g
    return 0       # 50g


# ── Buat DataFrame ────────────────────────────────────────────────────────────

df = pd.DataFrame({
    'temperature': temperature.round(2),
    'ph_level':    ph_level.round(2),
    'feed_level':  feed_level.round(1),
    'light_level': light_level,
    'hour':        hour,
})

df['recommended_time_slot']   = df.apply(label_time_slot, axis=1)
df['recommended_amount_gram'] = df.apply(label_amount,    axis=1)

# Tambahkan noise untuk realisme
noise_idx = np.random.choice(df.index, size=int(N_SAMPLES * NOISE_RATE), replace=False)
df.loc[noise_idx, 'recommended_time_slot']   = np.random.randint(0, 4, size=len(noise_idx))
df.loc[noise_idx, 'recommended_amount_gram'] = np.random.randint(0, 4, size=len(noise_idx))


# ── Simpan dataset ────────────────────────────────────────────────────────────

os.makedirs('data', exist_ok=True)
df.to_csv('data/feeding_dataset.csv', index=False)

# ── Laporan hasil ─────────────────────────────────────────────────────────────

SLOT_MAP = {0: 'Pagi', 1: 'Siang', 2: 'Sore', 3: 'Tidak Direkomendasikan'}
GRAM_MAP = {0: '50g',  1: '100g',  2: '150g', 3: '200g'}

print(f"✅  Dataset berhasil dibuat  : {len(df)} baris")
print(f"    Seed                    : {SEED}")
print(f"    Noise                   : {NOISE_RATE*100:.0f}%")
print(f"\nDistribusi waktu pakan (recommended_time_slot):")
print(df['recommended_time_slot'].map(SLOT_MAP).value_counts().to_string())
print(f"\nDistribusi jumlah pakan (recommended_amount_gram):")
print(df['recommended_amount_gram'].map(GRAM_MAP).value_counts().to_string())
print(f"\n10 baris pertama:")
print(df.head(10).to_string())
