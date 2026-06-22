"""
EcoSmart Feeder — Train & Compare Models
==========================================
Melatih dan membandingkan 3 model klasifikasi:
  1. Decision Tree
  2. Random Forest
  3. Gradient Boosting

Evaluasi menggunakan:
  - Accuracy (Test & 5-Fold Cross Validation)
  - Confusion Matrix

Output yang dihasilkan:
  - models/          : model terbaik (.pkl) + metadata (.json)
  - reports/         : grafik confusion matrix, akurasi, feature importance,
                       decision tree plot

Jalankan:
  python train_model.py
"""

import json
import os
import pickle

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

matplotlib.use("Agg")  # non-interactive backend (tidak perlu display)

from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.tree import DecisionTreeClassifier, plot_tree

# ── Seed global untuk hasil yang konsisten ────────────────────────────────────
SEED = 42
np.random.seed(SEED)

# ── Konstanta ─────────────────────────────────────────────────────────────────
FEATURES = ["temperature", "ph_level", "feed_level", "light_level", "hour"]

TIME_LABELS = {
    0: "Pagi (06-08)",
    1: "Siang (12-13)",
    2: "Sore (17-18)",
    3: "Tidak Rek.",
}
AMOUNT_LABELS = {
    0: "50g",
    1: "100g",
    2: "150g",
    3: "200g",
}

MODEL_COLORS = {
    "Decision Tree": "#2196F3",
    "Random Forest": "#FF9800",
    "Gradient Boosting": "#4CAF50",
}

# ── Definisi model — semua menggunakan random_state=SEED ─────────────────────

MODELS = {
    "Decision Tree": DecisionTreeClassifier(
        max_depth=6,
        min_samples_split=10,
        min_samples_leaf=5,
        criterion="gini",
        random_state=SEED,
    ),
    "Random Forest": RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=10,
        min_samples_leaf=5,
        n_jobs=-1,
        random_state=SEED,
    ),
    "Gradient Boosting": GradientBoostingClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=SEED,
    ),
}


# ─────────────────────────────────────────────────────────────────────────────
#  FUNGSI UTAMA: latih semua model, evaluasi, buat visualisasi
# ─────────────────────────────────────────────────────────────────────────────


