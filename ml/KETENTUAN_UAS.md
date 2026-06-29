# 📋 Ketentuan Pengerjaan UAS — EcoSmart Feeder (ML)

> **Catatan:** Dokumen ini hanya untuk keperluan pribadi. Tidak perlu di-push ke GitHub.

---

## 1. 📓 Notebook Pengerjaan (`.ipynb`)

### Format File
- Nama file: `[NIM]_[NamaTopik]_UAS.ipynb`
  - Contoh: `12345678_EcoSmartFeeder_ML_UAS.ipynb`
- Simpan di: `ml/`

### Struktur Notebook (Urutan Wajib)

Notebook harus mengikuti urutan section berikut:

```
[0] Setup & Import Library
[1] Load & Eksplorasi Dataset (EDA)
[2] Preprocessing Data
[3] Pemilihan Fitur (Feature Selection/Engineering)
[4] Pembuatan / Pelatihan Model
[5] Evaluasi Model
[6] Visualisasi Hasil
[7] Kesimpulan & Insight
```

### Ketentuan Penulisan Notebook

| Hal | Ketentuan |
|-----|-----------|
| **Bahasa** | Indonesia atau campuran Indonesia-Inggris |
| **Komentar** | Setiap cell harus ada markdown penjelasan sebelumnya |
| **Output** | Semua cell wajib sudah di-run (ada output-nya) |
| **Visualisasi** | Minimal 4 grafik (distribusi, confusion matrix, feature importance, perbandingan model) |
| **Random State** | Gunakan `random_state=42` agar hasil reproducible |
| **Dataset** | Gunakan file dari folder `ml/data/` |

### Library yang Digunakan (sudah ada di `requirements.txt`)

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, classification_report
import joblib
import warnings
warnings.filterwarnings('ignore')
```

---

## 2. 📄 Laporan (`.pdf`)

### Format File
- Nama file: `[NIM]_[NamaTopik]_Laporan_UAS.pdf`
  - Contoh: `12345678_EcoSmartFeeder_ML_Laporan_UAS.pdf`
- Simpan di: `ml/reports/`
- Dibuat dari PowerPoint / Google Slides, lalu export ke PDF

### Struktur Slide (Urutan Wajib)

#### Halaman 1 — Cover
- Judul Proyek
- Nama & NIM
- Mata Kuliah / Kelas
- Semester & Tahun

---

#### Halaman 2–3 — Latar Belakang & Tujuan
**Latar Belakang:**
- Masalah yang diangkat (contoh: pemberian pakan ikan yang tidak efisien)
- Mengapa machine learning relevan untuk masalah ini
- Konteks sistem EcoSmart Feeder

**Tujuan:**
- Tujuan umum pengerjaan
- Target model yang ingin dicapai (akurasi, dll.)

---

#### Halaman 4–5 — Data
- Sumber dataset (sintetis / real sensor)
- Jumlah sampel & fitur
- Tabel deskripsi fitur input (X) dan target output (Y)
- Distribusi kelas (tampilkan dalam grafik/pie chart)
- Insight awal dari data (EDA)

---

#### Halaman 6–7 — Alur Pengerjaan
- Diagram alur / flowchart (bisa pakai gambar sederhana)
- Penjelasan tiap tahap:
  1. Load Data
  2. Eksplorasi (EDA)
  3. Preprocessing
  4. Split Train/Test
  5. Training Model
  6. Evaluasi
  7. Pemilihan Model Terbaik

---

#### Halaman 8–10 — Hasil
- Tabel perbandingan akurasi & F1 Score semua model
- Confusion Matrix model terbaik
- Feature Importance chart
- Screenshot / output penting dari notebook

---

#### Halaman 11 — Kesimpulan
- Model terbaik yang dipilih beserta alasannya
- Apa yang berhasil dan apa keterbatasan
- Saran pengembangan ke depan

---

#### Halaman 12 — Referensi (opsional)
- Referensi library, jurnal, atau sumber dataset jika ada

---

## 3. 📁 Struktur Folder Akhir

```
ml/
├── data/
│   └── dataset_ecosmart.csv          ← dataset utama
├── models/
│   └── best_model_time_slot.pkl      ← model tersimpan
│   └── best_model_amount_gram.pkl
├── reports/
│   └── [NIM]_[Topik]_Laporan_UAS.pdf ← laporan final
├── [NIM]_[Topik]_UAS.ipynb           ← notebook pengerjaan
├── ANALISIS.md                        ← referensi analisis
├── KETENTUAN_UAS.md                   ← file ini
├── train_model.py                     ← script training
├── generate_dataset.py                ← script generate data
├── api.py
└── requirements.txt
```

---

## 4. ✅ Checklist Sebelum Submit

### Notebook
- [ ] Semua cell sudah di-run (tidak ada error)
- [ ] Ada markdown penjelasan di setiap section
- [ ] Minimal 3 model dibandingkan
- [ ] Ada confusion matrix & classification report
- [ ] Ada feature importance
- [ ] Kesimpulan ditulis di cell terakhir

### Laporan PDF
- [ ] Ada halaman cover
- [ ] Ada latar belakang & tujuan
- [ ] Ada penjelasan data (tabel fitur + distribusi)
- [ ] Ada flowchart/alur pengerjaan
- [ ] Ada tabel hasil perbandingan model
- [ ] Ada kesimpulan
- [ ] Di-export ke `.pdf`

---

*Dibuat: Juni 2026 | EcoSmart Feeder — Proyek UAS Machine Learning*
