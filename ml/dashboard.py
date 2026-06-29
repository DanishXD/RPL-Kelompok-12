"""
EcoSmart Feeder — Dashboard Analitik ML
=========================================
Jalankan: streamlit run dashboard.py
"""

import json, os
import numpy  as np
import pandas as pd
import requests
import streamlit as st

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title = "EcoSmart Feeder — ML Dashboard",
    page_icon  = "🐟",
    layout     = "wide",
    initial_sidebar_state = "expanded",
)

# ── Global CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
/* Background gradient */
.stApp { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); }

/* Sidebar */
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #1a1740 0%, #2d2b55 100%);
    border-right: 1px solid rgba(255,255,255,0.08);
}
[data-testid="stSidebar"] * { color: #e0e0ff !important; }

/* Metric card */
.metric-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    padding: 20px 24px;
    backdrop-filter: blur(10px);
    transition: transform 0.2s;
}
.metric-card:hover { transform: translateY(-3px); }
.metric-label { font-size: 12px; color: #a0a0cc; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
.metric-value { font-size: 32px; font-weight: 800; background: linear-gradient(90deg, #a78bfa, #60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.metric-sub   { font-size: 12px; color: #7c7caa; margin-top: 4px; }

/* Content card */
.content-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 16px;
}
.card-title { font-size: 16px; font-weight: 700; color: #c4b5fd; margin-bottom: 16px; letter-spacing: 0.5px; }

/* Welcome banner */
.banner {
    background: linear-gradient(135deg, #7c3aed, #4f46e5, #0ea5e9);
    border-radius: 20px;
    padding: 28px 36px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
}
.banner h1 { color: white; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; }
.banner p  { color: rgba(255,255,255,0.8); font-size: 14px; margin: 0; }

/* Badge */
.badge-green  { background: rgba(16,185,129,0.2); color: #10b981; border: 1px solid #10b981; border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600; }
.badge-purple { background: rgba(139,92,246,0.2); color: #a78bfa; border: 1px solid #a78bfa; border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600; }
.badge-blue   { background: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid #60a5fa; border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600; }
.badge-red    { background: rgba(239,68,68,0.2);  color: #f87171; border: 1px solid #f87171; border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600; }

/* Insight row */
.insight-row {
    display: flex; align-items: flex-start; gap: 14px;
    background: rgba(255,255,255,0.04);
    border-radius: 12px; padding: 14px 16px; margin-bottom: 10px;
    border-left: 3px solid #7c3aed;
}
.insight-num { font-size: 20px; font-weight: 800; color: #a78bfa; min-width: 28px; }
.insight-txt { font-size: 14px; color: #d0d0f0; line-height: 1.6; }

/* Table override */
.stDataFrame { background: transparent !important; }
thead tr th { background: rgba(124,58,237,0.3) !important; color: white !important; }
tbody tr:hover td { background: rgba(255,255,255,0.05) !important; }

/* Prediction result */
.pred-card {
    background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15));
    border: 1px solid rgba(167,139,250,0.4);
    border-radius: 16px; padding: 24px; text-align: center;
}
.pred-label { font-size: 12px; color: #a0a0cc; letter-spacing: 1px; text-transform: uppercase; }
.pred-value { font-size: 36px; font-weight: 800; color: #c4b5fd; margin: 8px 0 4px; }
.pred-conf  { font-size: 13px; color: #7c7caa; }

/* Tabs */
[data-testid="stTabs"] button { color: #a0a0cc; font-weight: 600; }
[data-testid="stTabs"] button[aria-selected="true"] { color: #a78bfa; border-bottom-color: #7c3aed; }

/* General text */
h1,h2,h3,h4,p,label,span { color: #e0e0ff; }
</style>
""", unsafe_allow_html=True)

# ── Path & config ─────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_PATH   = os.path.join(BASE_DIR, "data",    "feeding_dataset.csv")
MODELS_DIR  = os.path.join(BASE_DIR, "models")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
ML_API_URL  = os.environ.get("ML_API_URL", "http://localhost:5001")

SLOT_MAP   = {0: "Pagi (06–08)", 1: "Siang (12–13)", 2: "Sore (17–18)", 3: "Tidak Direkomendasikan"}
GRAM_MAP   = {0: "50g", 1: "100g", 2: "150g", 3: "200g"}
FEAT_LABEL = {"temperature":"Suhu (°C)","ph_level":"pH Air","feed_level":"Level Pakan (%)","light_level":"Cahaya (lux)","hour":"Jam"}
MODEL_COLOR = {"Decision Tree":"#60a5fa","Random Forest":"#fb923c","Gradient Boosting":"#a78bfa"}

@st.cache_data
def load_metadata(target):
    path = os.path.join(MODELS_DIR, f"{target}_metadata.json")
    return json.load(open(path)) if os.path.exists(path) else {}

@st.cache_data
def load_dataset():
    return pd.read_csv(DATA_PATH) if os.path.exists(DATA_PATH) else pd.DataFrame()

def img_path(name):
    p = os.path.join(REPORTS_DIR, name)
    return p if os.path.exists(p) else None

def metric_card(label, value, sub=""):
    return f"""<div class="metric-card">
        <div class="metric-label">{label}</div>
        <div class="metric-value">{value}</div>
        <div class="metric-sub">{sub}</div>
    </div>"""

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🐟 EcoSmart Feeder")
    st.markdown("**ML Analytics Dashboard**")
    st.divider()
    page = st.radio(
        "Navigasi",
        ["🏠 Overview", "📊 Dataset", "🤖 Perbandingan Model", "🌳 Interpretasi", "🎯 Prediksi Live"],
        label_visibility="collapsed",
    )
    st.divider()
    meta_ts = load_metadata("time_slot")
    meta_ag = load_metadata("amount_gram")
    if meta_ts:
        st.markdown("**Model Aktif**")
        st.markdown(f"<span class='badge-purple'>{meta_ts.get('best_model','—')}</span>", unsafe_allow_html=True)
        st.caption(f"Waktu pakan · Accuracy {meta_ts.get('accuracy',0)*100:.1f}%")
        st.caption(f"Jumlah pakan · Accuracy {meta_ag.get('accuracy',0)*100:.1f}%")
    st.divider()
    st.caption("Seed: 42 · 5-Fold CV · 2000 sampel")

# ════════════════════════════════════════════════════════════════
# PAGE: OVERVIEW
# ════════════════════════════════════════════════════════════════
if page == "🏠 Overview":

    # Banner
    st.markdown("""<div class="banner">
        <h1>🐟 EcoSmart Feeder ML Dashboard</h1>
        <p>Rekomendasi Waktu &amp; Jumlah Pakan Ikan Lele · Gradient Boosting · Accuracy ~86%</p>
    </div>""", unsafe_allow_html=True)

    # KPI row
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.markdown(metric_card("Total Sampel",    "2,000",  "feeding_dataset.csv"), unsafe_allow_html=True)
    c2.markdown(metric_card("Fitur Input",     "5",      "temp · pH · pakan · cahaya · jam"), unsafe_allow_html=True)
    c3.markdown(metric_card("Model Diuji",     "3",      "DT · RF · GB"), unsafe_allow_html=True)
    c4.markdown(metric_card("Best Accuracy",   "86.6%",  "Gradient Boosting · Jumlah pakan"), unsafe_allow_html=True)
    c5.markdown(metric_card("Best F1 Score",   "85.8%",  "Gradient Boosting · CV weighted"), unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Row 2: akurasi chart + feature importance
    col_left, col_right = st.columns([3, 2])

    with col_left:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">📈 Perbandingan Akurasi — Semua Model & Target</div>', unsafe_allow_html=True)

        if meta_ts and meta_ag:
            models  = list(meta_ts["all_results"].keys())
            acc_ts  = [meta_ts["all_results"][m]["accuracy"]*100  for m in models]
            acc_ag  = [meta_ag["all_results"][m]["accuracy"]*100  for m in models]
            cv_ts   = [meta_ts["all_results"][m]["cv_mean"]*100   for m in models]
            cv_ag   = [meta_ag["all_results"][m]["cv_mean"]*100   for m in models]

            chart_df = pd.DataFrame({
                "Waktu Pakan (Test)":  acc_ts,
                "Jumlah Pakan (Test)": acc_ag,
                "Waktu Pakan (CV)":    cv_ts,
                "Jumlah Pakan (CV)":   cv_ag,
            }, index=models)
            st.bar_chart(chart_df, height=280)
        st.markdown('</div>', unsafe_allow_html=True)

    with col_right:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">🔑 Feature Importance — Gradient Boosting</div>', unsafe_allow_html=True)
        if meta_ts:
            fi = meta_ts.get("feature_importance", {})
            fi_df = pd.DataFrame({
                "Fitur": [FEAT_LABEL.get(k, k) for k in fi],
                "Waktu (%)": [round(v*100,1) for v in fi.values()],
            })
            fi2 = meta_ag.get("feature_importance", {})
            fi_df["Jumlah (%)"] = [round(fi2.get(k, 0)*100, 1) for k in fi]
            st.dataframe(fi_df.sort_values("Waktu (%)", ascending=False),
                         hide_index=True, use_container_width=True, height=260)
        st.markdown('</div>', unsafe_allow_html=True)

    # Row 3: insight cards
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">💡 Key Insights</div>', unsafe_allow_html=True)
    insights = [
        ("🕐", "Jam adalah fitur paling berpengaruh untuk waktu pakan (47.79%) — pola sirkadian ikan lele."),
        ("🌡️", "Suhu, Cahaya, dan pH berkontribusi merata untuk jumlah pakan (~25% tiap fitur)."),
        ("📉", "73.8% data masuk kelas 'Tidak Direkomendasikan' — kondisi optimal jarang terpenuhi."),
        ("⚖️", "150g adalah rekomendasi terbanyak (46.6%) — kondisi kolam umumnya cukup baik."),
        ("🏆", "Gradient Boosting unggul karena menangani hubungan non-linear antar fitur lebih baik."),
    ]
    cols = st.columns(len(insights))
    for col, (icon, txt) in zip(cols, insights):
        with col:
            st.markdown(f"""<div style="background:rgba(124,58,237,0.15);border:1px solid rgba(167,139,250,0.3);
            border-radius:12px;padding:16px;text-align:center;height:130px;">
            <div style="font-size:24px;margin-bottom:8px;">{icon}</div>
            <div style="font-size:12px;color:#d0d0f0;line-height:1.5;">{txt}</div>
            </div>""", unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

# ════════════════════════════════════════════════════════════════
# PAGE: DATASET
# ════════════════════════════════════════════════════════════════
elif page == "📊 Dataset":

    st.markdown("## 📊 Dataset")

    df = load_dataset()
    if df.empty:
        st.error("Dataset tidak ditemukan. Jalankan `python generate_dataset.py`.")
        st.stop()

    # KPI
    c1,c2,c3,c4 = st.columns(4)
    c1.markdown(metric_card("Total Baris",   f"{len(df):,}",    "feeding_dataset.csv"),  unsafe_allow_html=True)
    c2.markdown(metric_card("Fitur Input",   "5",               "X variabel"),            unsafe_allow_html=True)
    c3.markdown(metric_card("Target Output", "2",               "Y variabel"),            unsafe_allow_html=True)
    c4.markdown(metric_card("Noise Rate",    "5%",              "Label acak untuk realisme"), unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">🔍 Preview Dataset (20 baris pertama)</div>', unsafe_allow_html=True)
    st.dataframe(df.head(20), use_container_width=True)
    st.markdown('</div>', unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    with col1:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">📐 Statistik Deskriptif</div>', unsafe_allow_html=True)
        features = ["temperature","ph_level","feed_level","light_level","hour"]
        desc = df[features].describe().round(2)
        desc.index = ["N","Mean","Std","Min","Q1","Median","Q3","Max"]
        st.dataframe(desc.rename(columns=FEAT_LABEL), use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with col2:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">🔗 Korelasi Antar Fitur</div>', unsafe_allow_html=True)
        corr = df[features].corr().round(3)
        st.dataframe(corr.rename(columns=FEAT_LABEL, index=FEAT_LABEL), use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    col3, col4 = st.columns(2)
    with col3:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">⏰ Distribusi Waktu Pakan</div>', unsafe_allow_html=True)
        ts_cnt = df["recommended_time_slot"].map(SLOT_MAP).value_counts()
        st.bar_chart(ts_cnt, height=220)
        ts_df = pd.DataFrame({"Kelas":ts_cnt.index,"Jumlah":ts_cnt.values,"(%)":( ts_cnt.values/len(df)*100).round(1)})
        st.dataframe(ts_df, hide_index=True, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with col4:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">⚖️ Distribusi Jumlah Pakan</div>', unsafe_allow_html=True)
        ag_cnt = df["recommended_amount_gram"].map(GRAM_MAP).value_counts()
        st.bar_chart(ag_cnt, height=220)
        ag_df = pd.DataFrame({"Kelas":ag_cnt.index,"Jumlah":ag_cnt.values,"(%)":( ag_cnt.values/len(df)*100).round(1)})
        st.dataframe(ag_df, hide_index=True, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

# ════════════════════════════════════════════════════════════════
# PAGE: PERBANDINGAN MODEL
# ════════════════════════════════════════════════════════════════
elif page == "🤖 Perbandingan Model":

    st.markdown("## 🤖 Perbandingan Model")
    st.markdown("Tiga model dilatih dan dibandingkan. Model terbaik dipilih berdasarkan **CV Accuracy** tertinggi.")

    meta_ts = load_metadata("time_slot")
    meta_ag = load_metadata("amount_gram")

    def build_table(meta):
        if not meta or "all_results" not in meta:
            return pd.DataFrame()
        rows = []
        for name, r in meta["all_results"].items():
            rows.append({
                "Model":         name,
                "Test Acc":      f"{r['accuracy']*100:.2f}%",
                "CV Acc":        f"{r['cv_mean']*100:.2f}%",
                "CV Std":        f"±{r['cv_std']*100:.2f}%",
                "Test F1 (w)":   f"{r['f1_weighted']*100:.2f}%",
                "CV F1 (w)":     f"{r['cv_f1_mean']*100:.2f}%",
                "Status":        "✅ Terbaik" if name == meta.get("best_model") else "—",
            })
        return pd.DataFrame(rows)

    col1, col2 = st.columns(2)
    with col1:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">⏰ Tabel Metrik — Waktu Pakan</div>', unsafe_allow_html=True)
        df_ts = build_table(meta_ts)
        if not df_ts.empty:
            st.dataframe(df_ts, hide_index=True, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with col2:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">⚖️ Tabel Metrik — Jumlah Pakan</div>', unsafe_allow_html=True)
        df_ag = build_table(meta_ag)
        if not df_ag.empty:
            st.dataframe(df_ag, hide_index=True, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Accuracy comparison charts
    col3, col4 = st.columns(2)
    with col3:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">📊 Grafik Akurasi — Waktu Pakan</div>', unsafe_allow_html=True)
        p = img_path("time_slot_accuracy_comparison.png")
        if p: st.image(p, use_column_width=True)
        else: st.info("Jalankan train_model.py untuk generate grafik.")
        st.markdown('</div>', unsafe_allow_html=True)

    with col4:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">📊 Grafik Akurasi — Jumlah Pakan</div>', unsafe_allow_html=True)
        p = img_path("amount_gram_accuracy_comparison.png")
        if p: st.image(p, use_column_width=True)
        else: st.info("Jalankan train_model.py untuk generate grafik.")
        st.markdown('</div>', unsafe_allow_html=True)

    # F1 charts
    col5, col6 = st.columns(2)
    with col5:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">📈 Grafik F1 Score — Waktu Pakan</div>', unsafe_allow_html=True)
        p = img_path("time_slot_f1_comparison.png")
        if p: st.image(p, use_column_width=True)
        else: st.info("Belum tersedia.")
        st.markdown('</div>', unsafe_allow_html=True)

    with col6:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">📈 Grafik F1 Score — Jumlah Pakan</div>', unsafe_allow_html=True)
        p = img_path("amount_gram_f1_comparison.png")
        if p: st.image(p, use_column_width=True)
        else: st.info("Belum tersedia.")
        st.markdown('</div>', unsafe_allow_html=True)

    # Confusion matrix — full width
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">🔲 Confusion Matrix — Waktu Pakan (3 Model)</div>', unsafe_allow_html=True)
    p = img_path("time_slot_confusion_matrix_comparison.png")
    if p: st.image(p, use_column_width=True)
    else: st.info("Belum tersedia.")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">🔲 Confusion Matrix — Jumlah Pakan (3 Model)</div>', unsafe_allow_html=True)
    p = img_path("amount_gram_confusion_matrix_comparison.png")
    if p: st.image(p, use_column_width=True)
    else: st.info("Belum tersedia.")
    st.markdown('</div>', unsafe_allow_html=True)

# ════════════════════════════════════════════════════════════════
# PAGE: INTERPRETASI
# ════════════════════════════════════════════════════════════════
elif page == "🌳 Interpretasi":

    st.markdown("## 🌳 Interpretasi Model")

    meta_ts = load_metadata("time_slot")
    meta_ag = load_metadata("amount_gram")

    # Feature importance tabel
    col1, col2 = st.columns(2)
    with col1:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">🔑 Feature Importance — Waktu Pakan</div>', unsafe_allow_html=True)
        fi = meta_ts.get("feature_importance", {})
        if fi:
            fi_df = pd.DataFrame({
                "Fitur":      [FEAT_LABEL.get(k,k) for k in fi],
                "Importance": list(fi.values()),
                "Persen (%)": [round(v*100,2) for v in fi.values()],
            }).sort_values("Importance", ascending=False).reset_index(drop=True)
            st.dataframe(fi_df, hide_index=True, use_container_width=True)
            st.progress(0.48)
            st.caption("💡 **Jam (47.79%)** mendominasi — ikan lele aktif makan di waktu tertentu.")
        st.markdown('</div>', unsafe_allow_html=True)

    with col2:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">🔑 Feature Importance — Jumlah Pakan</div>', unsafe_allow_html=True)
        fi2 = meta_ag.get("feature_importance", {})
        if fi2:
            fi_df2 = pd.DataFrame({
                "Fitur":      [FEAT_LABEL.get(k,k) for k in fi2],
                "Importance": list(fi2.values()),
                "Persen (%)": [round(v*100,2) for v in fi2.values()],
            }).sort_values("Importance", ascending=False).reset_index(drop=True)
            st.dataframe(fi_df2, hide_index=True, use_container_width=True)
            st.caption("💡 Suhu, Cahaya, pH merata (~25%) — kualitas air menentukan porsi pakan.")
        st.markdown('</div>', unsafe_allow_html=True)

    # Feature importance charts
    col3, col4 = st.columns(2)
    with col3:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">📊 Feature Importance Chart — Waktu Pakan</div>', unsafe_allow_html=True)
        p = img_path("time_slot_feature_importance.png")
        if p: st.image(p, use_column_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with col4:
        st.markdown('<div class="content-card">', unsafe_allow_html=True)
        st.markdown('<div class="card-title">📊 Feature Importance Chart — Jumlah Pakan</div>', unsafe_allow_html=True)
        p = img_path("amount_gram_feature_importance.png")
        if p: st.image(p, use_column_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    # Decision Tree plots
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">🌳 Decision Tree — Waktu Pakan (kedalaman 3 dari 6)</div>', unsafe_allow_html=True)
    p = img_path("time_slot_decision_tree_plot.png")
    if p: st.image(p, use_column_width=True)
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">🌳 Decision Tree — Jumlah Pakan (kedalaman 3 dari 6)</div>', unsafe_allow_html=True)
    p = img_path("amount_gram_decision_tree_plot.png")
    if p: st.image(p, use_column_width=True)
    st.markdown('</div>', unsafe_allow_html=True)

    # Insight cards
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">💡 Insight Utama dari Data</div>', unsafe_allow_html=True)
    insights = [
        ("1", "🕐 Jam adalah fitur paling berpengaruh untuk waktu pakan (47.79%). Ikan lele memiliki pola makan terikat siklus sirkadian — aktif di pagi, siang, dan sore."),
        ("2", "🌡️ Kondisi fisik kolam (suhu, cahaya, pH) lebih menentukan jumlah pakan. Ketiganya berkontribusi hampir merata ~25% tiap fitur."),
        ("3", "📉 73.8% data masuk kelas Tidak Direkomendasikan — kondisi optimal (suhu + pH + jam tepat) jarang terpenuhi bersamaan."),
        ("4", "⚖️ 150g adalah rekomendasi terbanyak (46.6%) — dalam kondisi normal, sistem merekomendasikan porsi menengah-atas."),
        ("5", "🏆 Gradient Boosting unggul karena membangun model secara iteratif — tiap pohon memperbaiki kesalahan pohon sebelumnya."),
    ]
    for num, txt in insights:
        st.markdown(f"""<div class="insight-row">
            <div class="insight-num">{num}</div>
            <div class="insight-txt">{txt}</div>
        </div>""", unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

# ════════════════════════════════════════════════════════════════
# PAGE: PREDIKSI LIVE
# ════════════════════════════════════════════════════════════════
elif page == "🎯 Prediksi Live":

    st.markdown("## 🎯 Prediksi Live")
    st.markdown("Masukkan kondisi kolam untuk mendapat rekomendasi dari **Gradient Boosting**.")

    # Status API
    api_ok = False
    try:
        r = requests.get(f"{ML_API_URL}/health", timeout=3)
        api_ok = r.status_code == 200 and r.json().get("models_loaded", False)
    except Exception:
        pass

    status_color = "#10b981" if api_ok else "#f59e0b"
    status_text  = f"● ML API Aktif — {ML_API_URL}" if api_ok else f"● ML API Offline — {ML_API_URL}"
    st.markdown(f'<div style="color:{status_color};font-weight:600;font-size:13px;margin-bottom:16px;">{status_text}</div>',
                unsafe_allow_html=True)
    if not api_ok:
        st.info("Jalankan `python api.py` di terminal untuk mengaktifkan prediksi live.")

    # Input form
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">⚙️ Input Kondisi Kolam</div>', unsafe_allow_html=True)

    c1, c2, c3 = st.columns(3)
    with c1:
        temperature = st.slider("🌡️ Suhu Air (°C)",        20.0, 36.0, 28.0, 0.1)
        ph_level    = st.slider("💧 pH Air",                5.0,  9.5,  7.2, 0.1)
    with c2:
        feed_level  = st.slider("🌾 Level Pakan (%)",       0,    100,  65,  1)
        light_level = st.slider("☀️ Intensitas Cahaya (lux)", 20,  800,  350, 10)
    with c3:
        hour = st.slider("🕐 Jam Saat Ini", 0, 23, 7, 1, format="%02d:00")
        st.markdown(f"""<div style="background:rgba(124,58,237,0.15);border-radius:10px;padding:16px;margin-top:8px;text-align:center;">
            <div style="font-size:11px;color:#a0a0cc;text-transform:uppercase;">Waktu Dipilih</div>
            <div style="font-size:28px;font-weight:800;color:#c4b5fd;">{hour:02d}:00</div>
        </div>""", unsafe_allow_html=True)

    submitted = st.button("🔍 Prediksi Sekarang", type="primary", use_container_width=True, disabled=not api_ok)
    st.markdown('</div>', unsafe_allow_html=True)

    # Hasil
    if submitted and api_ok:
        with st.spinner("Memproses..."):
            try:
                resp = requests.post(f"{ML_API_URL}/predict", json={
                    "temperature": temperature, "ph_level": ph_level,
                    "feed_level": feed_level, "light_level": light_level, "hour": hour,
                }, timeout=10)
                result = resp.json()
            except Exception as e:
                result = None
                st.error(f"Gagal: {e}")

        if result and result.get("success"):
            pred = result["data"]["prediction"]
            ts   = pred["time_slot"]
            ag   = pred["amount_gram"]
            rec  = result["data"]["recommendation"]

            st.markdown("<br>", unsafe_allow_html=True)
            col_a, col_b, col_c = st.columns([1,1,2])

            with col_a:
                st.markdown(f"""<div class="pred-card">
                    <div class="pred-label">⏰ Waktu Terbaik</div>
                    <div class="pred-value">{ts['label']}</div>
                    <div style="color:#a78bfa;font-size:14px;margin-bottom:6px;">{ts.get('time_range') or '—'}</div>
                    <div class="pred-conf">Keyakinan model: <b>{ts['confidence']}%</b></div>
                </div>""", unsafe_allow_html=True)

            with col_b:
                st.markdown(f"""<div class="pred-card">
                    <div class="pred-label">⚖️ Jumlah Pakan</div>
                    <div class="pred-value">{ag['gram']}g</div>
                    <div style="color:#a78bfa;font-size:13px;margin-bottom:6px;">{ag['description']}</div>
                    <div class="pred-conf">Keyakinan model: <b>{ag['confidence']}%</b></div>
                </div>""", unsafe_allow_html=True)

            with col_c:
                st.markdown(f"""<div class="content-card" style="height:100%;margin-bottom:0;">
                    <div class="card-title">📋 Rekomendasi Lengkap</div>
                    <p style="color:#d0d0f0;font-size:14px;line-height:1.8;">{rec}</p>
                    <hr style="border-color:rgba(255,255,255,0.1);">
                    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">
                        <span>🌡️ {temperature}°C</span>
                        <span>💧 pH {ph_level}</span>
                        <span>🌾 {feed_level}%</span>
                        <span>☀️ {light_level} lx</span>
                        <span>🕐 {hour:02d}:00</span>
                    </div>
                </div>""", unsafe_allow_html=True)

    # Panduan threshold
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="content-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title">📚 Panduan Kondisi Kolam Optimal</div>', unsafe_allow_html=True)
    thresh_data = {
        "Parameter":    ["Suhu Air", "pH Air", "Level Pakan", "Cahaya"],
        "Optimal":      ["26–30°C",  "6.5–8.0","≥ 40%",       "< 300 lux"],
        "Batas Bawah":  ["24°C",     "6.5",    "20%",         "—"],
        "Batas Atas":   ["32°C",     "8.5",    "—",           "—"],
        "Satuan":       ["°C",       "—",      "%",           "lux"],
    }
    st.dataframe(pd.DataFrame(thresh_data), hide_index=True, use_container_width=True)
    st.markdown('</div>', unsafe_allow_html=True)
