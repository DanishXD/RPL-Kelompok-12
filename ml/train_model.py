"""
EcoSmart Feeder — Train & Compare Models
==========================================
Melatih 3 model untuk rekomendasi waktu & jumlah pakan:
1. Decision Tree
2. Random Forest
3. Gradient Boosting

Output:
- Confusion matrix semua model (berdampingan)
- Bar chart perbandingan akurasi
- Model terbaik disimpan ke models/
"""

import pandas as pd
import numpy as np
import os
import json
import pickle
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.tree             import DecisionTreeClassifier, plot_tree
from sklearn.ensemble         import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection  import train_test_split, cross_val_score
from sklearn.metrics          import (
    classification_report, confusion_matrix,
    accuracy_score, ConfusionMatrixDisplay
)

# ── Load dataset ──────────────────────────────────────────────────────────────

df = pd.read_csv('data/feeding_dataset.csv')
print(f"Dataset loaded: {len(df)} rows\n")

FEATURES = ['temperature', 'ph_level', 'feed_level', 'light_level', 'hour']
X = df[FEATURES]

TIME_LABELS   = {0: 'Pagi (06-08)', 1: 'Siang (12-13)', 2: 'Sore (17-18)', 3: 'Tidak Rek.'}
AMOUNT_LABELS = {0: '50g', 1: '100g', 2: '150g', 3: '200g'}

os.makedirs('models',  exist_ok=True)
os.makedirs('reports', exist_ok=True)

# ── Definisi 3 model ──────────────────────────────────────────────────────────

MODELS = {
    'Decision Tree': DecisionTreeClassifier(
        max_depth=6, min_samples_split=10, min_samples_leaf=5,
        random_state=42, criterion='gini'
    ),
    'Random Forest': RandomForestClassifier(
        n_estimators=100, max_depth=8, min_samples_split=10,
        min_samples_leaf=5, random_state=42, n_jobs=-1
    ),
    'Gradient Boosting': GradientBoostingClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42
    ),
}

MODEL_COLORS = {
    'Decision Tree':    '#2196F3',
    'Random Forest':    '#FF9800',
    'Gradient Boosting':'#4CAF50',
}

# ── Train semua model & kumpulkan hasil ───────────────────────────────────────

