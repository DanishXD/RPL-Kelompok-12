"""
EcoSmart Feeder — Generate Synthetic Dataset
=============================================
Membuat dataset dummy untuk training model rekomendasi waktu & jumlah pakan ikan lele.

Logika domain (berdasarkan budidaya lele):
- Ikan lele aktif makan saat suhu 26–30°C
- pH optimal 6.5–8.0
- Cahaya redup (malam/sore) → ikan lebih aktif makan
- Waktu ideal: pagi (06–08), siang (12–13), sore (17–18)
- Jumlah pakan: 3–5% dari estimasi berat biomassa
  → disederhanakan: kondisi optimal = lebih banyak pakan
"""

import pandas as pd
import numpy as np
import os

np.random.seed(42)
N = 2000  # jumlah sampel

# ── Generate fitur input ──────────────────────────────────────────────────────

temperature = np.random.normal(loc=28, scale=3, size=N).clip(20, 36)
ph_level    = np.random.normal(loc=7.2, scale=0.8, size=N).clip(5.0, 9.5)
feed_level  = np.random.uniform(10, 100, size=N)
light_level = np.random.randint(50, 800, size=N)
hour        = np.random.randint(0, 24, size=N)

# ── Label: recommended_time_slot ─────────────────────────────────────────────
# 0 = Pagi  (06:00–08:00)
# 1 = Siang (12:00–13:00)
# 2 = Sore  (17:00–18:00)
# 3 = Tidak direkomendasikan

def label_time_slot(row):
    temp, ph, light, h = row['temperature'], row['ph_level'], row['light_level'], row['hour']

    temp_ok  = 26 <= temp <= 30
    ph_ok    = 6.5 <= ph <= 8.0
    light_ok = light < 400  # cahaya redup lebih baik

    # Kondisi optimal → waktu ideal
    if temp_ok and ph_ok:
        if 6 <= h <= 8:
            return 0   # Pagi
        elif 12 <= h <= 13:
            return 1   # Siang
        elif 17 <= h <= 18:
            return 2   # Sore

    # Kondisi cukup baik → masih bisa makan tapi tidak optimal
    if temp_ok and 5.5 <= ph <= 9.0:
        if 6 <= h <= 9 or 11 <= h <= 14 or 16 <= h <= 19:
            return np.random.choice([0, 1, 2], p=[0.4, 0.3, 0.3])

    return 3  # Tidak direkomendasikan

# ── Label: recommended_amount_gram ───────────────────────────────────────────
# 0 = 50g   (kondisi buruk / pakan hampir habis)
# 1 = 100g  (kondisi normal)
# 2 = 150g  (kondisi baik)
# 3 = 200g  (kondisi sangat optimal)

def label_amount(row):
    temp, ph, feed, light = row['temperature'], row['ph_level'], row['feed_level'], row['light_level']

    temp_score  = 1 if 26 <= temp <= 30 else (0.5 if 24 <= temp <= 32 else 0)
    ph_score    = 1 if 6.5 <= ph <= 8.0 else (0.5 if 6.0 <= ph <= 8.5 else 0)
    feed_score  = 1 if feed > 40 else (0.5 if feed > 20 else 0)
    light_score = 1 if light < 300 else (0.5 if light < 500 else 0)

    total = temp_score + ph_score + feed_score + light_score  # max = 4

    if total >= 3.5:
        return 3   # 200g
    elif total >= 2.5:
        return 2   # 150g
    elif total >= 1.5:
        return 1   # 100g
    else:
        return 0   # 50g

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

# Tambah noise kecil supaya tidak terlalu perfect (lebih realistis)
noise_idx = np.random.choice(df.index, size=int(N * 0.05), replace=False)
df.loc[noise_idx, 'recommended_time_slot']   = np.random.randint(0, 4, size=len(noise_idx))
df.loc[noise_idx, 'recommended_amount_gram'] = np.random.randint(0, 4, size=len(noise_idx))

# ── Simpan dataset ────────────────────────────────────────────────────────────

os.makedirs('data', exist_ok=True)
df.to_csv('data/feeding_dataset.csv', index=False)

print(f"✅ Dataset berhasil dibuat: {len(df)} baris")
print(f"\nDistribusi recommended_time_slot:")
slot_map = {0: 'Pagi', 1: 'Siang', 2: 'Sore', 3: 'Tidak Direkomendasikan'}
print(df['recommended_time_slot'].map(slot_map).value_counts())
print(f"\nDistribusi recommended_amount_gram:")
gram_map = {0: '50g', 1: '100g', 2: '150g', 3: '200g'}
print(df['recommended_amount_gram'].map(gram_map).value_counts())
print(f"\nSample data:")
print(df.head(10).to_string())
