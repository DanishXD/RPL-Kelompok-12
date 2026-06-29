"""
EcoSmart Feeder — Dashboard Analitik ML
=========================================
Frontend Streamlit untuk project Machine Learning rekomendasi
waktu dan jumlah pakan ikan lele.

Jalankan:
  streamlit run dashboard.py

Pastikan:
  - data/feeding_dataset.csv  sudah ada
  - models/*.pkl & *.json     sudah ada  (jalankan train_model.py)
  - reports/*.png             sudah ada  (dihasilkan train_model.py)
  - api.py                    sedang jalan (python api.py) — untuk Tab Prediksi
"""

import json
import os

import numpy  as np
import pandas as pd
import requests
import streamlit as st

# ── Konfigurasi halaman ───────────────────────────────────────────────────────

st.set_page_config(
    page_title = "EcoSmart Feeder — ML Dashboard",
    page_icon  = "🐟",
    layout     = "wide",
)

# ── Path ──────────────────────────────────────────────────────────────────────

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DATA_PATH    = os.path.join(BASE_DIR, "data",    "feeding_dataset.csv")
MODELS_DIR   = os.path.join(BASE_DIR, "models")
REPORTS_DIR  = os.path.join(BASE_DIR, "reports")
ML_API_URL   = os.environ.get("ML_API_URL", "http://localhost:5001")

# ── Label maps ────────────────────────────────────────────────────────────────

SLOT_MAP  = {0: "Pagi (06–08)",  1: "Siang (12–13)", 2: "Sore (17–18)", 3: "Tidak Direkomendasikan"}
GRAM_MAP  = {0: "50g",           1: "100g",           2: "150g",         3: "200g"}
FEAT_LABEL = {
    "temperature": "Suhu (°C)",
    "ph_level":    "pH Air",
    "feed_level":  "Level Pakan (%)",
    "light_level": "Cahaya (lux)",
    "hour":        "Jam",
}

MODEL_COLOR = {
    "Decision Tree":    "#2196F3",
    "Random Forest":    "#FF9800",
    "Gradient Boosting":"#4CAF50",
}

# ── Helper: load metadata ─────────────────────────────────────────────────────

@st.cache_data
def load_metadata(target: str) -> dict:
    path = os.path.join(MODELS_DIR, f"{target}_metadata.json")
    if not os.path.exists(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)

@st.cache_data
def load_dataset() -> pd.DataFrame:
    if not os.path.exists(DATA_PATH):
        return pd.DataFrame()
    return pd.read_csv(DATA_PATH)

def report_img(name: str):
    path = os.path.join(REPORTS_DIR, name)
    return path if os.path.exists(path) else None

# ── Header ────────────────────────────────────────────────────────────────────

st.title("🐟 EcoSmart Feeder — Dashboard Analitik ML")
st.markdown(
    "**Rekomendasi Waktu & Jumlah Pakan Ikan Lele** berbasis Machine Learning  "
    "· Dataset sintetis · Seed 42 · Model terbaik: **Gradient Boosting**"
)
st.divider()

# ── Tabs ──────────────────────────────────────────────────────────────────────

tab1, tab2, tab3, tab4 = st.tabs([
    "📊 Dataset",
    "🤖 Perbandingan Model",
    "🌳 Interpretasi Model",
    "🎯 Prediksi Live",
])

# ═════════════════════════════════════════════════════════════════════════════
# TAB 1 — DATASET
# ═════════════════════════════════════════════════════════════════════════════

