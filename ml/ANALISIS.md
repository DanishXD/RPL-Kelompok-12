# Analisis Data — EcoSmart Feeder
**Rekomendasi Waktu & Jumlah Pakan Ikan Lele Berbasis Machine Learning**

---

## 1. Dataset

### Deskripsi
Dataset dibuat secara sintetis menggunakan logika domain budidaya ikan lele. Data mensimulasikan kondisi kolam yang direkam oleh sensor IoT (ESP32) secara real-time.

| Atribut | Nilai |
|---|---|
| Jumlah sampel | 2.000 baris |
| Jumlah fitur input | 5 fitur |
| Jumlah target output | 2 target (klasifikasi multi-kelas) |
| Noise | 5% (untuk realisme) |

### Fitur Input (X)

| Fitur | Satuan | Deskripsi | Rentang |
|---|---|---|---|
| `temperature` | °C | Suhu air kolam | 20–36°C |
| `ph_level` | — | Tingkat keasaman air | 5.0–9.5 |
| `feed_level` | % | Persentase sisa pakan di wadah | 5–100% |
| `light_level` | lux | Intensitas cahaya lingkungan | 20–800 lx |
| `hour` | 0–23 | Jam saat pengambilan data | 0–23 |

### Target Output (Y)

**Target 1 — Waktu Pakan (`recommended_time_slot`)**
| Kelas | Label | Keterangan |
|---|---|---|
| 0 | Pagi (06–08) | Waktu pagi optimal untuk pemberian pakan |
| 1 | Siang (12–13) | Waktu siang untuk pemberian pakan |
| 2 | Sore (17–18) | Waktu sore optimal untuk pemberian pakan |
| 3 | Tidak Direkomendasikan | Kondisi sensor tidak mendukung pemberian pakan |

**Target 2 — Jumlah Pakan (`recommended_amount_gram`)**
| Kelas | Label | Keterangan |
|---|---|---|
| 0 | 50g | Kondisi buruk, berikan pakan minimal |
| 1 | 100g | Kondisi normal, pakan standar |
| 2 | 150g | Kondisi baik, pakan lebih banyak |
| 3 | 200g | Kondisi sangat optimal, pakan maksimal |

### Distribusi Kelas
Distribusi kelas tidak seimbang (imbalanced) — mayoritas data masuk kelas "Tidak Direkomendasikan" untuk waktu pakan, dan kelas "150g" untuk jumlah pakan. Hal ini mencerminkan kondisi nyata di lapangan, di mana kondisi optimal tidak selalu terjadi setiap saat.

---

## 2. Insight dari Data

### Insight 1 — Waktu adalah faktor paling penentu kapan harus memberi pakan
Dari analisis feature importance model Gradient Boosting untuk target waktu pakan:

| Fitur | Importance |
|---|---|
| `hour` | **47.79%** |
| `temperature` | 32.23% |
| `ph_level` | 9.04% |
| `feed_level` | 5.75% |
| `light_level` | 5.20% |

**Interpretasi:** Faktor jam (`hour`) mendominasi keputusan kapan waktu terbaik memberi pakan dengan kontribusi hampir 48%. Ini sesuai dengan pengetahuan domain — ikan lele memiliki pola makan yang terikat pada siklus sirkadian (pagi, siang, sore). Suhu air juga berperan signifikan (32%) karena nafsu makan ikan sangat dipengaruhi oleh suhu lingkungan.

### Insight 2 — Kondisi fisik kolam lebih menentukan berapa banyak pakan yang diberikan
Dari analisis feature importance model Gradient Boosting untuk target jumlah pakan:

| Fitur | Importance |
|---|---|
| `temperature` | **27.68%** |
| `light_level` | 27.17% |
| `ph_level` | 23.29% |
| `feed_level` | 19.73% |
| `hour` | 2.13% |

**Interpretasi:** Berbeda dengan waktu pakan, penentuan jumlah pakan lebih merata bergantung pada kondisi kualitas air — suhu (27.68%), cahaya (27.17%), dan pH (23.29%) berkontribusi hampir sama. Jam tidak terlalu berpengaruh (hanya 2.13%), artinya jumlah pakan yang tepat lebih ditentukan oleh "seberapa sehat kondisi kolam" bukan "pukul berapa sekarang".

### Insight 3 — Kondisi optimal jarang terjadi
Dari distribusi kelas target waktu pakan, sekitar **73.8% data** masuk kategori "Tidak Direkomendasikan". Ini menunjukkan bahwa sebagian besar kondisi tidak memenuhi semua kriteria optimal secara bersamaan (suhu, pH, jam), sehingga sistem perlu cerdas dalam mendeteksi "jendela waktu" yang tepat.

### Insight 4 — Pakan 150g adalah jumlah yang paling sering direkomendasikan
Distribusi kelas jumlah pakan menunjukkan 150g (46.6%) paling sering direkomendasikan, diikuti 100g (26.3%), 200g (22.6%), dan 50g (4.6%). Artinya, dalam kondisi normal (suhu dan pH wajar), sistem cenderung merekomendasikan porsi pakan "lebih banyak dari standar" yang mencerminkan kondisi kolam yang umumnya cukup baik.

---

## 3. Model Prediksi

### Algoritma yang Dibandingkan

