"""
EcoSmart Feeder — Train & Compare Models
==========================================
Melatih 3 model untuk rekomendasi waktu & jumlah pakan:
1. Decision Tree
2. Random Forest
3. Gradient Boosting (XGBoost-style via sklearn)

Output: model terbaik disimpan ke models/ sebagai file .pkl
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

TIME_LABELS   = {0: 'Pagi (06-08)', 1: 'Siang (12-13)', 2: 'Sore (17-18)', 3: 'Tidak Direkomendasikan'}
AMOUNT_LABELS = {0: '50g', 1: '100g', 2: '150g', 3: '200g'}

os.makedirs('models',  exist_ok=True)
os.makedirs('reports', exist_ok=True)

# ── Definisi 3 model ──────────────────────────────────────────────────────────

MODELS = {
    'Decision Tree': DecisionTreeClassifier(
        max_depth=6,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        criterion='gini'
    ),
    'Random Forest': RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    ),
    'Gradient Boosting': GradientBoostingClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    ),
}

# ── Fungsi train & evaluasi satu model ───────────────────────────────────────

def train_and_evaluate(model, model_name, X, y, target_name, class_labels):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model.fit(X_train, y_train)
    y_pred     = model.predict(X_test)
    acc        = accuracy_score(y_test, y_pred)
    cv_scores  = cross_val_score(model, X, y, cv=5, scoring='accuracy')

    result = {
        'model_name':      model_name,
        'target':          target_name,
        'accuracy':        round(acc, 4),
        'cv_mean':         round(cv_scores.mean(), 4),
        'cv_std':          round(cv_scores.std(), 4),
        'features':        FEATURES,
        'classes':         class_labels,
    }

    # Feature importance (Decision Tree & Random Forest punya .feature_importances_)
    if hasattr(model, 'feature_importances_'):
        result['feature_importance'] = {
            f: round(float(v), 4)
            for f, v in zip(FEATURES, model.feature_importances_)
        }

    print(f"\n  [{model_name}]")
    print(f"  Test Accuracy : {acc:.4f} ({acc*100:.2f}%)")
    print(f"  CV Accuracy   : {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print(f"  Report:\n{classification_report(y_test, y_pred, target_names=[class_labels[i] for i in sorted(class_labels.keys())])}")

    # Confusion matrix
    fig, ax = plt.subplots(figsize=(8, 6))
    cm   = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=[class_labels[i] for i in sorted(class_labels.keys())]
    )
    disp.plot(ax=ax, cmap='Blues', colorbar=False)
    safe_name = model_name.lower().replace(' ', '_')
    ax.set_title(f'{model_name} — {target_name}\nAccuracy: {acc*100:.2f}%')
    plt.xticks(rotation=30, ha='right')
    plt.tight_layout()
    plt.savefig(f'reports/{target_name}_{safe_name}_confusion_matrix.png', dpi=150)
    plt.close()

    return model, result


# ── Train semua model untuk kedua target ─────────────────────────────────────

def run_comparison(X, y, target_name, class_labels):
    print(f"\n{'='*65}")
    print(f"  TARGET: {target_name}")
    print(f"{'='*65}")

    results = {}
    trained = {}

    for name, model in MODELS.items():
        trained_model, result = train_and_evaluate(
            model, name, X, y, target_name, class_labels
        )
        results[name]  = result
        trained[name]  = trained_model

    # ── Perbandingan akurasi ──────────────────────────────────────────────────
    print(f"\n  📊 PERBANDINGAN MODEL — {target_name}")
    print(f"  {'Model':<22} {'Test Acc':>10} {'CV Mean':>10} {'CV Std':>8}")
    print(f"  {'-'*52}")
    for name, r in results.items():
        print(f"  {name:<22} {r['accuracy']*100:>9.2f}%  {r['cv_mean']*100:>9.2f}%  ±{r['cv_std']*100:.2f}%")

    # ── Pilih model terbaik berdasarkan CV accuracy ───────────────────────────
    best_name = max(results, key=lambda n: results[n]['cv_mean'])
    best_model  = trained[best_name]
    best_result = results[best_name]
    print(f"\n  ✅ Model terbaik: {best_name} (CV: {best_result['cv_mean']*100:.2f}%)")

    # ── Plot perbandingan bar chart ───────────────────────────────────────────
    names = list(results.keys())
    accs  = [results[n]['accuracy'] * 100 for n in names]
    cvs   = [results[n]['cv_mean']  * 100 for n in names]
    colors = ['#4CAF50' if n == best_name else '#90A4AE' for n in names]

    x = np.arange(len(names))
    fig, ax = plt.subplots(figsize=(9, 5))
    bars1 = ax.bar(x - 0.2, accs, 0.35, label='Test Accuracy', color=colors, alpha=0.9)
    bars2 = ax.bar(x + 0.2, cvs,  0.35, label='CV Accuracy',   color=colors, alpha=0.55)
    ax.set_ylabel('Accuracy (%)')
    ax.set_title(f'Perbandingan Model — {target_name}')
    ax.set_xticks(x)
    ax.set_xticklabels(names)
    ax.set_ylim(0, 105)
    ax.legend()
    for bar in list(bars1) + list(bars2):
        ax.annotate(f'{bar.get_height():.1f}%',
                    xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
                    xytext=(0, 3), textcoords='offset points', ha='center', fontsize=9)
    plt.tight_layout()
    plt.savefig(f'reports/{target_name}_model_comparison.png', dpi=150)
    plt.close()

    # ── Simpan model terbaik ──────────────────────────────────────────────────
    safe_target = target_name.replace(' ', '_')
    with open(f'models/{safe_target}_model.pkl', 'wb') as f:
        pickle.dump(best_model, f)

    best_result['best_model'] = best_name
    best_result['all_results'] = {
        n: {'accuracy': r['accuracy'], 'cv_mean': r['cv_mean'], 'cv_std': r['cv_std']}
        for n, r in results.items()
    }
    with open(f'models/{safe_target}_metadata.json', 'w') as f:
        json.dump(best_result, f, indent=2)

    print(f"  💾 Model terbaik disimpan: models/{safe_target}_model.pkl")
    return best_name, best_result


# ── Jalankan perbandingan ─────────────────────────────────────────────────────

best_time,   meta_time   = run_comparison(X, df['recommended_time_slot'],   'time_slot',   TIME_LABELS)
best_amount, meta_amount = run_comparison(X, df['recommended_amount_gram'], 'amount_gram', AMOUNT_LABELS)

# ── Summary akhir ─────────────────────────────────────────────────────────────

print(f"\n{'='*65}")
print(f"  SUMMARY AKHIR")
print(f"{'='*65}")
print(f"\n  TARGET: Waktu Pakan (time_slot)")
for name, r in meta_time['all_results'].items():
    mark = ' ← TERBAIK' if name == best_time else ''
    print(f"    {name:<22} Test: {r['accuracy']*100:.2f}%  CV: {r['cv_mean']*100:.2f}%{mark}")

print(f"\n  TARGET: Jumlah Pakan (amount_gram)")
for name, r in meta_amount['all_results'].items():
    mark = ' ← TERBAIK' if name == best_amount else ''
    print(f"    {name:<22} Test: {r['accuracy']*100:.2f}%  CV: {r['cv_mean']*100:.2f}%{mark}")

print(f"\n  Model yang dipakai API:")
print(f"    Waktu pakan  → {best_time}")
print(f"    Jumlah pakan → {best_amount}")
print(f"\n  Files tersimpan di reports/:")
for f in sorted(os.listdir('reports')):
    print(f"    {f}")
print(f"\n✅ Training & comparison selesai!")