with tab1:
    st.header("Dataset")

    df = load_dataset()

    if df.empty:
        st.error("Dataset tidak ditemukan. Jalankan `python generate_dataset.py` terlebih dahulu.")
        st.stop()

    # ── Info umum ─────────────────────────────────────────────────────────────
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Jumlah Baris",   f"{len(df):,}")
    col2.metric("Jumlah Fitur",   "5")
    col3.metric("Target Output",  "2")
    col4.metric("Noise",          "5%")

    st.subheader("Preview Dataset")
    st.dataframe(df.head(20), use_container_width=True)

    # ── Statistik deskriptif ──────────────────────────────────────────────────
    st.subheader("Statistik Deskriptif Fitur Input")
    features = ["temperature", "ph_level", "feed_level", "light_level", "hour"]
    desc = df[features].describe().round(2)
    desc.index = ["Jumlah", "Rata-rata", "Std Dev", "Min", "Q1 (25%)", "Median (50%)", "Q3 (75%)", "Max"]
    st.dataframe(desc.rename(columns=FEAT_LABEL), use_container_width=True)

    # ── Distribusi kelas ──────────────────────────────────────────────────────
    st.subheader("Distribusi Kelas Target")

    col_a, col_b = st.columns(2)

    with col_a:
        st.markdown("**Waktu Pakan (recommended_time_slot)**")
        ts_counts = df["recommended_time_slot"].map(SLOT_MAP).value_counts()
        ts_df = pd.DataFrame({
            "Kelas": ts_counts.index,
            "Jumlah": ts_counts.values,
            "Persentase (%)": (ts_counts.values / len(df) * 100).round(1),
        })
        st.dataframe(ts_df, use_container_width=True, hide_index=True)
        st.bar_chart(ts_counts)

    with col_b:
        st.markdown("**Jumlah Pakan (recommended_amount_gram)**")
        ag_counts = df["recommended_amount_gram"].map(GRAM_MAP).value_counts()
        ag_df = pd.DataFrame({
            "Kelas": ag_counts.index,
            "Jumlah": ag_counts.values,
            "Persentase (%)": (ag_counts.values / len(df) * 100).round(1),
        })
        st.dataframe(ag_df, use_container_width=True, hide_index=True)
        st.bar_chart(ag_counts)

    # ── Korelasi fitur ────────────────────────────────────────────────────────
    st.subheader("Korelasi Antar Fitur")
    corr = df[features].corr().round(3)
    st.dataframe(corr.rename(columns=FEAT_LABEL, index=FEAT_LABEL), use_container_width=True)


# ═════════════════════════════════════════════════════════════════════════════
# TAB 2 — PERBANDINGAN MODEL
# ═════════════════════════════════════════════════════════════════════════════

with tab2:
    st.header("Perbandingan Model")
    st.markdown(
        "Tiga model dilatih dan dibandingkan: **Decision Tree**, **Random Forest**, dan **Gradient Boosting**. "
        "Model terbaik dipilih berdasarkan CV Accuracy tertinggi."
    )

    meta_ts = load_metadata("time_slot")
    meta_ag = load_metadata("amount_gram")

    # ── Tabel metrik ──────────────────────────────────────────────────────────
    def build_metrics_df(meta: dict) -> pd.DataFrame:
        if not meta or "all_results" not in meta:
            return pd.DataFrame()
        rows = []
        for model_name, r in meta["all_results"].items():
            rows.append({
                "Model":           model_name,
                "Test Accuracy":   f"{r['accuracy']*100:.2f}%",
                "CV Accuracy":     f"{r['cv_mean']*100:.2f}%",
                "CV Std":          f"±{r['cv_std']*100:.2f}%",
                "Test F1 (w)":     f"{r['f1_weighted']*100:.2f}%",
                "CV F1 (w)":       f"{r['cv_f1_mean']*100:.2f}%",
                "Terbaik":         "✅" if model_name == meta.get("best_model") else "",
            })
        return pd.DataFrame(rows)

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Target: Waktu Pakan")
        df_ts = build_metrics_df(meta_ts)
        if not df_ts.empty:
            st.dataframe(df_ts, use_container_width=True, hide_index=True)
        else:
            st.warning("Metadata tidak ditemukan. Jalankan `train_model.py`.")

    with col2:
        st.subheader("Target: Jumlah Pakan")
        df_ag = build_metrics_df(meta_ag)
        if not df_ag.empty:
            st.dataframe(df_ag, use_container_width=True, hide_index=True)
        else:
            st.warning("Metadata tidak ditemukan. Jalankan `train_model.py`.")

    st.divider()

    # ── Grafik Akurasi ────────────────────────────────────────────────────────
    st.subheader("Grafik Perbandingan Akurasi")
    col_a, col_b = st.columns(2)

    img = report_img("time_slot_accuracy_comparison.png")
    with col_a:
        st.markdown("**Waktu Pakan**")
        if img:
            st.image(img, use_container_width=True)
        else:
            st.info("Gambar belum tersedia.")

    img = report_img("amount_gram_accuracy_comparison.png")
    with col_b:
        st.markdown("**Jumlah Pakan**")
        if img:
            st.image(img, use_container_width=True)
        else:
            st.info("Gambar belum tersedia.")

    # ── Grafik F1 ─────────────────────────────────────────────────────────────
    st.subheader("Grafik Perbandingan F1 Score")
    col_a, col_b = st.columns(2)

    img = report_img("time_slot_f1_comparison.png")
    with col_a:
        st.markdown("**Waktu Pakan**")
        if img:
            st.image(img, use_container_width=True)
        else:
            st.info("Gambar belum tersedia.")

    img = report_img("amount_gram_f1_comparison.png")
    with col_b:
        st.markdown("**Jumlah Pakan**")
        if img:
            st.image(img, use_container_width=True)
        else:
            st.info("Gambar belum tersedia.")

    # ── Confusion Matrix ──────────────────────────────────────────────────────
    st.subheader("Confusion Matrix (Perbandingan 3 Model)")

    img = report_img("time_slot_confusion_matrix_comparison.png")
    st.markdown("**Waktu Pakan**")
    if img:
        st.image(img, use_container_width=True)
    else:
        st.info("Gambar belum tersedia.")

    img = report_img("amount_gram_confusion_matrix_comparison.png")
    st.markdown("**Jumlah Pakan**")
    if img:
        st.image(img, use_container_width=True)
    else:
        st.info("Gambar belum tersedia.")