| Model | Deskripsi Singkat |
|---|---|
| **Decision Tree** | Pohon keputusan dengan aturan if-else bercabang. Mudah diinterpretasi, cocok untuk baseline. |
| **Random Forest** | Ensemble dari banyak Decision Tree (100 pohon). Lebih stabil dan akurat dari Decision Tree tunggal. |
| **Gradient Boosting** | Membangun model secara iteratif, setiap pohon baru memperbaiki kesalahan sebelumnya. Akurasi tertinggi. |

### Konfigurasi Model

| Parameter | Decision Tree | Random Forest | Gradient Boosting |
|---|---|---|---|
| `max_depth` | 6 | 8 | 4 |
| `n_estimators` | — | 100 | 100 |
| `learning_rate` | — | — | 0.1 |
| `min_samples_split` | 10 | 10 | — |
| `random_state` | 42 | 42 | 42 |

---

## 4. Metrik Evaluasi Model

### Target: Waktu Pakan (time_slot)

| Model | Test Accuracy | CV Accuracy | CV Std Dev |
|---|---|---|---|
| Decision Tree | 79.25% | 80.85% | ±1.38% |
| Random Forest | 80.25% | 82.65% | ±1.19% |
| **Gradient Boosting** | **85.50%** | **86.35%** | ±1.15% |

### Target: Jumlah Pakan (amount_gram)

| Model | Test Accuracy | CV Accuracy | CV Std Dev |
|---|---|---|---|
| Decision Tree | 71.00% | 71.50% | ±1.22% |
| Random Forest | 79.75% | 81.65% | ±1.80% |
| **Gradient Boosting** | **86.25%** | **86.60%** | ±1.59% |

**Metode evaluasi:** 5-Fold Cross Validation — dataset dibagi 5 bagian, model dilatih 5 kali dengan bagian yang berbeda sebagai data uji. Hasil CV lebih andal daripada test accuracy tunggal karena mengurangi bias pemilihan data.

---

## 5. Interpretasi Hasil Analisis

### Mengapa Gradient Boosting Menjadi Model Terbaik?

1. **Akurasi tertinggi di kedua target** — 86.35% (waktu) dan 86.60% (jumlah), mengungguli Decision Tree dan Random Forest.

2. **Variance rendah** — CV std dev hanya ±1.15% dan ±1.59%, menandakan model konsisten dan tidak overfitting pada data tertentu.

3. **Mekanisme iteratif** — Gradient Boosting membangun model secara bertahap. Setiap pohon baru difokuskan untuk memperbaiki kesalahan prediksi pohon sebelumnya, sehingga mampu menangkap pola yang lebih kompleks.

4. **Cocok untuk data dengan hubungan non-linear** — Hubungan antara jam, suhu, dan waktu makan bersifat non-linear (misalnya, suhu 28°C di pagi hari berbeda dampaknya dengan suhu 28°C di malam hari). Gradient Boosting lebih baik menangani pola seperti ini dibanding Decision Tree tunggal.

### Keterbatasan

1. **Dataset sintetis** — Data dibuat berdasarkan pengetahuan domain, bukan data lapangan nyata. Akurasi di dunia nyata mungkin berbeda dan perlu validasi dengan data aktual dari sensor.

2. **Kelas tidak seimbang** — Kelas "Tidak Direkomendasikan" mendominasi dataset. Model cenderung lebih akurat untuk kelas mayoritas dan kurang akurat untuk kelas minoritas (Pagi, Siang, Sore).

3. **Fitur terbatas** — Tidak ada data berat ikan, umur ikan, atau kepadatan kolam yang sebenarnya berpengaruh terhadap kebutuhan pakan.

### Rekomendasi Pengembangan

- Kumpulkan data real dari sensor ESP32 selama minimal 2–4 minggu untuk menggantikan dataset sintetis
- Terapkan teknik SMOTE atau oversampling untuk mengatasi ketidakseimbangan kelas
- Tambahkan fitur berat biomassa ikan untuk prediksi jumlah pakan yang lebih presisi
- Pertimbangkan model time-series (LSTM) jika data historis per jam sudah tersedia dalam jumlah besar

---

## 6. Visualisasi yang Tersedia

| File | Deskripsi |
|---|---|
| `time_slot_confusion_matrix_comparison.png` | Confusion matrix 3 model berdampingan — waktu pakan |
| `time_slot_accuracy_comparison.png` | Bar chart perbandingan akurasi 3 model — waktu pakan |
| `time_slot_feature_importance.png` | Kontribusi tiap fitur — waktu pakan |
| `time_slot_decision_tree_plot.png` | Visualisasi pohon keputusan — waktu pakan |
| `amount_gram_confusion_matrix_comparison.png` | Confusion matrix 3 model berdampingan — jumlah pakan |
| `amount_gram_accuracy_comparison.png` | Bar chart perbandingan akurasi 3 model — jumlah pakan |
| `amount_gram_feature_importance.png` | Kontribusi tiap fitur — jumlah pakan |
| `amount_gram_decision_tree_plot.png` | Visualisasi pohon keputusan — jumlah pakan |

---

*Analisis ini dibuat untuk keperluan tugas mata kuliah Rekayasa Perangkat Lunak.*
*EcoSmart Feeder — Kelompok 12, IPB University, 2026.*