def run_comparison(X, y, target_name, class_labels):
    print(f"\n{'='*65}")
    print(f"  TARGET: {target_name}")
    print(f"{'='*65}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    results  = {}
    trained  = {}
    cm_data  = {}

    for name, model in MODELS.items():
        model.fit(X_train, y_train)
        y_pred    = model.predict(X_test)
        acc       = accuracy_score(y_test, y_pred)
        cv_scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')

        results[name] = {
            'accuracy': round(acc, 4),
            'cv_mean':  round(cv_scores.mean(), 4),
            'cv_std':   round(cv_scores.std(), 4),
        }
        trained[name] = model
        cm_data[name] = confusion_matrix(y_test, y_pred)

        print(f"\n  [{name}]  Test: {acc*100:.2f}%  CV: {cv_scores.mean()*100:.2f}% ±{cv_scores.std()*100:.2f}%")
        print(classification_report(
            y_test, y_pred,
            target_names=[class_labels[i] for i in sorted(class_labels.keys())],
            zero_division=0
        ))

    # ── 1. Confusion matrix semua model berdampingan ──────────────────────────
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    fig.suptitle(f'Confusion Matrix Perbandingan — {target_name}', fontsize=14, fontweight='bold')

    for ax, (name, cm) in zip(axes, cm_data.items()):
        disp = ConfusionMatrixDisplay(
            confusion_matrix=cm,
            display_labels=[class_labels[i] for i in sorted(class_labels.keys())]
        )
        disp.plot(ax=ax, cmap='Blues', colorbar=False)
        acc = results[name]['accuracy']
        cv  = results[name]['cv_mean']
        ax.set_title(f'{name}\nTest: {acc*100:.1f}%  CV: {cv*100:.1f}%',
                     fontsize=11, fontweight='bold',
                     color=MODEL_COLORS[name])
        ax.tick_params(axis='x', rotation=30)

    plt.tight_layout()
    plt.savefig(f'reports/{target_name}_confusion_matrix_comparison.png', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"\n  ✅ Saved: reports/{target_name}_confusion_matrix_comparison.png")

    # ── 2. Bar chart perbandingan akurasi ─────────────────────────────────────
    names     = list(results.keys())
    test_accs = [results[n]['accuracy'] * 100 for n in names]
    cv_means  = [results[n]['cv_mean']  * 100 for n in names]
    cv_stds   = [results[n]['cv_std']   * 100 for n in names]
    colors    = [MODEL_COLORS[n] for n in names]

    x   = np.arange(len(names))
    fig, ax = plt.subplots(figsize=(10, 6))
    b1 = ax.bar(x - 0.2, test_accs, 0.35, label='Test Accuracy', color=colors, alpha=0.9)
    b2 = ax.bar(x + 0.2, cv_means,  0.35, label='CV Accuracy (5-fold)',
                color=colors, alpha=0.55, yerr=cv_stds, capsize=5)

    ax.set_ylabel('Accuracy (%)', fontsize=12)
    ax.set_title(f'Perbandingan Akurasi Model — {target_name}', fontsize=13, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(names, fontsize=11)
    ax.set_ylim(0, 105)
    ax.legend(fontsize=10)
    ax.grid(axis='y', alpha=0.3)

    for bar in list(b1) + list(b2):
        h = bar.get_height()
        ax.annotate(f'{h:.1f}%',
                    xy=(bar.get_x() + bar.get_width() / 2, h),
                    xytext=(0, 3), textcoords='offset points',
                    ha='center', fontsize=9)

    # Tandai model terbaik
    best_name = max(results, key=lambda n: results[n]['cv_mean'])
    best_idx  = names.index(best_name)
    ax.annotate('★ Terbaik',
                xy=(best_idx, max(test_accs[best_idx], cv_means[best_idx]) + 2),
                ha='center', fontsize=11, color=MODEL_COLORS[best_name], fontweight='bold')

    plt.tight_layout()
    plt.savefig(f'reports/{target_name}_accuracy_comparison.png', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  ✅ Saved: reports/{target_name}_accuracy_comparison.png")

    # ── 3. Feature importance (untuk model yang support) ─────────────────────
    fi_models = {n: m for n, m in trained.items() if hasattr(m, 'feature_importances_')}
    if fi_models:
        fig, axes = plt.subplots(1, len(fi_models), figsize=(6 * len(fi_models), 5))
        if len(fi_models) == 1:
            axes = [axes]
        fig.suptitle(f'Feature Importance — {target_name}', fontsize=13, fontweight='bold')

        for ax, (name, model) in zip(axes, fi_models.items()):
            importances = model.feature_importances_
            sorted_idx  = np.argsort(importances)
            ax.barh(
                [FEATURES[i] for i in sorted_idx],
                importances[sorted_idx],
                color=MODEL_COLORS[name], alpha=0.85
            )
            ax.set_title(name, fontsize=11, color=MODEL_COLORS[name], fontweight='bold')
            ax.set_xlabel('Importance')
            ax.grid(axis='x', alpha=0.3)

        plt.tight_layout()
        plt.savefig(f'reports/{target_name}_feature_importance.png', dpi=150, bbox_inches='tight')
        plt.close()
        print(f"  ✅ Saved: reports/{target_name}_feature_importance.png")

    # ── Pilih & simpan model terbaik ──────────────────────────────────────────
    best_model  = trained[best_name]
    best_result = results[best_name]

    print(f"\n  📊 Perbandingan:")
    print(f"  {'Model':<22} {'Test':>8} {'CV Mean':>9} {'CV Std':>8}")
    print(f"  {'-'*50}")
    for name in names:
        r    = results[name]
        mark = ' ← TERBAIK' if name == best_name else ''
        print(f"  {name:<22} {r['accuracy']*100:>7.2f}%  {r['cv_mean']*100:>8.2f}%  ±{r['cv_std']*100:.2f}%{mark}")

    safe_target = target_name.replace(' ', '_')
    with open(f'models/{safe_target}_model.pkl', 'wb') as f:
        pickle.dump(best_model, f)

    metadata = {
        'target':       target_name,
        'best_model':   best_name,
        'features':     FEATURES,
        'classes':      class_labels,
        'accuracy':     best_result['accuracy'],
        'cv_accuracy_mean': best_result['cv_mean'],
        'cv_accuracy_std':  best_result['cv_std'],
        'all_results':  results,
        'feature_importance': {
            f: round(float(v), 4)
            for f, v in zip(FEATURES, best_model.feature_importances_)
        } if hasattr(best_model, 'feature_importances_') else {},
    }
    with open(f'models/{safe_target}_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"\n  💾 Model terbaik disimpan: models/{safe_target}_model.pkl  ({best_name})")
    return best_name, metadata


# ── Jalankan ──────────────────────────────────────────────────────────────────

best_time,   meta_time   = run_comparison(X, df['recommended_time_slot'],   'time_slot',   TIME_LABELS)
best_amount, meta_amount = run_comparison(X, df['recommended_amount_gram'], 'amount_gram', AMOUNT_LABELS)

# ── Summary final ─────────────────────────────────────────────────────────────

print(f"\n{'='*65}")
print(f"  SUMMARY FINAL")
print(f"{'='*65}")
print(f"\n  Waktu Pakan (time_slot):")
for n, r in meta_time['all_results'].items():
    mark = ' ← TERBAIK' if n == best_time else ''
    print(f"    {n:<22} Test: {r['accuracy']*100:.2f}%  CV: {r['cv_mean']*100:.2f}%{mark}")

print(f"\n  Jumlah Pakan (amount_gram):")
for n, r in meta_amount['all_results'].items():
    mark = ' ← TERBAIK' if n == best_amount else ''
    print(f"    {n:<22} Test: {r['accuracy']*100:.2f}%  CV: {r['cv_mean']*100:.2f}%{mark}")

print(f"\n  Model aktif di API:")
print(f"    Waktu pakan  → {best_time}")
print(f"    Jumlah pakan → {best_amount}")

print(f"\n  Files di reports/:")
for f in sorted(os.listdir('reports')):
    print(f"    {f}")

print(f"\n✅ Selesai!")