# ═════════════════════════════════════════════════════════════════════════════
# TAB 3 — INTERPRETASI MODEL
# ═════════════════════════════════════════════════════════════════════════════

with tab3:
    st.header("Interpretasi Model")

    meta_ts = load_metadata("time_slot")
    meta_ag = load_metadata("amount_gram")

    # ── Feature importance tabel ──────────────────────────────────────────────
    st.subheader("Feature Importance — Gradient Boosting")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("**Waktu Pakan**")
        fi_ts = meta_ts.get("feature_importance", {})
        if fi_ts:
            fi_df = pd.DataFrame({
                "Fitur":       [FEAT_LABEL.get(k, k) for k in fi_ts],
                "Importance":  list(fi_ts.values()),
                "Persen (%)":  [round(v*100, 2) for v in fi_ts.values()],
            }).sort_values("Importance", ascending=False)
            st.dataframe(fi_df, use_container_width=True, hide_index=True)
            st.info("💡 **Jam** adalah fitur paling berpengaruh (47.79%) — ikan lele memiliki pola makan terikat siklus sirkadian.")
        else:
            st.warning("Metadata tidak ditemukan.")

    with col2:
        st.markdown("**Jumlah Pakan**")
        fi_ag = meta_ag.get("feature_importance", {})
        if fi_ag:
            fi_df = pd.DataFrame({
                "Fitur":       [FEAT_LABEL.get(k, k) for k in fi_ag],
                "Importance":  list(fi_ag.values()),
                "Persen (%)":  [round(v*100, 2) for v in fi_ag.values()],
            }).sort_values("Importance", ascending=False)
            st.dataframe(fi_df, use_container_width=True, hide_index=True)
            st.info("💡 **Suhu**, **Cahaya**, dan **pH** berkontribusi hampir merata — jumlah pakan ditentukan kualitas kolam, bukan jam.")
        else:
            st.warning("Metadata tidak ditemukan.")

    # ── Grafik feature importance ─────────────────────────────────────────────
    st.subheader("Grafik Feature Importance")
    col_a, col_b = st.columns(2)

    img = report_img("time_slot_feature_importance.png")
    with col_a:
        st.markdown("**Waktu Pakan**")
        if img:
            st.image(img, use_container_width=True)
        else:
            st.info("Gambar belum tersedia.")

    img = report_img("amount_gram_feature_importance.png")
    with col_b:
        st.markdown("**Jumlah Pakan**")
        if img:
            st.image(img, use_container_width=True)
        else:
            st.info("Gambar belum tersedia.")

    # ── Decision Tree Plot ────────────────────────────────────────────────────
    st.subheader("Visualisasi Decision Tree (kedalaman 3 dari 6)")

    img = report_img("time_slot_decision_tree_plot.png")
    st.markdown("**Waktu Pakan**")
    if img:
        st.image(img, use_container_width=True)
    else:
        st.info("Gambar belum tersedia.")

    img = report_img("amount_gram_decision_tree_plot.png")
    st.markdown("**Jumlah Pakan**")
    if img:
        st.image(img, use_container_width=True)
    else:
        st.info("Gambar belum tersedia.")

    # ── Insight ───────────────────────────────────────────────────────────────
    st.subheader("Insight dari Data")
    with st.expander("Lihat selengkapnya", expanded=True):
        st.markdown("""
| # | Insight |
|---|---------|
| 1 | **Jam adalah faktor utama** kapan harus memberi pakan (47.79%). Ikan lele mengikuti siklus sirkadian. |
| 2 | **Kondisi kolam lebih menentukan jumlah pakan** — suhu, cahaya, pH berkontribusi merata (~25% tiap fitur). |
| 3 | **73.8% data** masuk kelas "Tidak Direkomendasikan" — kondisi optimal jarang terpenuhi bersamaan. |
| 4 | **150g** adalah rekomendasi terbanyak (46.6%) — kondisi kolam umumnya cukup baik untuk porsi menengah-atas. |
| 5 | **Gradient Boosting** unggul karena menangani hubungan non-linear antar fitur lebih baik dari Decision Tree tunggal. |
        """)