def run_comparison(X, y, target_name, class_labels):

    separator = "=" * 65
    print(f"\n{separator}")
    print(f"  TARGET : {target_name}")
    print(separator)

    # ── Split data ────────────────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=SEED,
        stratify=y,
    )

    results = {}  # menyimpan metrik setiap model
    trained = {}  # menyimpan objek model yang sudah dilatih
    cm_data = {}  # menyimpan confusion matrix setiap model

    # ── Latih setiap model ────────────────────────────────────────────────────
    for name, model in MODELS.items():
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
        cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
        cv_f1 = cross_val_score(model, X, y, cv=5, scoring="f1_weighted")

        results[name] = {
            "accuracy": round(acc, 4),
            "cv_mean": round(cv_scores.mean(), 4),
            "cv_std": round(cv_scores.std(), 4),
            "f1_weighted": round(f1, 4),
            "cv_f1_mean": round(cv_f1.mean(), 4),
            "cv_f1_std": round(cv_f1.std(), 4),
        }
        trained[name] = model
        cm_data[name] = confusion_matrix(y_test, y_pred)

        print(f"\n  [{name}]")
        print(f"  Test Accuracy : {acc * 100:.2f}%")
        print(
            f"  CV  Accuracy  : {cv_scores.mean() * 100:.2f}% ± {cv_scores.std() * 100:.2f}%"
        )
        print(f"  F1  Score (w) : {f1 * 100:.2f}%")
        print(f"  CV  F1 Score  : {cv_f1.mean() * 100:.2f}% ± {cv_f1.std() * 100:.2f}%")

    # ── Tabel perbandingan ────────────────────────────────────────────────────
    best_name = max(results, key=lambda n: results[n]["cv_mean"])

    print(
        f"\n  {'Model':<22} {'Test Acc':>9} {'CV Acc':>9} {'CV Std':>8}  {'F1 (w)':>8} {'CV F1':>8}"
    )
    print(f"  {'-' * 68}")
    for name in results:
        r = results[name]
        mark = "  ← TERBAIK" if name == best_name else ""
        print(
            f"  {name:<22}"
            f"  {r['accuracy'] * 100:>7.2f}%"
            f"  {r['cv_mean'] * 100:>7.2f}%"
            f"  ±{r['cv_std'] * 100:.2f}%"
            f"  {r['f1_weighted'] * 100:>7.2f}%"
            f"  {r['cv_f1_mean'] * 100:>7.2f}%"
            f"{mark}"
        )

    # ── Visualisasi 1: Confusion Matrix berdampingan ──────────────────────────
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    fig.suptitle(
        f"Confusion Matrix — {target_name}",
        fontsize=14,
        fontweight="bold",
    )

    for ax, (name, cm) in zip(axes, cm_data.items()):
        disp = ConfusionMatrixDisplay(
            confusion_matrix=cm,
            display_labels=[class_labels[i] for i in sorted(class_labels)],
        )
        disp.plot(ax=ax, cmap="Blues", colorbar=False)
        r = results[name]
        ax.set_title(
            f"{name}\nTest: {r['accuracy'] * 100:.1f}%  CV: {r['cv_mean'] * 100:.1f}%",
            fontsize=11,
            fontweight="bold",
            color=MODEL_COLORS[name],
        )
        ax.tick_params(axis="x", rotation=30)

    plt.tight_layout()
    path = f"reports/{target_name}_confusion_matrix_comparison.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\n  Saved: {path}")

    # ── Visualisasi 2: Bar chart akurasi ──────────────────────────────────────
    names = list(results.keys())
    test_accs = [results[n]["accuracy"] * 100 for n in names]
    cv_means = [results[n]["cv_mean"] * 100 for n in names]
    cv_stds = [results[n]["cv_std"] * 100 for n in names]
    colors = [MODEL_COLORS[n] for n in names]
    x = np.arange(len(names))

    fig, ax = plt.subplots(figsize=(10, 6))
    b1 = ax.bar(
        x - 0.2, test_accs, 0.35, label="Test Accuracy", color=colors, alpha=0.90
    )
    b2 = ax.bar(
        x + 0.2,
        cv_means,
        0.35,
        label="CV Accuracy (5-fold)",
        color=colors,
        alpha=0.55,
        yerr=cv_stds,
        capsize=5,
    )

    ax.set_ylabel("Accuracy (%)", fontsize=12)
    ax.set_title(
        f"Perbandingan Akurasi — {target_name}", fontsize=13, fontweight="bold"
    )
    ax.set_xticks(x)
    ax.set_xticklabels(names, fontsize=11)
    ax.set_ylim(0, 110)
    ax.legend(fontsize=10)
    ax.grid(axis="y", alpha=0.3)

    for bar in b1:
        h = bar.get_height()
        ax.annotate(
            f"{h:.1f}%",
            xy=(bar.get_x() + bar.get_width() / 2, h),
            xytext=(0, 3),
            textcoords="offset points",
            ha="center",
            fontsize=9,
        )
    for bar, err in zip(b2, cv_stds):
        h = bar.get_height()
        ax.annotate(
            f"{h:.1f}%",
            xy=(bar.get_x() + bar.get_width() / 2, h + err),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            fontsize=9,
        )

    best_idx = names.index(best_name)
    ax.annotate(
        "★ Terbaik",
        xy=(
            best_idx,
            max(test_accs[best_idx], cv_means[best_idx] + cv_stds[best_idx]) + 5,
        ),
        ha="center",
        fontsize=11,
        color=MODEL_COLORS[best_name],
        fontweight="bold",
    )

    plt.tight_layout()
    path = f"reports/{target_name}_accuracy_comparison.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path}")

    # ── Visualisasi 2b: Bar chart F1 Score ───────────────────────────────────
    f1_scores = [results[n]["f1_weighted"] * 100 for n in names]
    cv_f1_means = [results[n]["cv_f1_mean"] * 100 for n in names]
    cv_f1_stds = [results[n]["cv_f1_std"] * 100 for n in names]

    fig, ax = plt.subplots(figsize=(10, 6))
    b1 = ax.bar(
        x - 0.2,
        f1_scores,
        0.35,
        label="Test F1 Score (weighted)",
        color=colors,
        alpha=0.90,
    )
    b2 = ax.bar(
        x + 0.2,
        cv_f1_means,
        0.35,
        label="CV F1 Score (5-fold, weighted)",
        color=colors,
        alpha=0.55,
        yerr=cv_f1_stds,
        capsize=5,
    )

    ax.set_ylabel("F1 Score (%)", fontsize=12)
    ax.set_title(
        f"Perbandingan F1 Score — {target_name}", fontsize=13, fontweight="bold"
    )
    ax.set_xticks(x)
    ax.set_xticklabels(names, fontsize=11)
    ax.set_ylim(0, 110)
    ax.legend(fontsize=10)
    ax.grid(axis="y", alpha=0.3)

    for bar in b1:
        h = bar.get_height()
        ax.annotate(
            f"{h:.1f}%",
            xy=(bar.get_x() + bar.get_width() / 2, h),
            xytext=(0, 3),
            textcoords="offset points",
            ha="center",
            fontsize=9,
        )
    for bar, err in zip(b2, cv_f1_stds):
        h = bar.get_height()
        ax.annotate(
            f"{h:.1f}%",
            xy=(bar.get_x() + bar.get_width() / 2, h + err),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            fontsize=9,
        )

    best_f1_idx = names.index(max(results, key=lambda n: results[n]["cv_f1_mean"]))
    ax.annotate(
        "★ Terbaik",
        xy=(
            best_f1_idx,
            max(
                f1_scores[best_f1_idx],
                cv_f1_means[best_f1_idx] + cv_f1_stds[best_f1_idx],
            )
            + 5,
        ),
        ha="center",
        fontsize=11,
        color=MODEL_COLORS[names[best_f1_idx]],
        fontweight="bold",
    )

    plt.tight_layout()
    path = f"reports/{target_name}_f1_comparison.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path}")

    # ── Visualisasi 3: Feature Importance ────────────────────────────────────
    fi_models = {n: m for n, m in trained.items() if hasattr(m, "feature_importances_")}

    if fi_models:
        fig, axes = plt.subplots(1, len(fi_models), figsize=(6 * len(fi_models), 5))
        if len(fi_models) == 1:
            axes = [axes]
        fig.suptitle(
            f"Feature Importance — {target_name}", fontsize=13, fontweight="bold"
        )

        for ax, (name, model) in zip(axes, fi_models.items()):
            importances = model.feature_importances_
            sorted_idx = np.argsort(importances)
            ax.barh(
                [FEATURES[i] for i in sorted_idx],
                importances[sorted_idx],
                color=MODEL_COLORS[name],
                alpha=0.85,
            )
            ax.set_title(name, fontsize=11, color=MODEL_COLORS[name], fontweight="bold")
            ax.set_xlabel("Importance")
            ax.grid(axis="x", alpha=0.3)

        plt.tight_layout()
        path = f"reports/{target_name}_feature_importance.png"
        plt.savefig(path, dpi=150, bbox_inches="tight")
        plt.close()
        print(f"  Saved: {path}")

    # ── Visualisasi 4: Decision Tree Plot ────────────────────────────────────
    dt_model = trained.get("Decision Tree")

    if dt_model is not None:
        fig, ax = plt.subplots(figsize=(22, 10))
        plot_tree(
            dt_model,
            feature_names=FEATURES,
            class_names=[class_labels[i] for i in sorted(class_labels)],
            filled=True,
            rounded=True,
            fontsize=8,
            ax=ax,
            max_depth=3,
            impurity=False,
            proportion=False,
        )
        dt_acc = results["Decision Tree"]["accuracy"]
        ax.set_title(
            f"Decision Tree — {target_name}  (kedalaman ditampilkan: 3 dari 6)\n"
            f"Accuracy: {dt_acc * 100:.2f}%",
            fontsize=13,
            fontweight="bold",
            color=MODEL_COLORS["Decision Tree"],
        )
        plt.tight_layout()
        path = f"reports/{target_name}_decision_tree_plot.png"
        plt.savefig(path, dpi=150, bbox_inches="tight")
        plt.close()
        print(f"  Saved: {path}")

    # ── Simpan model terbaik ──────────────────────────────────────────────────
    best_model = trained[best_name]
    best_result = results[best_name]
    safe_target = target_name.replace(" ", "_")

    with open(f"models/{safe_target}_model.pkl", "wb") as f:
        pickle.dump(best_model, f)

    metadata = {
        "target": target_name,
        "best_model": best_name,
        "seed": SEED,
        "features": FEATURES,
        "classes": class_labels,
        "accuracy": best_result["accuracy"],
        "cv_accuracy_mean": best_result["cv_mean"],
        "cv_accuracy_std": best_result["cv_std"],
        "f1_weighted": best_result["f1_weighted"],
        "cv_f1_mean": best_result["cv_f1_mean"],
        "cv_f1_std": best_result["cv_f1_std"],
        "all_results": results,
        "feature_importance": (
            {
                f: round(float(v), 4)
                for f, v in zip(FEATURES, best_model.feature_importances_)
            }
            if hasattr(best_model, "feature_importances_")
            else {}
        ),
    }
    with open(f"models/{safe_target}_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n  Model terbaik disimpan : models/{safe_target}_model.pkl  ({best_name})")
    return best_name, metadata


# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    os.makedirs("models", exist_ok=True)
    os.makedirs("reports", exist_ok=True)

    # Load dataset
    df = pd.read_csv("data/feeding_dataset.csv")
    X = df[FEATURES]
    print(f"Dataset loaded : {len(df)} baris  |  Seed : {SEED}\n")

    # Latih & bandingkan untuk kedua target
    best_time, meta_time = run_comparison(
        X, df["recommended_time_slot"], "time_slot", TIME_LABELS
    )
    best_amount, meta_amount = run_comparison(
        X, df["recommended_amount_gram"], "amount_gram", AMOUNT_LABELS
    )

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'=' * 65}")
    print(f"  SUMMARY")
    print(f"{'=' * 65}")

    for label, meta, best in [
        ("Waktu Pakan  (time_slot)", meta_time, best_time),
        ("Jumlah Pakan (amount_gram)", meta_amount, best_amount),
    ]:
        print(f"\n  {label}:")
        print(
            f"  {'Model':<22} {'Test Acc':>9} {'CV Acc':>9}  {'F1 (w)':>8} {'CV F1':>8}"
        )
        print(f"  {'-' * 62}")
        for n, r in meta["all_results"].items():
            mark = "  ← TERBAIK" if n == best else ""
            print(
                f"  {n:<22}"
                f"  {r['accuracy'] * 100:>7.2f}%"
                f"  {r['cv_mean'] * 100:>7.2f}%"
                f"  {r['f1_weighted'] * 100:>7.2f}%"
                f"  {r['cv_f1_mean'] * 100:>7.2f}%"
                f"{mark}"
            )

    print(f"\n  Model aktif di API:")
    print(f"    Waktu pakan  → {best_time}")
    print(f"    Jumlah pakan → {best_amount}")

    print(f"\n  Files di reports/:")
    for fname in sorted(os.listdir("reports")):
        print(f"    {fname}")

    print(f"\n✅  Training selesai!")