# ═════════════════════════════════════════════════════════════════════════════
# TAB 4 — PREDIKSI LIVE
# ═════════════════════════════════════════════════════════════════════════════

with tab4:
    st.header("Prediksi Live")
    st.markdown(
        "Masukkan kondisi kolam saat ini untuk mendapatkan rekomendasi "
        "**waktu** dan **jumlah pakan** dari model Gradient Boosting."
    )

    # ── Cek status API ────────────────────────────────────────────────────────
    api_ok = False
    try:
        r = requests.get(f"{ML_API_URL}/health", timeout=3)
        api_ok = r.status_code == 200 and r.json().get("models_loaded", False)
    except Exception:
        pass

    if api_ok:
        st.success(f"ML API aktif — {ML_API_URL}")
    else:
        st.warning(
            f"ML API tidak terdeteksi di `{ML_API_URL}`.  "
            "Jalankan `python api.py` untuk mengaktifkan prediksi live."
        )

    st.divider()

    # ── Input form ────────────────────────────────────────────────────────────
    with st.form("prediction_form"):
        st.subheader("Input Kondisi Kolam")

        col1, col2 = st.columns(2)

        with col1:
            temperature = st.slider("Suhu Air (°C)",       min_value=20.0, max_value=36.0, value=28.0, step=0.1)
            ph_level    = st.slider("pH Air",              min_value=5.0,  max_value=9.5,  value=7.2,  step=0.1)
            feed_level  = st.slider("Level Pakan (%)",     min_value=0,    max_value=100,  value=65,   step=1)

        with col2:
            light_level = st.slider("Intensitas Cahaya (lux)", min_value=20,  max_value=800, value=350, step=10)
            hour        = st.slider("Jam Saat Ini",            min_value=0,   max_value=23,  value=7,   step=1,
                                    format="%02d:00")

        submitted = st.form_submit_button("🔍 Prediksi Sekarang", use_container_width=True, type="primary")

    # ── Hasil prediksi ────────────────────────────────────────────────────────
    if submitted:
        if not api_ok:
            st.error("ML API tidak aktif. Tidak bisa melakukan prediksi.")
        else:
            with st.spinner("Memproses prediksi..."):
                try:
                    resp = requests.post(
                        f"{ML_API_URL}/predict",
                        json={
                            "temperature": temperature,
                            "ph_level":    ph_level,
                            "feed_level":  feed_level,
                            "light_level": light_level,
                            "hour":        hour,
                        },
                        timeout=10,
                    )
                    result = resp.json()
                except Exception as e:
                    st.error(f"Gagal menghubungi ML API: {e}")
                    result = None

            if result and result.get("success"):
                pred = result["data"]["prediction"]
                ts   = pred["time_slot"]
                ag   = pred["amount_gram"]
                rec  = result["data"]["recommendation"]

                st.success("Prediksi berhasil!")

                col_r1, col_r2 = st.columns(2)

                with col_r1:
                    st.metric(
                        label      = "⏰ Waktu Pemberian Pakan",
                        value      = ts["label"],
                        delta      = ts.get("time_range") or "",
                        delta_color= "off",
                    )
                    st.caption(f"Keyakinan model: **{ts['confidence']}%**")
                    st.caption(ts["description"])

                with col_r2:
                    st.metric(
                        label      = "⚖️ Jumlah Pakan",
                        value      = f"{ag['gram']}g",
                        delta_color= "off",
                    )
                    st.caption(f"Keyakinan model: **{ag['confidence']}%**")
                    st.caption(ag["description"])

                st.info(f"📋 **Rekomendasi:** {rec}")

                # ── Ringkasan input ───────────────────────────────────────────
                with st.expander("Detail Input"):
                    inp = result["data"]["input"]
                    st.json(inp)
            else:
                st.error("Prediksi gagal. Cek log ML API.")

    # ── Panduan threshold ─────────────────────────────────────────────────────
    with st.expander("Panduan Kondisi Kolam"):
        st.markdown("""
| Parameter | Optimal | Batas Bawah | Batas Atas |
|---|---|---|---|
| Suhu | 26–30°C | 24°C | 32°C |
| pH | 6.5–8.0 | 6.5 | 8.5 |
| Level Pakan | > 40% | 20% | — |
| Cahaya | < 300 lux | — | — |
        """)
